"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function runWorker(message) {
    const messages = [];
    const scope = {
        postMessage(payload) {
            messages.push(payload);
        },
    };
    scope.self = scope;
    const context = vm.createContext(scope);
    scope.importScripts = function(filename) {
        const imported = fs.readFileSync(path.join(__dirname, filename), "utf8");
        vm.runInContext(imported, context);
    };
    const source = fs.readFileSync(path.join(__dirname, "gene-worker.js"), "utf8");
    vm.runInContext(source, context);
    scope.onmessage({ data: message });
    return messages;
}

const options = {
    seed: 123,
    populationSize: 20,
    generations: 3,
    mutationRate: 0.2,
    errorPercent: 0,
    domain: { xMin: -2, xMax: 2, samples: 8 },
};

const messages = runWorker({
    type: "start",
    options,
    target: { kind: "named", name: "x^3 - 2x + 1" },
});

assert.equal(messages[0].type, "target");
assert.equal(messages[0].mode, "function");
assert.equal(messages.at(-1).type, "result");
assert.equal(messages.at(-1).result.mode, "function");
assert.equal(messages.at(-1).result.points.length, options.domain.samples);
assert.ok(messages.some((message) => message.type === "generation"));

const generations = messages.filter((message) => message.type === "generation");
assert.ok(generations.length > 0);
assert.equal(generations[0].points.length, options.domain.samples);
assert.equal(typeof generations[0].points[0].x, "number");
assert.equal(typeof generations[0].points[0].y, "number");
assert.equal(typeof generations[0].points[0].fit, "number");
assert.ok(generations[0].curve.length >= generations[0].points.length);
assert.ok(messages.at(-1).result.curve.length >= options.domain.samples);

// The operators ticked in the UI reach the engine: with trig excluded the
// worker cannot hand back the target's own spelling.
const arithmetic = ["add", "sub", "mul", "div", "neg"];
const restricted = runWorker({
    type: "start",
    options: Object.assign({}, options, { ops: arithmetic, generations: 5 }),
    target: { kind: "named", name: "sin(x)" },
});
assert.doesNotMatch(restricted.at(-1).result.expr, /sin|cos|log|\^/);

const unknownOps = runWorker({
    type: "start",
    options: Object.assign({}, options, { ops: ["add", "tan"] }),
    target: { kind: "named", name: "sin(x)" },
});
assert.equal(unknownOps[0].type, "error");
assert.equal(unknownOps[0].message, "ops contains an unknown operator: tan");

// The target has its own operators, independent of the search's: here the
// question is arithmetic while the answer may use everything.
const plainQuestion = runWorker({
    type: "start",
    options: Object.assign({}, options, { ops: ["add", "sub", "mul", "sin"], targetOps: arithmetic }),
    target: { kind: "__random_fn__", seed: 11 },
});
assert.equal(plainQuestion[0].type, "target");
assert.doesNotMatch(plainQuestion[0].label, /sin|cos|log|\^/);

const unknownTargetOps = runWorker({
    type: "start",
    options: Object.assign({}, options, { targetOps: ["mul", "tan"] }),
    target: { kind: "__random_fn__", seed: 11 },
});
assert.equal(unknownTargetOps[0].type, "error");
assert.equal(unknownTargetOps[0].message, "target ops contains an unknown operator: tan");

// A random target is drawn from its own seed, so the same run seed asks a
// different question each time — and a shared seed replays the same one.
function randomTargetLabel(targetSeed) {
    return runWorker({
        type: "start",
        options,
        target: { kind: "__random_fn__", seed: targetSeed },
    })[0].label;
}

assert.notEqual(randomTargetLabel(1), randomTargetLabel(2));
assert.equal(randomTargetLabel(7), randomTargetLabel(7));

const invalid = runWorker({
    type: "start",
    options,
    target: { kind: "named", name: "missing" },
});
assert.equal(invalid.length, 1);
assert.equal(invalid[0].type, "error");
assert.equal(invalid[0].message, "Unknown target: missing");

console.log("gene worker tests passed");
