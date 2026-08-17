document.addEventListener("DOMContentLoaded", function() {
    "use strict";

    var generateBtn = document.getElementById("generateBtn");
    var cancelBtn = document.getElementById("cancelBtn");
    var asciiToggleBtn = document.getElementById("asciiToggleBtn");
    var themeToggle = document.getElementById("themeToggle");
    var themeColorMeta = document.querySelector('meta[name="theme-color"]');

    var leftMathExpr = document.getElementById("leftMathExpr");
    var rightMathExpr = document.getElementById("rightMathExpr");

    var statusRow = document.getElementById("statusRow");
    var valuesRow = document.getElementById("valuesRow");
    var asciiRow = document.getElementById("asciiRow");
    var plotRow = document.getElementById("plotRow");
    var fitPlot = document.getElementById("fitPlot");
    var fitRow = document.getElementById("fitRow");
    var fitBody = document.getElementById("fitBody");
    var errorRow = document.getElementById("errorRow");
    var lastPlot = null;

    var leftValue = document.getElementById("leftValue");
    var rightValue = document.getElementById("rightValue");
    var errorVal = document.getElementById("errorVal");
    var leftStatLabel = document.getElementById("leftStatLabel");
    var rightStatLabel = document.getElementById("rightStatLabel");
    var errorLabel = document.getElementById("errorLabel");

    var leftAsciiText = document.getElementById("leftAsciiText");
    var rightAsciiText = document.getElementById("rightAsciiText");

    var targetSelect = document.getElementById("targetSelect");
    var targetOpsGroup = document.getElementById("targetOpsGroup");
    var searchOpsGroup = document.getElementById("searchOpsGroup");
    var targetOpsParams = document.querySelectorAll(".target-ops-param");
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
    var randomSeedBtn = document.getElementById("randomSeedBtn");
    var keepTargetInput = document.getElementById("keepTargetInput");
    var numericInputs = document.querySelectorAll('input[type="number"]');

    // Both languages are picked operator by operator: the one a random target
    // is written in, and the one the search may answer it with.
    var OP_LABELS = {
        add: "+",
        sub: "−",
        mul: "×",
        div: "÷",
        pow: "^",
        neg: "−x",
        sin: "sin",
        cos: "cos",
        log: "log"
    };
    // Targets get everything; the search gets no trig or log. That asymmetry is
    // the point: with sin available, "fit sin(x)" is answered by sin(x) itself
    // and there is nothing to see — the interesting run has to approximate.
    var DEFAULT_TARGET_OPS = GP.OP_SETS.all;
    var DEFAULT_SEARCH_OPS = GP.OP_SETS.algebraic;

    var RANDOM_CONSTANT = "__constant__";
    var RANDOM_FUNCTION = "__random_fn__";
    var CUSTOM = "__custom__";

    var leftExpr = null;
    var rightExpr = null;
    var showAscii = false;
    var activeRun = null;
    var mathJaxBusy = false;
    var mathJaxDirty = false;
    // Set from the URL so a shared link replays its random target once; after
    // that every run draws a new one unless Keep target is on.
    var pendingTargetSeed = null;
    var lastTargetSeed = null;
    var THEME_KEY = "naive-math-theme";
    var THEME_COLORS = { dark: "#12141a", light: "#f3eee6" };

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

    // -- operator sets -------------------------------------------------------

    /** One checkbox per operator the engine knows, in the engine's own order. */
    function buildOpChecks(group, selected) {
        Object.keys(GP.OPS).forEach(function(name) {
            var label = document.createElement("label");
            label.className = "op-check";
            label.title = name;

            var box = document.createElement("input");
            box.type = "checkbox";
            box.value = name;
            box.checked = selected.indexOf(name) !== -1;

            var text = document.createElement("span");
            text.textContent = OP_LABELS[name] || name;

            label.appendChild(box);
            label.appendChild(text);
            group.appendChild(label);
        });
    }

    function opBoxes(group) {
        return group.querySelectorAll('input[type="checkbox"]');
    }

    function readOps(group, label) {
        var boxes = opBoxes(group);
        var names = Array.prototype.filter.call(boxes, function(box) {
            return box.checked;
        }).map(function(box) {
            return box.value;
        });
        if (names.length === 0) {
            validationError(boxes[0], label + " needs at least one operator.");
        }
        return names;
    }

    function setOps(group, names) {
        opBoxes(group).forEach(function(box) {
            box.checked = names.indexOf(box.value) !== -1;
        });
    }

    /** A hash operator list is comma-separated names; the old preset names
     *  ("algebraic") still resolve, so links shared before this control do. */
    function parseOpList(raw) {
        if (GP.OP_SETS[raw]) return GP.OP_SETS[raw].slice();
        var names = raw.split(",").filter(function(name) {
            return Object.prototype.hasOwnProperty.call(GP.OPS, name);
        });
        return names.length > 0 ? names : null;
    }

    function isConstantMode() {
        return targetSelect.value === RANDOM_CONSTANT;
    }

    /** Only a drawn target has a language to choose; a named or custom f(x)
     *  is already written. */
    function isRandomTarget() {
        return targetSelect.value === RANDOM_CONSTANT || targetSelect.value === RANDOM_FUNCTION;
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
        targetOpsParams.forEach(function(el) {
            el.classList.toggle("hidden", !isRandomTarget());
        });

        // A library target knows the domain it is interesting on.
        if (spec && resetDomain !== false) {
            xMinInput.value = round(spec.xMin);
            xMaxInput.value = round(spec.xMax);
        }

        syncSeedHint();
        updateGenerateLabel();
    }

    function keepingTarget() {
        return keepTargetInput.checked && isRandomTarget();
    }

    function updateGenerateLabel() {
        generateBtn.textContent = (keepingTarget() && lastTargetSeed !== null)
            ? "Re-evolve"
            : "Generate";
    }

    function syncSeedHint() {
        if (keepingTarget()) {
            seedInput.title = "Search seed. The target stays fixed while Keep target is on.";
            randomSeedBtn.title = "Randomize search seed (keeps the target)";
        } else {
            seedInput.title = "Search seed. A random target has its own seed; the dice also clears a pinned target seed.";
            randomSeedBtn.title = "Randomize seed";
        }
    }

    function currentTheme() {
        return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    }

    function preferredTheme() {
        try {
            var saved = localStorage.getItem(THEME_KEY);
            if (saved === "light" || saved === "dark") return saved;
        } catch (error) {}
        return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }

    function applyTheme(theme, persist) {
        document.documentElement.setAttribute("data-theme", theme);
        if (themeColorMeta) themeColorMeta.setAttribute("content", THEME_COLORS[theme] || THEME_COLORS.dark);
        var next = theme === "light" ? "dark" : "light";
        themeToggle.setAttribute("aria-label", "Switch to " + next + " theme");
        themeToggle.title = next.charAt(0).toUpperCase() + next.slice(1) + " theme";
        if (persist) {
            try {
                localStorage.setItem(THEME_KEY, theme);
            } catch (error) {}
        }
        if (lastPlot) drawFitPlot(lastPlot.points, lastPlot.curve);
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

    function formatTick(value) {
        if (!Number.isFinite(value)) return String(value);
        var abs = Math.abs(value);
        if (value !== 0 && (abs < 1e-3 || abs >= 1e4)) return value.toExponential(1);
        return String(Math.round(value * 1e4) / 1e4);
    }

    function residualOf(point) {
        return Math.abs(point.fit - point.y);
    }

    /** Index of the fitness sample whose |diff| is largest. Non-finite fits
     *  count as worse than any finite residual. */
    function worstResidualIndex(points) {
        var worst = -1;
        var worstDiff = -1;
        for (var i = 0; i < points.length; i++) {
            var diff = residualOf(points[i]);
            if (!Number.isFinite(diff)) return i;
            if (diff > worstDiff) {
                worstDiff = diff;
                worst = i;
            }
        }
        return worst;
    }

    function niceNum(range, round) {
        if (!(range > 0) || !Number.isFinite(range)) return 1;
        var exp = Math.floor(Math.log(range) / Math.LN10);
        var frac = range / Math.pow(10, exp);
        var nice;
        if (round) {
            if (frac < 1.5) nice = 1;
            else if (frac < 3) nice = 2;
            else if (frac < 7) nice = 5;
            else nice = 10;
        } else {
            if (frac <= 1) nice = 1;
            else if (frac <= 2) nice = 2;
            else if (frac <= 5) nice = 5;
            else nice = 10;
        }
        return nice * Math.pow(10, exp);
    }

    function niceTicks(min, max, count) {
        if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
        if (min === max) return [min];
        if (min > max) {
            var swap = min;
            min = max;
            max = swap;
        }
        var range = niceNum(max - min, false);
        var step = niceNum(range / Math.max(1, count - 1), true);
        var start = Math.ceil(min / step) * step;
        var ticks = [];
        for (var value = start; value <= max + step * 0.5; value += step) {
            var tick = Number(value.toPrecision(12));
            if (tick >= min - step * 1e-6 && tick <= max + step * 1e-6) ticks.push(tick);
            if (ticks.length > 20) break;
        }
        return ticks.length > 0 ? ticks : [min, max];
    }

    function dataExtent(series, keys) {
        var lo = Infinity;
        var hi = -Infinity;
        series.forEach(function(point) {
            keys.forEach(function(key) {
                var value = point[key];
                if (Number.isFinite(value)) {
                    if (value < lo) lo = value;
                    if (value > hi) hi = value;
                }
            });
        });
        if (!Number.isFinite(lo)) return { min: -1, max: 1 };
        if (lo === hi) {
            var pad = Math.max(Math.abs(lo) * 0.1, 1e-3);
            return { min: lo - pad, max: hi + pad };
        }
        var span = hi - lo;
        return { min: lo - span * 0.08, max: hi + span * 0.08 };
    }

    function cssColor(name, fallback) {
        var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return value || fallback;
    }

    function strokeSeries(ctx, series, key, toX, toY) {
        var drawing = false;
        for (var i = 0; i < series.length; i++) {
            var y = series[i][key];
            if (!Number.isFinite(series[i].x) || !Number.isFinite(y)) {
                if (drawing) ctx.stroke();
                drawing = false;
                continue;
            }
            var px = toX(series[i].x);
            var py = toY(y);
            if (!drawing) {
                ctx.beginPath();
                ctx.moveTo(px, py);
                drawing = true;
            } else {
                ctx.lineTo(px, py);
            }
        }
        if (drawing) ctx.stroke();
    }

    function hideFitPlot() {
        plotRow.classList.add("hidden");
        lastPlot = null;
    }

    function drawFitPlot(points, curve) {
        if (!points || points.length === 0) {
            hideFitPlot();
            return;
        }

        var series = curve && curve.length ? curve : points;
        lastPlot = { points: points, curve: series };
        plotRow.classList.remove("hidden");

        var dpr = window.devicePixelRatio || 1;
        var cssW = fitPlot.clientWidth || fitPlot.width || 640;
        var cssH = fitPlot.clientHeight || 240;
        var bufW = Math.max(1, Math.round(cssW * dpr));
        var bufH = Math.max(1, Math.round(cssH * dpr));
        if (fitPlot.width !== bufW) fitPlot.width = bufW;
        if (fitPlot.height !== bufH) fitPlot.height = bufH;

        var ctx = fitPlot.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = cssColor("--plot-bg", "#101218");
        ctx.fillRect(0, 0, cssW, cssH);

        var pad = { top: 8, right: 14, bottom: 26, left: 44 };
        var plotW = Math.max(1, cssW - pad.left - pad.right);
        var plotH = Math.max(1, cssH - pad.top - pad.bottom);

        var xRange = dataExtent(series.concat(points), ["x"]);
        var yRange = dataExtent(series.concat(points), ["y", "fit"]);
        var xMin = xRange.min;
        var xMax = xRange.max;
        var yMin = yRange.min;
        var yMax = yRange.max;
        var xSpan = xMax - xMin || 1;
        var ySpan = yMax - yMin || 1;

        function toX(x) {
            return pad.left + ((x - xMin) / xSpan) * plotW;
        }
        function toY(y) {
            return pad.top + (1 - (y - yMin) / ySpan) * plotH;
        }

        var targetColor = cssColor("--plot-target", "#4f46e5");
        var evolvedColor = cssColor("--plot-evolved", "#0f766e");
        var residualColor = cssColor("--error-text", "#b91c1c");
        var gridColor = cssColor("--plot-grid", "#e5e7eb");
        var textColor = cssColor("--text-secondary", "#6b7280");
        var axisColor = cssColor("--border", "#e5e7eb");

        var xTicks = niceTicks(xMin, xMax, 6);
        var yTicks = niceTicks(yMin, yMax, 5);

        ctx.save();
        ctx.beginPath();
        ctx.rect(pad.left, pad.top, plotW, plotH);
        ctx.clip();

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        xTicks.forEach(function(tick) {
            var x = toX(tick);
            ctx.beginPath();
            ctx.moveTo(x, pad.top);
            ctx.lineTo(x, pad.top + plotH);
            ctx.stroke();
        });
        yTicks.forEach(function(tick) {
            var y = toY(tick);
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + plotW, y);
            ctx.stroke();
        });

        if (xMin < 0 && xMax > 0) {
            ctx.strokeStyle = axisColor;
            ctx.beginPath();
            ctx.moveTo(toX(0), pad.top);
            ctx.lineTo(toX(0), pad.top + plotH);
            ctx.stroke();
        }
        if (yMin < 0 && yMax > 0) {
            ctx.strokeStyle = axisColor;
            ctx.beginPath();
            ctx.moveTo(pad.left, toY(0));
            ctx.lineTo(pad.left + plotW, toY(0));
            ctx.stroke();
        }

        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.lineWidth = 2.25;
        ctx.strokeStyle = targetColor;
        strokeSeries(ctx, series, "y", toX, toY);
        ctx.strokeStyle = evolvedColor;
        strokeSeries(ctx, series, "fit", toX, toY);

        if (points.length <= 40) {
            points.forEach(function(point) {
                if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
                    ctx.beginPath();
                    ctx.fillStyle = targetColor;
                    ctx.arc(toX(point.x), toY(point.y), 2.4, 0, Math.PI * 2);
                    ctx.fill();
                }
                if (Number.isFinite(point.x) && Number.isFinite(point.fit)) {
                    ctx.beginPath();
                    ctx.fillStyle = evolvedColor;
                    ctx.arc(toX(point.x), toY(point.fit), 2.4, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        var worstAt = worstResidualIndex(points);
        var worst = worstAt >= 0 ? points[worstAt] : null;
        var worstDiff = worst ? residualOf(worst) : 0;
        if (worst && worstDiff > 0) {
            var wx = toX(worst.x);
            ctx.strokeStyle = residualColor;
            ctx.lineWidth = 1.5;
            if (Number.isFinite(worst.y) && Number.isFinite(worst.fit)) {
                ctx.beginPath();
                ctx.moveTo(wx, toY(worst.y));
                ctx.lineTo(wx, toY(worst.fit));
                ctx.stroke();
            }
            ctx.lineWidth = 2;
            [[worst.y, targetColor], [worst.fit, evolvedColor]].forEach(function(entry) {
                if (!Number.isFinite(entry[0])) return;
                ctx.beginPath();
                ctx.strokeStyle = residualColor;
                ctx.fillStyle = cssColor("--plot-dot-fill", "#fff");
                ctx.arc(wx, toY(entry[0]), 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
        }

        ctx.restore();

        ctx.strokeStyle = axisColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(pad.left + 0.5, pad.top + 0.5, plotW, plotH);

        ctx.fillStyle = textColor;
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        xTicks.forEach(function(tick) {
            ctx.fillText(formatTick(tick), toX(tick), pad.top + plotH + 6);
        });
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        yTicks.forEach(function(tick) {
            ctx.fillText(formatTick(tick), pad.left - 6, toY(tick));
        });

        var domainLo = formatTick(points[0].x);
        var domainHi = formatTick(points[points.length - 1].x);
        var label = "Target versus evolved on [" + domainLo + ", " + domainHi + "]";
        if (worst && worstDiff > 0) {
            label += ". Worst residual " + formatError(worstDiff) + " at x = " + format(worst.x);
        }
        fitPlot.setAttribute("aria-label", label);
    }

    function renderFitTable(points) {
        fitBody.innerHTML = "";
        var worstAt = worstResidualIndex(points);
        var worstDiff = worstAt >= 0 ? residualOf(points[worstAt]) : 0;
        // Up to 8 evenly spaced rows, plus the worst residual so the table
        // and the plot agree about where the fit is bad.
        var stride = Math.max(1, Math.ceil(points.length / 8));
        points.forEach(function(p, i) {
            if (i % stride !== 0 && i !== worstAt) return;
            var row = document.createElement("tr");
            if (i === worstAt && worstDiff > 0) row.className = "fit-worst";
            [p.x, p.y, p.fit, residualOf(p)].forEach(function(value) {
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
            hideFitPlot();
            updateGenerateLabel();
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
                drawFitPlot(rightExpr.points, rightExpr.curve);
            } else {
                fitRow.classList.add("hidden");
                hideFitPlot();
            }
        } else {
            leftStatLabel.textContent = "Value";
            leftValue.textContent = format(leftExpr.eval);
            errorLabel.textContent = "Error";
            errorVal.textContent = formatError(rightExpr.error);
            rightStatLabel.textContent = "Value";
            rightValue.textContent = format(rightExpr.eval);

            fitRow.classList.add("hidden");
            hideFitPlot();
        }

        leftAsciiText.textContent = leftExpr.strEval;
        rightAsciiText.textContent = rightExpr.strEval;
        leftAsciiText.classList.toggle("hidden", !showAscii);
        rightAsciiText.classList.toggle("hidden", !showAscii);
        asciiToggleBtn.textContent = showAscii ? "Hide" : "As Text";
        updateGenerateLabel();
    }

    function showError(message) {
        errorRow.textContent = message;
        errorRow.classList.remove("hidden");
    }

    // -- running -------------------------------------------------------------

    function clearValidity(input) {
        input.setCustomValidity("");
        input.removeAttribute("aria-invalid");
    }

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
        numericInputs.forEach(clearValidity);
        opBoxes(targetOpsGroup).forEach(clearValidity);
        opBoxes(searchOpsGroup).forEach(clearValidity);

        var options = {
            ops: readOps(searchOpsGroup, "Search symbols"),
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

        if (isRandomTarget()) {
            options.targetOps = readOps(targetOpsGroup, "Target symbols");
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

        [[searchOpsGroup, "ops"], [targetOpsGroup, "tops"]].forEach(function(entry) {
            if (!params.has(entry[1])) return;
            var names = parseOpList(params.get(entry[1]));
            if (names) setOps(entry[0], names);
        });

        if (!params.has("seed")) seedInput.value = randomSeed();

        var targetSeed = Number(params.get("tseed"));
        if (params.has("tseed") && Number.isInteger(targetSeed) && targetSeed >= 0) {
            pendingTargetSeed = targetSeed;
            lastTargetSeed = targetSeed;
        }

        keepTargetInput.checked = params.get("keep") === "1";

        return params.has("xmin") && params.has("xmax");
    }

    function saveHashOptions(options, spec) {
        var params = new URLSearchParams();
        params.set("seed", options.seed);
        if (spec.seed !== undefined) params.set("tseed", spec.seed);
        params.set("pop", options.populationSize);
        params.set("gen", options.generations);
        params.set("mutation", options.mutationRate);
        params.set("error", options.errorPercent);
        params.set("target", targetSelect.value);
        params.set("ops", options.ops.join(","));
        if (options.targetOps) params.set("tops", options.targetOps.join(","));
        if (keepingTarget()) params.set("keep", "1");
        if (!isConstantMode()) {
            params.set("xmin", options.domain.xMin);
            params.set("xmax", options.domain.xMax);
            params.set("samples", options.domain.samples);
        }
        if (targetSelect.value === CUSTOM) params.set("custom", customTargetInput.value);
        window.history.replaceState(null, "", "#" + params.toString());
    }

    /** A random target is seeded independently of the run seed, so pressing
     *  Generate again asks a new question instead of replaying the old one —
     *  unless Keep target is on, in which case the same target is reused and
     *  only the search starts over. */
    function takeTargetSeed() {
        if (keepingTarget() && lastTargetSeed !== null) {
            pendingTargetSeed = null;
            return lastTargetSeed;
        }
        if (pendingTargetSeed !== null) {
            lastTargetSeed = pendingTargetSeed;
            pendingTargetSeed = null;
            return lastTargetSeed;
        }
        lastTargetSeed = randomSeed();
        return lastTargetSeed;
    }

    function targetSpec() {
        var choice = targetSelect.value;
        if (choice === CUSTOM) {
            return { kind: CUSTOM, source: customTargetInput.value.trim() };
        }
        if (choice === RANDOM_CONSTANT || choice === RANDOM_FUNCTION) {
            return { kind: choice, seed: takeTargetSeed() };
        }
        return { kind: "named", name: choice };
    }

    function setRunning(running) {
        generateBtn.disabled = running;
        randomSeedBtn.disabled = running;
        cancelBtn.classList.toggle("hidden", !running);
        // Queried per call: the operator checkboxes are built at startup.
        document.querySelectorAll(".params input, .params select").forEach(function(input) {
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
        statusRow.classList.add("hidden");
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
            points: generation.points,
            curve: generation.curve,
            domain: [run.options.domain.xMin, run.options.domain.xMax]
        };
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
            curve: result.curve,
            domain: [run.options.domain.xMin, run.options.domain.xMax]
        };
        statusRow.classList.add("hidden");
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

        var spec = targetSpec();
        saveHashOptions(options, spec);
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
        statusRow.classList.add("hidden");
        statusRow.textContent = "";

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
            target: spec
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

        statusRow.textContent = run.latestGeneration > 0
            ? "Cancelled after generation " + run.latestGeneration + "."
            : "Evolution cancelled.";
        statusRow.classList.remove("hidden");
    }

    /** Rolls a fresh run seed. Leaves a kept target alone; otherwise drops a
     *  one-shot target seed pinned by a shared link so the next run asks a
     *  new question. The last drawn target stays available if Keep is turned on. */
    function randomizeSeeds() {
        seedInput.value = randomSeed();
        clearValidity(seedInput);
        if (!keepingTarget()) pendingTargetSeed = null;
    }

    generateBtn.addEventListener("click", generate);
    cancelBtn.addEventListener("click", cancel);
    randomSeedBtn.addEventListener("click", randomizeSeeds);
    keepTargetInput.addEventListener("change", function() {
        syncSeedHint();
        updateGenerateLabel();
    });
    themeToggle.addEventListener("click", function() {
        applyTheme(currentTheme() === "light" ? "dark" : "light", true);
    });
    targetSelect.addEventListener("change", function() {
        lastTargetSeed = null;
        pendingTargetSeed = null;
        syncControls(true);
    });
    numericInputs.forEach(function(input) {
        input.addEventListener("input", function() {
            clearValidity(input);
        });
    });
    customTargetInput.addEventListener("input", function() {
        clearValidity(customTargetInput);
    });

    asciiToggleBtn.addEventListener("click", function() {
        showAscii = !showAscii;
        render();
    });

    if (window.ResizeObserver) {
        new ResizeObserver(function() {
            if (lastPlot) drawFitPlot(lastPlot.points, lastPlot.curve);
        }).observe(fitPlot);
    } else {
        window.addEventListener("resize", function() {
            if (lastPlot) drawFitPlot(lastPlot.points, lastPlot.curve);
        });
    }

    buildTargetOptions();
    buildOpChecks(targetOpsGroup, DEFAULT_TARGET_OPS);
    buildOpChecks(searchOpsGroup, DEFAULT_SEARCH_OPS);
    [targetOpsGroup, searchOpsGroup].forEach(function(group) {
        group.addEventListener("change", function(event) {
            clearValidity(event.target);
        });
    });
    applyTheme(preferredTheme(), false);
    if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function() {
            try {
                if (localStorage.getItem(THEME_KEY) === "light" || localStorage.getItem(THEME_KEY) === "dark") {
                    return;
                }
            } catch (error) {}
            applyTheme(preferredTheme(), false);
        });
    }
    syncControls(true);
    var hasHashDomain = applyHashOptions();
    syncControls(!hasHashDomain);
    render();
});
