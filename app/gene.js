"use strict";

/**
 * Symbolic regression via genetic programming — modernized rewrite.
 *
 * Fixes and improvements over the original:
 *  - Real subtree crossover (the original silently no-op'd most of the time)
 *  - Tournament selection + elitism (the original had zero selection pressure)
 *  - Subtree mutation in addition to arity-preserving point mutation
 *  - Protected division and log (no NaN/Infinity individuals)
 *  - Fitness = |target - value| (the original's double-abs accepted -x for x),
 *    with a finite-guard and parsimony pressure against bloat
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
    pow: { arity: 2, eval: (a, b) => Math.pow(a, b),            print: (a, b) => `(${a}^${b})` },
    neg: { arity: 1, eval: (a) => -a,                           print: (a) => `(-${a})` },
    sin: { arity: 1, eval: Math.sin,                            print: (a) => `sin(${a})` },
    cos: { arity: 1, eval: Math.cos,                            print: (a) => `cos(${a})` },
    log: { arity: 1, eval: (a) => Math.log(Math.abs(a) || 1),   print: (a) => `log(${a})` },     // protected
};

const OP_NAMES = Object.keys(OPS);

// Point mutation stays arity-preserving (same nice property as the original).
const SAME_ARITY = {
    1: OP_NAMES.filter((op) => OPS[op].arity === 1),
    2: OP_NAMES.filter((op) => OPS[op].arity === 2),
};

// ---------------------------------------------------------------------------
// Tree = plain data. { type, children } for ops, { type:'atom', value, name? }
// for leaves. No methods, no parent pointers -> cheap to create, clone, GC.
// ---------------------------------------------------------------------------

function evalNode(node) {
    if (node.type === "atom") return node.value;
    const op = OPS[node.type];
    return op.arity === 1
        ? op.eval(evalNode(node.children[0]))
        : op.eval(evalNode(node.children[0]), evalNode(node.children[1]));
}

function printNode(node) {
    if (node.type === "atom") return node.name ?? String(node.value);
    return OPS[node.type].print(...node.children.map(printNode));
}

function copyNode(node) {
    if (node.type === "atom") {
        return { type: "atom", value: node.value, name: node.name };
    }
    return { type: node.type, children: node.children.map(copyNode) };
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
        seed: Date.now() & 0xffffffff,
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
        parsimony: 1e-3,       // fitness penalty per node (bloat control)
        errorPercent: 1,       // stop when |target - value| <= |target| * this / 100
        ...userConfig,
    };

    const rng = mulberry32(config.seed);
    const pick = (arr) => arr[(rng() * arr.length) | 0];

    // Terminal set. Named constants keep pretty-printing exact — no regex
    // find/replace on stringified floats like the original mathPrint did.
    const ATOMS = [
        { name: "pi",  value: Math.PI },
        { name: "e",   value: Math.E },
        { name: "phi", value: (1 + Math.sqrt(5)) / 2 },
        { gen: () => (rng() * 10) | 0 }, // randInt:10
    ];

    function makeAtom() {
        const spec = pick(ATOMS);
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
    function randomTree(maxDepth, full, depth = 0) {
        const atDepthLimit = depth >= maxDepth;
        const wantAtom = atDepthLimit || (!full && depth > 0 && rng() < 0.3);
        if (wantAtom) return makeAtom();

        const type = pick(OP_NAMES);
        const children = [];
        for (let i = 0; i < OPS[type].arity; i++) {
            children.push(randomTree(maxDepth, full, depth + 1));
        }
        return { type, children };
    }

    function rampedPopulation(size) {
        const population = [];
        const { minInitDepth, maxInitDepth } = config;
        for (let i = 0; i < size; i++) {
            const depth = minInitDepth + (i % (maxInitDepth - minInitDepth + 1));
            population.push(randomTree(depth, i % 2 === 0));
        }
        return population;
    }

    // -- fitness ------------------------------------------------------------

    /**
     * rawError:  |target - value|, Infinity for non-finite results.
     *            (No double-abs: an expression evaluating to -42 is NOT a
     *            solution for target 42.)
     * fitness:   rawError + parsimony * size — what selection actually uses,
     *            so equally-accurate smaller trees win.
     */
    function assess(tree, target) {
        const value = evalNode(tree);
        const rawError = Number.isFinite(value) ? Math.abs(target - value) : Infinity;
        const fitness = rawError === Infinity
            ? Infinity
            : rawError + config.parsimony * countNodes(tree);
        return { tree, value, rawError, fitness };
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

    function mutate(tree) {
        const child = copyNode(tree);
        const spot = pick(nodeList(child));

        if (rng() < config.subtreeMutationRate) {
            // Subtree mutation: fresh genetic material.
            const fresh = randomTree(2 + ((rng() * 3) | 0), false);
            if (spot.parent === null) return fresh;
            spot.parent.children[spot.index] = fresh;
        } else if (spot.node.type === "atom") {
            // Point mutation on a leaf: new terminal value.
            const fresh = makeAtom();
            spot.node.value = fresh.value;
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
     * Evolve expressions toward `target`. Returns
     * { value, expr, error, generations, tree }.
     */
    function evolve(target, onGeneration) {
        const tolerance = Math.abs(target) * config.errorPercent / 100;
        let scored = rampedPopulation(config.populationSize)
            .map((tree) => assess(tree, target));
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
                    childTree = mutate(childTree);
                }

                // Bloat control: offspring past the depth cap are replaced by
                // their (already valid) parent rather than re-rolled forever.
                if (treeDepth(childTree) > config.maxDepth) {
                    childTree = copyNode(parent.tree);
                }

                next.push(assess(childTree, target));
            }

            scored = next;
            scored.sort((a, b) => a.fitness - b.fitness);
            if (scored[0].fitness < best.fitness) best = scored[0];
            if (onGeneration) onGeneration(generation, best);
        }

        return {
            value: best.value,
            expr: prettyPrint(best.tree),
            error: best.rawError,
            generations: generation,
            tree: best.tree,
        };
    }

    /**
     * Random target generator (the original generateLeftExpression):
     * keeps sampling until it finds a non-trivial expression with a
     * finite, non-zero value.
     */
    function randomTarget(minNodes = 6, maxTries = 10000) {
        for (let i = 0; i < maxTries; i++) {
            const tree = randomTree(4, false);
            if (countNodes(tree) < minNodes) continue;
            const value = evalNode(tree);
            if (Number.isFinite(value) && value !== 0) {
                return { value, expr: prettyPrint(tree), tree };
            }
        }
        throw new Error("randomTarget: no viable expression found");
    }

    return { config, evolve, randomTarget, randomTree, crossover, mutate, assess };
}

// ---------------------------------------------------------------------------
// Pretty printing
// ---------------------------------------------------------------------------

function prettyPrint(tree) {
    return printNode(tree)
        .replace(/\+-/g, "-")
        .replace(/--/g, "+");
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

function main() {
    const gp = createEngine({ seed: 42 });

    const target = gp.randomTarget();
    console.log("target expression:", target.expr);
    console.log("target value:     ", target.value);
    console.log();

    const t0 = Date.now();
    const result = gp.evolve(target.value, (gen, best) => {
        if (gen % 5 === 0) {
            console.log(`gen ${String(gen).padStart(3)}  error=${best.rawError.toPrecision(6)}  ${prettyPrint(best.tree)}`);
        }
    });
    const elapsed = Date.now() - t0;

    console.log();
    console.log("found expression: ", result.expr);
    console.log("found value:      ", result.value);
    console.log("absolute error:   ", result.error);
    console.log(`generations:       ${result.generations} (${elapsed} ms)`);

    return [target.expr, result.expr];
}

// Node + browser friendly.
if (typeof module !== "undefined" && module.exports) {
    module.exports = { createEngine, prettyPrint, OPS };
    if (require.main === module) main();
} else if (typeof window !== "undefined") {
    window.GP = { createEngine, prettyPrint, OPS, main };
}