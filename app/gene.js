"use strict";

/**
 * Symbolic regression via genetic programming.
 *
 * The terminal set contains a *variable* `x` alongside the named constants, and
 * fitness is the RMS error over a set of sampled (x, y) points. That is what
 * makes this symbolic regression rather than constant approximation: the target
 * is a function, not a scalar, so a solution has to be right everywhere in the
 * domain instead of hitting one number by arithmetic coincidence. Passing a
 * plain number as the target still works — it is just the one-point case.
 *
 * Fixes and improvements over the original:
 *  - Real subtree crossover (the original silently no-op'd most of the time)
 *  - Tournament selection + elitism (the original had zero selection pressure)
 *  - Subtree mutation in addition to arity-preserving point mutation
 *  - Protected division, power, and log (no NaN/Infinity from those operators)
 *  - Fitness = RMS error over the sample points (the original's double-abs
 *    accepted -x for x), with a finite-guard and parsimony pressure vs. bloat
 *  - Depth-capped offspring (bloat control)
 *  - Plain data nodes + a dispatch table instead of 15 closures per node
 *  - No parent pointers (crossover tracks parents during traversal),
 *    which also removes the stale-parent bug in copy()
 *  - No Array.prototype pollution
 *  - Seedable PRNG (mulberry32) for reproducible runs
 *  - Named constants (pi, e, phi) carried on the node, not regex'd at print time
 *
 * Runs in Node (`node symbolic-regression.js`) or the browser (exposes GP global).
 */

// ---------------------------------------------------------------------------
// PRNG + small helpers
// ---------------------------------------------------------------------------

/** Deterministic 32-bit PRNG. Same seed -> same run, invaluable for debugging. */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------------------------------------------------------------------------
// Operator dispatch table — the whole "language" lives here.
// Adding an operator is one line; eval/print/arity all derive from it.
// ---------------------------------------------------------------------------

const OPS = {
    add: { arity: 2, eval: (a, b) => a + b,                     print: (a, b) => `(${a}+${b})` },
    sub: { arity: 2, eval: (a, b) => a - b,                     print: (a, b) => `(${a}-${b})` },
    mul: { arity: 2, eval: (a, b) => a * b,                     print: (a, b) => `(${a}*${b})` },
    div: { arity: 2, eval: (a, b) => (b === 0 ? 1 : a / b),     print: (a, b) => `(${a}/${b})` }, // protected
    pow: { arity: 2, eval: protectedPow,                         print: (a, b) => `(${a}^${b})` },
    neg: { arity: 1, eval: (a) => -a,                           print: (a) => `(-${a})` },
    sin: { arity: 1, eval: Math.sin,                            print: (a) => `sin(${a})` },
    cos: { arity: 1, eval: Math.cos,                            print: (a) => `cos(${a})` },
    log: { arity: 1, eval: (a) => Math.log(Math.abs(a) || 1),   print: (a) => `log(${a})` },     // protected
};

const OP_NAMES = Object.keys(OPS);
const POW_LIMIT = 1e12;

/**
 * Power is undefined in the real-valued search space for a negative base and a
 * fractional exponent, and it overflows easily. Invalid or explosive powers
 * become the neutral fallback 1 instead of poisoning an entire individual.
 */
function protectedPow(base, exponent) {
    if (!Number.isFinite(base) || !Number.isFinite(exponent)) return 1;
    if (base < 0 && !Number.isInteger(exponent)) return 1;
    const value = Math.pow(base, exponent);
    return Number.isFinite(value) && Math.abs(value) <= POW_LIMIT ? value : 1;
}

// Point mutation stays arity-preserving (same nice property as the original).
const SAME_ARITY = {
    1: OP_NAMES.filter((op) => OPS[op].arity === 1),
    2: OP_NAMES.filter((op) => OPS[op].arity === 2),
};

// ---------------------------------------------------------------------------
// Tree = plain data. { type, children } for ops, { type:'atom', value, name? }
// for leaves; the variable is { type:'atom', name:'x', variable:true }.
// No methods, no parent pointers -> cheap to create, clone, GC.
// ---------------------------------------------------------------------------

function evalNode(node, x) {
    if (node.type === "atom") return node.variable ? x : node.value;
    const op = OPS[node.type];
    return op.arity === 1
        ? op.eval(evalNode(node.children[0], x))
        : op.eval(evalNode(node.children[0], x), evalNode(node.children[1], x));
}

function printNode(node) {
    if (node.type === "atom") return node.name ?? String(node.value);
    return OPS[node.type].print(...node.children.map(printNode));
}

function copyNode(node) {
    if (node.type === "atom") {
        return { type: "atom", value: node.value, name: node.name, variable: node.variable };
    }
    return { type: node.type, children: node.children.map(copyNode) };
}

function atom(value) {
    return { type: "atom", value };
}

function isNumberAtom(node, value) {
    return node.type === "atom" &&
        node.variable !== true &&
        node.name === undefined &&
        (value === undefined || node.value === value);
}

function isNegativeNumberAtom(node) {
    return node.type === "atom" &&
        node.variable !== true &&
        node.name === undefined &&
        node.value < 0;
}

/**
 * Simplify the expression tree before exposing it. Keeping this structural
 * avoids the old string rewrites and also removes common GP identity clutter.
 */
function simplifyTree(node) {
    if (node.type === "atom") return copyNode(node);

    const children = node.children.map(simplifyTree);
    const left = children[0];
    const right = children[1];

    if (node.type === "neg") {
        if (left.type === "neg") return left.children[0];
        if (isNumberAtom(left)) return atom(-left.value);
    }

    if (node.type === "add") {
        if (isNumberAtom(left, 0)) return right;
        if (isNumberAtom(right, 0)) return left;
        if (right.type === "neg") return simplifyTree({ type: "sub", children: [left, right.children[0]] });
        if (isNegativeNumberAtom(right)) return { type: "sub", children: [left, atom(-right.value)] };
    }

    if (node.type === "sub") {
        if (isNumberAtom(right, 0)) return left;
        if (right.type === "neg") return simplifyTree({ type: "add", children: [left, right.children[0]] });
        if (isNegativeNumberAtom(right)) return { type: "add", children: [left, atom(-right.value)] };
    }

    if (node.type === "mul") {
        if (isNumberAtom(left, 0) || isNumberAtom(right, 0)) return atom(0);
        if (isNumberAtom(left, 1)) return right;
        if (isNumberAtom(right, 1)) return left;
    }

    if (node.type === "div" && isNumberAtom(right, 1)) return left;

    if (node.type === "pow") {
        if (isNumberAtom(right, 0) || isNumberAtom(left, 1)) return atom(1);
        if (isNumberAtom(right, 1)) return left;
    }

    return { type: node.type, children };
}

/** Does this tree actually depend on x? A constant "fit" to a curve is a red flag. */
function usesVariable(node) {
    if (node.type === "atom") return node.variable === true;
    return node.children.some(usesVariable);
}

function countNodes(node) {
    if (node.type === "atom") return 1;
    return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
}

function treeDepth(node) {
    if (node.type === "atom") return 1;
    return 1 + Math.max(...node.children.map(treeDepth));
}

/**
 * Flatten the tree into [{ node, parent, index }] via BFS.
 * Parent/index are tracked here, at traversal time, instead of being stored on
 * the node — so clones can never carry stale parent references.
 */
function nodeList(root) {
    const list = [{ node: root, parent: null, index: -1 }];
    for (let i = 0; i < list.length; i++) {
        const { node } = list[i];
        if (node.type !== "atom") {
            node.children.forEach((child, index) =>
                list.push({ node: child, parent: node, index })
            );
        }
    }
    return list;
}

// ---------------------------------------------------------------------------
// The engine. A factory closing over config + rng, so runs are reproducible
// and nothing leaks into module/global scope.
// ---------------------------------------------------------------------------

function createEngine(userConfig = {}) {
    const config = {
        seed: Date.now() >>> 0,
        populationSize: 1000,
        generations: 40,
        tournamentSize: 4,     // selection pressure: pick k at random, keep the fittest
        elitism: 2,            // copy the top n unchanged into each new generation
        crossoverRate: 0.9,
        mutationRate: 0.2,
        subtreeMutationRate: 0.5, // within mutation: subtree vs point mutation
        minInitDepth: 2,
        maxInitDepth: 5,
        maxDepth: 9,           // hard cap on offspring depth (bloat control)
        parsimony: 1e-3,       // fraction of target scale charged per node
        errorPercent: 1,       // relative stopping tolerance
        absoluteTolerance: 1e-9, // stopping/fitness scale floor near zero
        samples: 20,           // sample points of x used to score a function target
        xMin: -3,              // default sampling domain
        xMax: 3,
        ...userConfig,
    };

    validateConfig(config);
    const rng = mulberry32(config.seed);
    const pick = (arr) => arr[(rng() * arr.length) | 0];

    // Terminal set. Named constants keep pretty-printing exact — no regex
    // find/replace on stringified floats like the original mathPrint did.
    // The two `gen` entries are ephemeral random constants: one integer, one
    // real, because coefficients like 0.5 are not reachable from integers alone.
    const CONST_ATOMS = [
        { name: "pi",  value: Math.PI },
        { name: "e",   value: Math.E },
        { name: "phi", value: (1 + Math.sqrt(5)) / 2 },
        { gen: () => (rng() * 10) | 0 },                       // randInt:10
        { gen: () => Math.round((rng() * 10 - 5) * 1000) / 1000 }, // real in [-5, 5]
    ];

    // x is repeated so it wins roughly a third of terminal draws — without that
    // weighting the search spends most of its budget on constant subtrees.
    const VARIABLE_ATOM = { name: "x", variable: true };
    const VAR_ATOMS = [VARIABLE_ATOM, VARIABLE_ATOM, VARIABLE_ATOM, ...CONST_ATOMS];

    function requireInteger(name, min, max = Infinity) {
        const value = config[name];
        if (!Number.isInteger(value) || value < min || value > max) {
            const range = Number.isFinite(max)
                ? `from ${min} to ${max}`
                : `of at least ${min}`;
            throw new RangeError(`${name} must be an integer ${range}`);
        }
    }

    function requireNumber(name, min, max = Infinity, inclusiveMin = true) {
        const value = config[name];
        if (!Number.isFinite(value)) {
            throw new RangeError(`${name} must be a finite number`);
        }
        const belowMin = inclusiveMin ? value < min : value <= min;
        if (belowMin || value > max) {
            const relation = inclusiveMin ? "at least" : "greater than";
            throw new RangeError(`${name} must be a finite number ${relation} ${min}`);
        }
    }

    function validateConfig() {
        requireInteger("seed", 0, 0xffffffff);
        requireInteger("populationSize", 2);
        requireInteger("generations", 1);
        requireInteger("tournamentSize", 1);
        requireInteger("elitism", 0, config.populationSize - 1);
        requireInteger("minInitDepth", 1);
        requireInteger("maxInitDepth", config.minInitDepth);
        requireInteger("maxDepth", config.maxInitDepth);
        requireInteger("samples", 2);
        requireNumber("crossoverRate", 0, 1);
        requireNumber("mutationRate", 0, 1);
        requireNumber("subtreeMutationRate", 0, 1);
        requireNumber("parsimony", 0);
        requireNumber("errorPercent", 0);
        requireNumber("absoluteTolerance", 0, Infinity, false);
        requireNumber("xMin", -Infinity);
        requireNumber("xMax", -Infinity);
        if (config.xMin >= config.xMax) throw new RangeError("xMin must be less than xMax");
    }

    function makeAtom(atoms) {
        const spec = pick(atoms);
        if (spec.variable) return { type: "atom", name: "x", variable: true };
        return spec.gen
            ? { type: "atom", value: spec.gen() }
            : { type: "atom", value: spec.value, name: spec.name };
    }

    /**
     * Random tree, "grow" or "full" method.
     * - full: every branch reaches maxDepth (bushy trees)
     * - grow: branches may terminate early (scraggly trees)
     * The initial population mixes both across a depth range
     * (ramped half-and-half, the standard GP initialization).
     */
    function randomTree(maxDepth, full, depth = 0, atoms = CONST_ATOMS) {
        const atDepthLimit = depth >= maxDepth;
        const wantAtom = atDepthLimit || (!full && depth > 0 && rng() < 0.3);
        if (wantAtom) return makeAtom(atoms);

        const type = pick(OP_NAMES);
        const children = [];
        for (let i = 0; i < OPS[type].arity; i++) {
            children.push(randomTree(maxDepth, full, depth + 1, atoms));
        }
        return { type, children };
    }

    function rampedPopulation(size, atoms) {
        const population = [];
        const { minInitDepth, maxInitDepth } = config;
        for (let i = 0; i < size; i++) {
            const depth = minInitDepth + (i % (maxInitDepth - minInitDepth + 1));
            population.push(randomTree(depth, i % 2 === 0, 0, atoms));
        }
        return population;
    }

    // -- the problem ----------------------------------------------------------

    function linspace(min, max, count) {
        if (count < 2) return [min];
        const step = (max - min) / (count - 1);
        return Array.from({ length: count }, (_, i) => min + i * step);
    }

    /**
     * Normalize whatever the caller passed as a target into sample points.
     *
     *   number            -> a single point; classic constant approximation
     *   f(x)              -> `samples` points over [xMin, xMax]
     *   [{x, y}] / [[x,y]]-> use the given points verbatim
     *
     * `scale` is the RMS magnitude of the target values; the stopping tolerance
     * is a percentage of it, so "1% error" means the same thing in every mode.
     */
    function makeProblem(target, options = {}) {
        if (typeof target === "number") {
            if (!Number.isFinite(target)) throw new TypeError("target must be finite");
            return { points: [{ x: 0, y: target }], variable: false, scale: Math.abs(target) };
        }

        let points;
        if (Array.isArray(target)) {
            points = target.map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y }));
        } else if (typeof target === "function") {
            const xMin = options.xMin ?? config.xMin;
            const xMax = options.xMax ?? config.xMax;
            const count = options.samples ?? config.samples;
            if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin >= xMax) {
                throw new RangeError("xMin and xMax must be finite, with xMin less than xMax");
            }
            if (!Number.isInteger(count) || count < 2) {
                throw new RangeError("samples must be an integer of at least 2");
            }
            points = linspace(xMin, xMax, count).map((x) => ({ x, y: target(x) }));
        } else {
            throw new TypeError("target must be a number, a function of x, or an array of points");
        }

        // Drop points where the target itself is undefined (log at x<=0, poles…)
        // rather than making them unreachable Infinity penalties for everyone.
        points = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
        if (points.length === 0) throw new Error("target has no finite sample points in this domain");

        const scale = Math.sqrt(points.reduce((s, p) => s + p.y * p.y, 0) / points.length);
        return { points, variable: true, scale };
    }

    // -- fitness ------------------------------------------------------------

    /**
     * rawError:  RMS error over the sample points, Infinity if the tree is
     *            undefined anywhere in the domain. With one point this is just
     *            |target - value| — and no double-abs: an expression evaluating
     *            to -42 is NOT a solution for target 42.
     * fitness:   rawError + targetScale * parsimony * size. Scaling the
     *            complexity charge keeps it meaningful for tiny and huge
     *            targets alike.
     */
    function assess(tree, problem) {
        const { points } = problem;
        let sum = 0;
        for (let i = 0; i < points.length; i++) {
            const value = evalNode(tree, points[i].x);
            if (!Number.isFinite(value)) {
                return { tree, value: NaN, rawError: Infinity, fitness: Infinity };
            }
            const diff = value - points[i].y;
            sum += diff * diff;
        }
        const rawError = Math.sqrt(sum / points.length);
        const fitnessScale = Math.max(problem.scale, config.absoluteTolerance);
        return {
            tree,
            value: evalNode(tree, points[0].x),
            rawError,
            fitness: rawError + fitnessScale * config.parsimony * countNodes(tree),
        };
    }

    // -- genetic operators ----------------------------------------------------

    /** Canonical subtree crossover: a random node in a copy of `a` is replaced
     *  by a copy of a random subtree of `b`. Always changes the tree (unless
     *  the root itself is selected, in which case the donor becomes the tree). */
    function crossover(a, b) {
        const child = copyNode(a);
        const donor = copyNode(pick(nodeList(b)).node);
        const spot = pick(nodeList(child));
        if (spot.parent === null) return donor;
        spot.parent.children[spot.index] = donor;
        return child;
    }

    function mutate(tree, atoms = CONST_ATOMS) {
        const child = copyNode(tree);
        const spot = pick(nodeList(child));

        if (rng() < config.subtreeMutationRate) {
            // Subtree mutation: fresh genetic material.
            const fresh = randomTree(2 + ((rng() * 3) | 0), false, 0, atoms);
            if (spot.parent === null) return fresh;
            spot.parent.children[spot.index] = fresh;
        } else if (spot.node.type === "atom") {
            // Point mutation on a leaf: new terminal value.
            const fresh = makeAtom(atoms);
            spot.node.value = fresh.value;
            if (fresh.variable) spot.node.variable = true; else delete spot.node.variable;
            if (fresh.name) spot.node.name = fresh.name; else delete spot.node.name;
        } else {
            // Point mutation on an operator: arity-preserving type swap,
            // so the children stay valid (same trick as the original).
            spot.node.type = pick(SAME_ARITY[OPS[spot.node.type].arity]);
        }
        return child;
    }

    function tournament(scored) {
        let best = scored[(rng() * scored.length) | 0];
        for (let i = 1; i < config.tournamentSize; i++) {
            const rival = scored[(rng() * scored.length) | 0];
            if (rival.fitness < best.fitness) best = rival;
        }
        return best;
    }

    // -- main loop ------------------------------------------------------------

    /**
     * Evolve expressions toward `target` — a number, a function of x, or an
     * array of sample points (see makeProblem).
     *
     * options: { onGeneration, xMin, xMax, samples }
     * Returns { value, expr, error, generations, tree, fn, points, problem }.
     */
    function evolve(target, options = {}) {
        const onGeneration = options.onGeneration;
        const problem = makeProblem(target, options);
        const atoms = problem.variable ? VAR_ATOMS : CONST_ATOMS;
        const tolerance = Math.max(
            config.absoluteTolerance,
            problem.scale * config.errorPercent / 100
        );

        let scored = rampedPopulation(config.populationSize, atoms)
            .map((tree) => assess(tree, problem));
        scored.sort((a, b) => a.fitness - b.fitness);

        let best = scored[0];
        let generation = 0;

        for (; generation < config.generations; generation++) {
            if (best.rawError <= tolerance) break;

            const next = [];

            // Elitism: the best individuals survive verbatim, so the best
            // fitness can never regress between generations.
            for (let i = 0; i < config.elitism; i++) next.push(scored[i]);

            while (next.length < config.populationSize) {
                const parent = tournament(scored);
                let childTree;

                if (rng() < config.crossoverRate) {
                    childTree = crossover(parent.tree, tournament(scored).tree);
                } else {
                    childTree = copyNode(parent.tree);
                }
                if (rng() < config.mutationRate) {
                    childTree = mutate(childTree, atoms);
                }

                // Bloat control: offspring past the depth cap are replaced by
                // their (already valid) parent rather than re-rolled forever.
                if (treeDepth(childTree) > config.maxDepth) {
                    childTree = copyNode(parent.tree);
                }

                next.push(assess(childTree, problem));
            }

            scored = next;
            scored.sort((a, b) => a.fitness - b.fitness);
            if (scored[0].fitness < best.fitness) best = scored[0];
            if (onGeneration) onGeneration(generation, best);
        }

        const resultTree = simplifyTree(best.tree);
        const resultScore = assess(resultTree, problem);

        return {
            value: resultScore.value,
            expr: printNode(resultTree),
            error: resultScore.rawError,
            generations: generation,
            tolerance,
            tree: resultTree,
            problem,
            fn: (x) => evalNode(resultTree, x),
            // Target vs. fit at every sample point — the honest way to look at
            // a regression result, since one scalar can hide a terrible curve.
            points: problem.points.map((p) => ({ x: p.x, y: p.y, fit: evalNode(resultTree, p.x) })),
        };
    }

    /**
     * Random target generator (the original generateLeftExpression):
     * keeps sampling until it finds a non-trivial expression.
     *
     * options: { variable, minNodes, maxTries, xMin, xMax, samples }
     * With variable:true it returns a random *function* of x — one that really
     * depends on x, is finite across the domain, and is not near-constant.
     */
    function randomTarget(options = {}) {
        // Back-compat: randomTarget(6) used to mean minNodes = 6.
        if (typeof options === "number") options = { minNodes: options };
        const {
            variable = false,
            minNodes = 6,
            maxTries = 10000,
            xMin = config.xMin,
            xMax = config.xMax,
            samples = config.samples,
        } = options;

        if (!Number.isInteger(minNodes) || minNodes < 1) {
            throw new RangeError("minNodes must be an integer of at least 1");
        }
        if (!Number.isInteger(maxTries) || maxTries < 0) {
            throw new RangeError("maxTries must be a non-negative integer");
        }
        if (variable && (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin >= xMax)) {
            throw new RangeError("xMin and xMax must be finite, with xMin less than xMax");
        }
        if (variable && (!Number.isInteger(samples) || samples < 2)) {
            throw new RangeError("samples must be an integer of at least 2");
        }

        const atoms = variable ? VAR_ATOMS : CONST_ATOMS;

        for (let i = 0; i < maxTries; i++) {
            const tree = simplifyTree(randomTree(4, false, 0, atoms));
            if (countNodes(tree) < minNodes) continue;

            if (!variable) {
                const value = evalNode(tree, 0);
                if (Number.isFinite(value) && value !== 0) {
                    return { value, expr: prettyPrint(tree), tree, fn: () => value };
                }
                continue;
            }

            if (!usesVariable(tree)) continue;
            const ys = linspace(xMin, xMax, samples).map((x) => evalNode(tree, x));
            if (!ys.every((y) => Number.isFinite(y) && Math.abs(y) < 1e6)) continue;
            const spread = Math.max(...ys) - Math.min(...ys);
            if (spread < 1e-6) continue; // a constant in disguise

            return {
                value: evalNode(tree, xMin),
                expr: prettyPrint(tree),
                tree,
                fn: (x) => evalNode(tree, x),
            };
        }
        throw new Error("randomTarget: no viable expression found");
    }

    return { config, evolve, randomTarget, randomTree, crossover, mutate, assess, makeProblem };
}

// ---------------------------------------------------------------------------
// Pretty printing
// ---------------------------------------------------------------------------

function prettyPrint(tree) {
    return printNode(simplifyTree(tree));
}

// ---------------------------------------------------------------------------
// A few classic targets worth rediscovering. Each carries its own domain,
// because "where you sample" is part of the problem: e^x over [-5,5] is a
// different (much harder) question than e^x over [-2,2].
// ---------------------------------------------------------------------------

const TARGETS = {
    "sin(x)":            { fn: Math.sin,                          xMin: -Math.PI, xMax: Math.PI },
    "cos(x)":            { fn: Math.cos,                          xMin: -Math.PI, xMax: Math.PI },
    "e^x":               { fn: Math.exp,                          xMin: -2,       xMax: 2 },
    "log(x)":            { fn: Math.log,                          xMin: 0.25,     xMax: 5 },
    "sqrt(x)":           { fn: Math.sqrt,                          xMin: 0,        xMax: 4 },
    "sin(2x)":           { fn: (x) => Math.sin(2 * x),            xMin: -Math.PI, xMax: Math.PI },
    "sinh(x)":           { fn: Math.sinh,                          xMin: -2,       xMax: 2 },
    "1/(1-x)":           { fn: (x) => 1 / (1 - x),                xMin: -0.8,     xMax: 0.8 },
    "x^3 - 2x + 1":      { fn: (x) => x * x * x - 2 * x + 1,      xMin: -3,       xMax: 3 },
    "sin(x)^2+cos(x)^2": { fn: (x) => Math.sin(x) ** 2 + Math.cos(x) ** 2, xMin: -Math.PI, xMax: Math.PI },
};

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

function report(result, elapsed) {
    console.log(`found expression: ${result.expr}`);
    console.log(`RMS error:        ${result.error.toPrecision(6)}`);
    console.log(`generations:      ${result.generations} (${elapsed} ms)`);
    console.log();
}

function main() {
    const gp = createEngine({ seed: 42, populationSize: 2000, generations: 200 });

    // 1. Symbolic regression: fit a real function of x. sinh has no operator of
    //    its own, so the search has to actually construct it.
    const name = "sinh(x)";
    const spec = TARGETS[name];
    console.log(`target function:  ${name}  over [${spec.xMin}, ${spec.xMax}]`);
    let t0 = Date.now();
    const fit = gp.evolve(spec.fn, {
        xMin: spec.xMin,
        xMax: spec.xMax,
        onGeneration: (gen, best) => {
            if (gen % 25 === 0) {
                console.log(`gen ${String(gen).padStart(3)}  rms=${best.rawError.toPrecision(6)}  ${prettyPrint(best.tree)}`);
            }
        },
    });
    report(fit, Date.now() - t0);

    console.log("x        target      fit");
    fit.points.filter((_, i) => i % 4 === 0).forEach((p) => {
        console.log(`${p.x.toFixed(3).padStart(6)}  ${p.y.toFixed(6).padStart(10)}  ${p.fit.toFixed(6).padStart(10)}`);
    });
    console.log();

    // 2. The original mode: approximate a single scalar.
    const target = gp.randomTarget();
    console.log("target expression:", target.expr);
    console.log("target value:     ", target.value);
    t0 = Date.now();
    const scalar = gp.evolve(target.value);
    report(scalar, Date.now() - t0);

    return [fit.expr, scalar.expr];
}

// Node + browser friendly.
const GP_API = { createEngine, prettyPrint, simplifyTree, OPS, TARGETS, main };

if (typeof module !== "undefined" && module.exports) {
    module.exports = GP_API;
    if (require.main === module) main();
} else if (typeof globalThis !== "undefined") {
    // `globalThis` is `window` in the page and `self` in a Web Worker.
    globalThis.GP = GP_API;
}
