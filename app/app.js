document.addEventListener("DOMContentLoaded", function() {
    "use strict";

    var generateBtn = document.getElementById("generateBtn");
    var cancelBtn = document.getElementById("cancelBtn");
    var asciiToggleBtn = document.getElementById("asciiToggleBtn");

    var leftMathExpr = document.getElementById("leftMathExpr");
    var rightMathExpr = document.getElementById("rightMathExpr");

    var progressRow = document.getElementById("progressRow");
    var progressText = document.getElementById("progressText");
    var valuesRow = document.getElementById("valuesRow");
    var asciiRow = document.getElementById("asciiRow");
    var fitRow = document.getElementById("fitRow");
    var fitBody = document.getElementById("fitBody");
    var errorRow = document.getElementById("errorRow");

    var leftValue = document.getElementById("leftValue");
    var rightValue = document.getElementById("rightValue");
    var errorVal = document.getElementById("errorVal");
    var leftStatLabel = document.getElementById("leftStatLabel");
    var rightStatLabel = document.getElementById("rightStatLabel");
    var errorLabel = document.getElementById("errorLabel");

    var leftAsciiText = document.getElementById("leftAsciiText");
    var rightAsciiText = document.getElementById("rightAsciiText");

    var targetSelect = document.getElementById("targetSelect");
    var customTargetParam = document.getElementById("customTargetParam");
    var customTargetInput = document.getElementById("customTargetInput");
    var xMinInput = document.getElementById("xMinInput");
    var xMaxInput = document.getElementById("xMaxInput");
    var samplesInput = document.getElementById("samplesInput");
    var domainParams = document.querySelectorAll(".domain-param");

    var errorPercentInput = document.getElementById("errorPercentInput");
    var mutationRateInput = document.getElementById("mutationRateInput");
    var generationsInput = document.getElementById("generationsInput");
    var populationSizeInput = document.getElementById("populationSizeInput");
    var seedInput = document.getElementById("seedInput");
    var numericInputs = document.querySelectorAll('input[type="number"]');
    var runInputs = document.querySelectorAll(".params input, .params select");

    var RANDOM_CONSTANT = "__constant__";
    var RANDOM_FUNCTION = "__random_fn__";
    var CUSTOM = "__custom__";

    var leftExpr = null;
    var rightExpr = null;
    var showAscii = false;
    var activeRun = null;
    var mathJaxBusy = false;
    var mathJaxDirty = false;

    // -- target selection ----------------------------------------------------

    function buildTargetOptions() {
        var groups = [
            { label: "Functions of x", options: Object.keys(GP.TARGETS).map(function(name) {
                return { value: name, label: name };
            }) },
            { label: "Random", options: [
                { value: RANDOM_FUNCTION, label: "Random function of x" },
                { value: RANDOM_CONSTANT, label: "Random constant (no x)" }
            ] },
            { label: "Custom", options: [{ value: CUSTOM, label: "Custom f(x)…" }] }
        ];

        groups.forEach(function(group) {
            var optgroup = document.createElement("optgroup");
            optgroup.label = group.label;
            group.options.forEach(function(option) {
                var el = document.createElement("option");
                el.value = option.value;
                el.textContent = option.label;
                optgroup.appendChild(el);
            });
            targetSelect.appendChild(optgroup);
        });

        targetSelect.value = "sin(x)";
    }

    function isConstantMode() {
        return targetSelect.value === RANDOM_CONSTANT;
    }

    /** Syntax-check a user-typed f(x); evaluation stays inside the worker. */
    function compileCustom(source) {
        return new Function("x", "with (Math) { return (" + source + "); }");
    }

    function syncControls(resetDomain) {
        var choice = targetSelect.value;
        var spec = GP.TARGETS[choice];

        customTargetParam.classList.toggle("hidden", choice !== CUSTOM);
        domainParams.forEach(function(el) {
            el.classList.toggle("hidden", isConstantMode());
        });

        // A library target knows the domain it is interesting on.
        if (spec && resetDomain !== false) {
            xMinInput.value = round(spec.xMin);
            xMaxInput.value = round(spec.xMax);
        }
    }

    function round(value) {
        return Math.round(value * 10000) / 10000;
    }

    // -- rendering -----------------------------------------------------------

    function setMathContent(el, value) {
        el.innerHTML = "";
        var content = document.createElement("p");
        content.textContent = value === undefined ? "" : value;
        el.appendChild(content);
    }

    function format(value) {
        if (!Number.isFinite(value)) return String(value);
        if (value !== 0 && (Math.abs(value) < 1e-4 || Math.abs(value) >= 1e6)) {
            return value.toExponential(3);
        }
        return String(Math.round(value * 1e6) / 1e6);
    }

    function formatError(value) {
        return Number.isFinite(value) ? value.toPrecision(6) : String(value);
    }

    function renderFitTable(points) {
        fitBody.innerHTML = "";
        // Up to 8 evenly spaced rows — enough to see the shape of the fit.
        var stride = Math.max(1, Math.ceil(points.length / 8));
        points.filter(function(_, i) { return i % stride === 0; }).forEach(function(p) {
            var row = document.createElement("tr");
            [p.x, p.y, p.fit, Math.abs(p.fit - p.y)].forEach(function(value) {
                var cell = document.createElement("td");
                cell.textContent = format(value);
                row.appendChild(cell);
            });
            fitBody.appendChild(row);
        });
    }

    function typesetMath() {
        if (!window.MathJax) return;
        if (mathJaxBusy) {
            mathJaxDirty = true;
            return;
        }
        mathJaxDirty = false;
        mathJaxBusy = true;
        MathJax.Hub.Queue(
            ["Typeset", MathJax.Hub],
            function() {
                mathJaxBusy = false;
                if (mathJaxDirty) typesetMath();
            }
        );
    }

    function render() {
        setMathContent(leftMathExpr, leftExpr ? "`" + leftExpr.mathExprEval + "`" : "?");
        setMathContent(rightMathExpr, rightExpr ? "`" + rightExpr.mathExprEval + "`" : "?");

        typesetMath();

        if (!leftExpr || !rightExpr) {
            valuesRow.classList.add("hidden");
            asciiRow.classList.add("hidden");
            fitRow.classList.add("hidden");
            return;
        }

        valuesRow.classList.remove("hidden");
        asciiRow.classList.remove("hidden");

        if (rightExpr.mode === "function") {
            // Function mode: a single value means nothing, the whole curve does.
            leftStatLabel.textContent = "Samples";
            leftValue.textContent = (rightExpr.points ? rightExpr.points.length : rightExpr.samples) + " on [" +
                format(rightExpr.domain[0]) + ", " + format(rightExpr.domain[1]) + "]";
            errorLabel.textContent = "RMS Error";
            errorVal.textContent = formatError(rightExpr.error);
            rightStatLabel.textContent = "Generations";
            rightValue.textContent = rightExpr.generations;

            if (rightExpr.points) {
                renderFitTable(rightExpr.points);
                fitRow.classList.remove("hidden");
            } else {
                fitRow.classList.add("hidden");
            }
        } else {
            leftStatLabel.textContent = "Value";
            leftValue.textContent = format(leftExpr.eval);
            errorLabel.textContent = "Error";
            errorVal.textContent = formatError(rightExpr.error);
            rightStatLabel.textContent = "Value";
            rightValue.textContent = format(rightExpr.eval);

            fitRow.classList.add("hidden");
        }

        leftAsciiText.textContent = leftExpr.strEval;
        rightAsciiText.textContent = rightExpr.strEval;
        leftAsciiText.classList.toggle("hidden", !showAscii);
        rightAsciiText.classList.toggle("hidden", !showAscii);
        asciiToggleBtn.textContent = showAscii ? "Hide" : "As Text";
    }

    function showError(message) {
        errorRow.textContent = message;
        errorRow.classList.remove("hidden");
    }

    // -- running -------------------------------------------------------------

    function validationError(input, message) {
        input.setCustomValidity(message);
        input.setAttribute("aria-invalid", "true");
        input.reportValidity();
        throw new Error(message);
    }

    function readNumber(input, label, options) {
        var raw = input.value.trim();
        var value = Number(raw);
        options = options || {};

        if (raw === "") validationError(input, label + " is required.");
        if (!Number.isFinite(value)) validationError(input, label + " must be a finite number.");
        if (options.integer && !Number.isInteger(value)) {
            validationError(input, label + " must be a whole number.");
        }
        if (options.min !== undefined && value < options.min) {
            validationError(input, label + " must be at least " + options.min + ".");
        }
        if (options.max !== undefined && value > options.max) {
            validationError(input, label + " must be at most " + options.max + ".");
        }
        return value;
    }

    function readRunOptions() {
        numericInputs.forEach(function(input) {
            input.setCustomValidity("");
            input.removeAttribute("aria-invalid");
        });

        var options = {
            seed: readNumber(seedInput, "Seed", { integer: true, min: 0, max: 0xffffffff }),
            populationSize: readNumber(populationSizeInput, "Population size", { integer: true, min: 3 }),
            generations: readNumber(generationsInput, "Generations", { integer: true, min: 1 }),
            mutationRate: readNumber(mutationRateInput, "Mutation rate", { min: 0, max: 1 }),
            errorPercent: readNumber(errorPercentInput, "Error percent", { min: 0 }),
            domain: { xMin: -3, xMax: 3, samples: 20 }
        };

        if (!isConstantMode()) {
            options.domain.xMin = readNumber(xMinInput, "Domain start");
            options.domain.xMax = readNumber(xMaxInput, "Domain end");
            options.domain.samples = readNumber(samplesInput, "Samples", { integer: true, min: 2 });
            if (options.domain.xMin >= options.domain.xMax) {
                validationError(xMaxInput, "Domain end must be greater than domain start.");
            }
        }

        if (targetSelect.value === CUSTOM) {
            var customSource = customTargetInput.value.trim();
            if (customSource === "") {
                validationError(customTargetInput, "Custom f(x) is required.");
            }
            try {
                compileCustom(customSource);
            } catch (error) {
                validationError(customTargetInput, error.message);
            }
        }

        return options;
    }

    function randomSeed() {
        if (window.crypto && window.crypto.getRandomValues) {
            var seed = new Uint32Array(1);
            window.crypto.getRandomValues(seed);
            return seed[0];
        }
        return Date.now() >>> 0;
    }

    function applyHashOptions() {
        var params = new URLSearchParams(window.location.hash.slice(1));
        var values = {
            seed: seedInput,
            pop: populationSizeInput,
            gen: generationsInput,
            mutation: mutationRateInput,
            error: errorPercentInput,
            xmin: xMinInput,
            xmax: xMaxInput,
            samples: samplesInput,
            custom: customTargetInput
        };

        Object.keys(values).forEach(function(name) {
            if (params.has(name)) values[name].value = params.get(name);
        });

        if (params.has("target")) {
            var target = params.get("target");
            if (Array.prototype.some.call(targetSelect.options, function(option) {
                return option.value === target;
            })) {
                targetSelect.value = target;
            }
        }

        if (!params.has("seed")) seedInput.value = randomSeed();
        return params.has("xmin") && params.has("xmax");
    }

    function saveHashOptions(options) {
        var params = new URLSearchParams();
        params.set("seed", options.seed);
        params.set("pop", options.populationSize);
        params.set("gen", options.generations);
        params.set("mutation", options.mutationRate);
        params.set("error", options.errorPercent);
        params.set("target", targetSelect.value);
        if (!isConstantMode()) {
            params.set("xmin", options.domain.xMin);
            params.set("xmax", options.domain.xMax);
            params.set("samples", options.domain.samples);
        }
        if (targetSelect.value === CUSTOM) params.set("custom", customTargetInput.value);
        window.history.replaceState(null, "", "#" + params.toString());
    }

    function targetSpec() {
        var choice = targetSelect.value;
        if (choice === CUSTOM) {
            return { kind: CUSTOM, source: customTargetInput.value.trim() };
        }
        if (choice === RANDOM_CONSTANT || choice === RANDOM_FUNCTION) {
            return { kind: choice };
        }
        return { kind: "named", name: choice };
    }

    function setRunning(running) {
        generateBtn.disabled = running;
        cancelBtn.classList.toggle("hidden", !running);
        runInputs.forEach(function(input) {
            input.disabled = running;
        });
    }

    function releaseRun(run) {
        if (activeRun !== run) return false;
        if (run.frame !== null) {
            window.cancelAnimationFrame(run.frame);
            run.frame = null;
        }
        run.worker.terminate();
        activeRun = null;
        setRunning(false);
        return true;
    }

    function failRun(run, message) {
        if (!releaseRun(run)) return;
        progressRow.classList.add("hidden");
        leftExpr = null;
        rightExpr = null;
        showError(message);
        render();
    }

    function renderGeneration(run) {
        run.frame = null;
        if (activeRun !== run || !run.pendingGeneration) return;

        var generation = run.pendingGeneration;
        run.pendingGeneration = null;
        rightExpr = {
            mode: generation.mode,
            eval: generation.value,
            mathExprEval: generation.expr,
            strEval: generation.expr,
            error: generation.error,
            generations: generation.generation,
            samples: run.options.domain.samples,
            domain: [run.options.domain.xMin, run.options.domain.xMax]
        };
        progressText.textContent = "Generation " + generation.generation + " of " +
            run.options.generations + " \u00b7 error " + formatError(generation.error);
        render();
    }

    function queueGeneration(run, generation) {
        run.latestGeneration = generation.generation;
        run.pendingGeneration = generation;
        if (run.frame === null) {
            run.frame = window.requestAnimationFrame(function() {
                renderGeneration(run);
            });
        }
    }

    function handleWorkerMessage(run, message) {
        if (activeRun !== run) return;

        if (message.type === "target") {
            leftExpr = {
                eval: message.value,
                mathExprEval: message.label,
                strEval: message.label
            };
            run.mode = message.mode;
            render();
            return;
        }

        if (message.type === "generation") {
            queueGeneration(run, message);
            return;
        }

        if (message.type === "error") {
            failRun(run, message.message);
            return;
        }

        if (message.type !== "result") return;
        var result = message.result;
        if (!releaseRun(run)) return;

        rightExpr = {
            mode: result.mode,
            eval: result.value,
            mathExprEval: result.expr,
            strEval: result.expr,
            error: result.error,
            generations: result.generations,
            samples: run.options.domain.samples,
            points: result.points,
            domain: [run.options.domain.xMin, run.options.domain.xMax]
        };
        progressRow.classList.add("hidden");
        render();
    }

    function generate() {
        errorRow.classList.add("hidden");
        var options;
        try {
            options = readRunOptions();
        } catch (error) {
            showError(error.message);
            return;
        }

        var worker;
        try {
            worker = new Worker("./gene-worker.js");
        } catch (error) {
            showError("Unable to start the evolution worker: " + error.message);
            return;
        }

        saveHashOptions(options);
        leftExpr = null;
        rightExpr = null;
        render();

        var run = {
            worker: worker,
            options: options,
            latestGeneration: 0,
            pendingGeneration: null,
            frame: null,
            mode: null
        };
        activeRun = run;
        setRunning(true);
        progressRow.classList.remove("hidden", "cancelled");
        progressText.textContent = "Preparing evolution\u2026";

        worker.onmessage = function(event) {
            handleWorkerMessage(run, event.data);
        };
        worker.onerror = function(event) {
            event.preventDefault();
            failRun(run, event.message || "The evolution worker stopped unexpectedly.");
        };
        worker.postMessage({
            type: "start",
            options: options,
            target: targetSpec()
        });
    }

    function cancel() {
        var run = activeRun;
        if (!run) return;
        if (run.pendingGeneration) {
            if (run.frame !== null) {
                window.cancelAnimationFrame(run.frame);
                run.frame = null;
            }
            renderGeneration(run);
        }
        if (!releaseRun(run)) return;

        progressRow.classList.remove("hidden");
        progressRow.classList.add("cancelled");
        progressText.textContent = run.latestGeneration > 0
            ? "Cancelled after generation " + run.latestGeneration + "."
            : "Evolution cancelled.";
    }

    generateBtn.addEventListener("click", generate);
    cancelBtn.addEventListener("click", cancel);
    targetSelect.addEventListener("change", function() {
        syncControls(true);
    });
    numericInputs.forEach(function(input) {
        input.addEventListener("input", function() {
            input.setCustomValidity("");
            input.removeAttribute("aria-invalid");
        });
    });
    customTargetInput.addEventListener("input", function() {
        customTargetInput.setCustomValidity("");
        customTargetInput.removeAttribute("aria-invalid");
    });

    asciiToggleBtn.addEventListener("click", function() {
        showAscii = !showAscii;
        render();
    });

    buildTargetOptions();
    syncControls(true);
    var hasHashDomain = applyHashOptions();
    syncControls(!hasHashDomain);
    render();
});
