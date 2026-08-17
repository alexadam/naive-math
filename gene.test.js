"use strict";

const assert = require("node:assert/strict");
const { createEngine, prettyPrint, OPS, OP_SETS } = require("./gene.js");

const number = (value) => ({ type: "atom", value });
const named = (name, value) => ({ type: "atom", name, value });
const variable = () => ({ type: "atom", name: "x", variable: true });
const op = (type, ...children) => ({ type, children });

// Protected power never produces NaN/Infinity or an explosive finite value.
assert.equal(OPS.pow.eval(-2, 0.5), 1);
assert.equal(OPS.pow.eval(1e308, 2), 1);
assert.equal(OPS.pow.eval(-2, 3), -8);

// Simplification is structural: identities and signs are handled before print.
assert.equal(prettyPrint(op("mul", named("pi", Math.PI), number(1))), "pi");
assert.equal(prettyPrint(op("add", variable(), number(0))), "x");
assert.equal(prettyPrint(op("add", variable(), number(-2))), "(x-2)");
assert.equal(prettyPrint(op("sub", variable(), number(-2))), "(x+2)");
assert.equal(prettyPrint(op("neg", op("neg", variable()))), "x");

// Scalar error is signed correctly: -42 is 84 away from 42, not a match.
const gp = createEngine({ seed: 42, populationSize: 10, generations: 1 });
const signed = gp.assess(number(-42), gp.makeProblem(42));
assert.equal(signed.rawError, 84);

// Parsimony is the same fraction of target scale at different magnitudes.
const large = gp.assess(number(0), gp.makeProblem(1e6));
const small = gp.assess(number(0), gp.makeProblem(1e-3));
assert.equal(large.fitness - large.rawError, 1e3);
assert.ok(Math.abs((small.fitness - small.rawError) - 1e-6) < 1e-18);

// Relative tolerance has an absolute floor near zero.
const nearZero = gp.evolve(1e-15);
assert.equal(nearZero.tolerance, gp.config.absoluteTolerance);

// The search language is restricted to config.ops, so fitting sin(x) cannot be
// "solved" by the sin operator spelling the target back at generation 1.
const sine = { xMin: -Math.PI, xMax: Math.PI, samples: 12 };
const byDefault = createEngine({ seed: 7, populationSize: 200, generations: 5 })
    .evolve(Math.sin, sine);
assert.doesNotMatch(byDefault.expr, /sin|cos|log/);

const arithmeticOnly = createEngine({
    seed: 7,
    populationSize: 200,
    generations: 5,
    ops: OP_SETS.arithmetic,
}).evolve(Math.sin, sine);
assert.doesNotMatch(arithmeticOnly.expr, /sin|cos|log|\^/);

// Random targets keep the full language: what is asked and what may be used to
// answer it are separate choices.
const restricted = createEngine({ seed: 3, ops: OP_SETS.arithmetic });
assert.ok(restricted.randomTarget({ variable: true }).expr.length > 0);

// ...and the target's own language is chosen independently of config.ops.
const plainTarget = createEngine({ seed: 3, ops: OP_SETS.all })
    .randomTarget({ variable: true, ops: OP_SETS.arithmetic });
assert.doesNotMatch(plainTarget.expr, /sin|cos|log|\^/);
assert.throws(
    () => restricted.randomTarget({ ops: ["add", "tan"] }),
    /target ops contains an unknown operator: tan/
);
assert.throws(
    () => restricted.randomTarget({ ops: [] }),
    /target ops must be a non-empty array/
);

// Generation callbacks and the result carry the fitness samples plus a denser
// draw curve. A point-list target has no function, so the curve is the samples.
const plotter = createEngine({
    seed: 1,
    populationSize: 20,
    generations: 2,
    errorPercent: 0,
});
let plotPayload = null;
const plotted = plotter.evolve(Math.sin, {
    xMin: -Math.PI,
    xMax: Math.PI,
    samples: 12,
    onGeneration(generation, best) {
        plotPayload = best;
    },
});
assert.equal(plotted.points.length, 12);
assert.equal(plotted.curve.length, 160);
assert.ok(plotPayload);
assert.equal(plotPayload.points.length, 12);
assert.equal(plotPayload.curve.length, 160);
assert.equal(typeof plotPayload.points[0].fit, "number");
const sampleRms = Math.sqrt(
    plotted.points.reduce((sum, point) => sum + (point.fit - point.y) ** 2, 0) / plotted.points.length
);
assert.ok(Math.abs(sampleRms - plotted.error) < 1e-12);
const asPoints = plotter.evolve([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 4 },
]);
assert.equal(asPoints.points.length, 3);
assert.equal(asPoints.curve.length, 3);

// Invalid configuration fails loudly instead of returning an initial population.
assert.throws(
    () => createEngine({ ops: [] }),
    /ops must be a non-empty array/
);
assert.throws(
    () => createEngine({ ops: ["add", "tan"] }),
    /ops contains an unknown operator: tan/
);
assert.throws(
    () => createEngine({ generations: NaN }),
    /generations must be an integer/
);
assert.throws(
    () => gp.randomTarget({ maxTries: 0 }),
    /no viable expression found/
);

console.log("gene tests passed");
