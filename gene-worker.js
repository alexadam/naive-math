"use strict";

importScripts("./gene.js");

(function(workerScope) {
    var RANDOM_CONSTANT = "__constant__";
    var RANDOM_FUNCTION = "__random_fn__";
    var CUSTOM = "__custom__";

    function compileCustom(source) {
        return new Function("x", "with (Math) { return (" + source + "); }");
    }

    /** The operators ticked in the UI, as a list of names. Unknown names are
     *  rejected by the engine itself, so nothing is filtered away silently. */
    function resolveOps(ops, fallback) {
        return ops === undefined ? fallback : ops;
    }

    /** The engine a random target is drawn from: a clone of the run's config
     *  under the target's own seed, or the run engine when none was given. */
    function targetEngine(gp, engineConfig, targetSpec) {
        if (targetSpec.seed === undefined) return gp;
        var config = {};
        Object.keys(engineConfig).forEach(function(key) {
            config[key] = engineConfig[key];
        });
        config.seed = targetSpec.seed;
        return workerScope.GP.createEngine(config);
    }

    function resolveTarget(gp, targetSpec, domain, targetOps) {
        if (targetSpec.kind === RANDOM_CONSTANT) {
            var scalar = gp.randomTarget({ ops: targetOps });
            return {
                mode: "constant",
                label: scalar.expr,
                value: scalar.value
            };
        }

        if (targetSpec.kind === RANDOM_FUNCTION) {
            var random = gp.randomTarget({
                variable: true,
                xMin: domain.xMin,
                xMax: domain.xMax,
                samples: domain.samples,
                ops: targetOps
            });
            return {
                mode: "function",
                label: random.expr,
                value: random.fn
            };
        }

        if (targetSpec.kind === CUSTOM) {
            return {
                mode: "function",
                label: targetSpec.source,
                value: compileCustom(targetSpec.source)
            };
        }

        var namedTarget = workerScope.GP.TARGETS[targetSpec.name];
        if (!namedTarget) throw new Error("Unknown target: " + targetSpec.name);
        return {
            mode: "function",
            label: targetSpec.name,
            value: namedTarget.fn
        };
    }

    function publicResult(result, mode) {
        return {
            mode: mode,
            value: result.value,
            expr: result.expr,
            error: result.error,
            generations: result.generations,
            tolerance: result.tolerance,
            points: mode === "function" ? result.points : null,
            curve: mode === "function" ? result.curve : null
        };
    }

    function run(message) {
        var options = message.options;
        var domain = options.domain;
        var engineConfig = {
            seed: options.seed,
            ops: resolveOps(options.ops, workerScope.GP.OP_SETS.algebraic),
            errorPercent: options.errorPercent,
            mutationRate: options.mutationRate,
            generations: options.generations,
            populationSize: options.populationSize,
            xMin: domain.xMin,
            xMax: domain.xMax,
            samples: domain.samples
        };
        var gp = workerScope.GP.createEngine(engineConfig);
        // The target is drawn from its own engine, seeded separately: the run
        // seed reproduces the *search*, and a fresh target seed per run means
        // "Random" really is a new function each time. Keeping the draws off
        // the search rng also leaves evolution decided by the run seed alone.
        // Its operators are the target's own, independent of the search's.
        var target = resolveTarget(
            targetEngine(gp, engineConfig, message.target),
            message.target,
            domain,
            resolveOps(options.targetOps, workerScope.GP.OP_SETS.all)
        );

        workerScope.postMessage({
            type: "target",
            mode: target.mode,
            label: target.label,
            value: target.mode === "constant" ? target.value : null
        });

        var evolveOptions = target.mode === "function" ? {
            xMin: domain.xMin,
            xMax: domain.xMax,
            samples: domain.samples
        } : {};

        evolveOptions.onGeneration = function(generation, best) {
            workerScope.postMessage({
                type: "generation",
                mode: target.mode,
                generation: generation + 1,
                expr: workerScope.GP.prettyPrint(best.tree),
                value: best.value,
                error: best.rawError,
                points: target.mode === "function" ? best.points : null,
                curve: target.mode === "function" ? best.curve : null
            });
        };

        var result = gp.evolve(target.value, evolveOptions);
        workerScope.postMessage({
            type: "result",
            result: publicResult(result, target.mode)
        });
    }

    workerScope.onmessage = function(event) {
        if (!event.data || event.data.type !== "start") return;
        try {
            run(event.data);
        } catch (error) {
            workerScope.postMessage({
                type: "error",
                message: error && error.message ? error.message : String(error)
            });
        }
    };
})(self);
