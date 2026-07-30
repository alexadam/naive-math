document.addEventListener("DOMContentLoaded", function() {
    "use strict";

    var generateBtn = document.getElementById("generateBtn");
    var asciiToggleBtn = document.getElementById("asciiToggleBtn");

    var leftMathExpr = document.getElementById("leftMathExpr");
    var rightMathExpr = document.getElementById("rightMathExpr");

    var progressRow = document.getElementById("progressRow");
    var valuesRow = document.getElementById("valuesRow");
    var asciiRow = document.getElementById("asciiRow");

    var leftAbsVal = document.getElementById("leftAbsVal");
    var rightAbsVal = document.getElementById("rightAbsVal");
    var errorVal = document.getElementById("errorVal");

    var leftAsciiText = document.getElementById("leftAsciiText");
    var rightAsciiText = document.getElementById("rightAsciiText");

    var errorPercentInput = document.getElementById("errorPercentInput");
    var mutationRateInput = document.getElementById("mutationRateInput");
    var generationsInput = document.getElementById("generationsInput");
    var populationSizeInput = document.getElementById("populationSizeInput");

    var leftExpr = null;
    var rightExpr = null;
    var showAscii = false;

    function absVal(value) {
        return Math.abs(value);
    }

    function setMathContent(el, value) {
        el.innerHTML = "";
        var content = document.createElement("p");
        content.innerHTML = value === undefined ? "" : value;
        el.appendChild(content);
    }

    function render() {
        setMathContent(leftMathExpr, leftExpr ? "`" + leftExpr.mathExprEval + "`" : "?");
        setMathContent(rightMathExpr, rightExpr ? "`" + rightExpr.mathExprEval + "`" : "?");

        if (window.MathJax) {
            MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
        }

        if (leftExpr && rightExpr) {
            valuesRow.classList.remove("hidden");
            asciiRow.classList.remove("hidden");

            leftAbsVal.textContent = absVal(leftExpr.eval);
            rightAbsVal.textContent = absVal(rightExpr.eval);
            errorVal.textContent = rightExpr.error;

            leftAsciiText.textContent = leftExpr.strEval;
            rightAsciiText.textContent = rightExpr.strEval;

            leftAsciiText.classList.toggle("hidden", !showAscii);
            rightAsciiText.classList.toggle("hidden", !showAscii);

            asciiToggleBtn.textContent = showAscii ? "Hide" : "As Text";
        } else {
            valuesRow.classList.add("hidden");
            asciiRow.classList.add("hidden");
        }
    }

    function generate() {
        progressRow.classList.remove("hidden");

        setTimeout(function() {
            var gp = GP.createEngine({
                errorPercent: parseFloat(errorPercentInput.value),
                mutationRate: parseFloat(mutationRateInput.value),
                generations: parseInt(generationsInput.value, 10),
                populationSize: parseInt(populationSizeInput.value, 10)
            });

            var target = gp.randomTarget();
            leftExpr = {
                eval: target.value,
                mathExprEval: target.expr,
                strEval: target.expr
            };

            var result = gp.evolve(target.value);
            rightExpr = {
                eval: result.value,
                mathExprEval: result.expr,
                strEval: result.expr,
                error: result.error
            };

            progressRow.classList.add("hidden");
            render();
        }, 100);
    }

    generateBtn.addEventListener("click", generate);

    asciiToggleBtn.addEventListener("click", function() {
        showAscii = !showAscii;
        render();
    });

    render();
});
