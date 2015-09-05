"use strict";

Array.prototype.random = function() {
    return this[Math.floor((Math.random() * this.length))];
}

////////////

var rules_all = {
    nodeTypes: {
        'add': 2,
        'sub': 2,
        'mul': 2,
        'div': 2,
        'pow': 2,
        'neg': 1,
        'sin': 1,
        'cos': 1,
        'log': 1,
        'atom': 0
    },
    nodeRules: {
        'start': ['add', 'sub', 'mul', 'div', 'pow', 'neg', 'sin', 'cos', 'log'],
        'end': ['atom']
    },
    rulesOrder: {
        'start': ['start', 'end'],
        'end': ['']
    },
    mutationRules: {
        'add': ['add', 'sub', 'mul', 'div', 'pow'],
        'sub': ['add', 'sub', 'mul', 'div', 'pow'],
        'mul': ['add', 'sub', 'mul', 'div', 'pow'],
        'div': ['add', 'sub', 'mul', 'div', 'pow'],
        'pow': ['add', 'sub', 'mul', 'div', 'pow'],
        'neg': ['neg', 'sin', 'cos', 'log'],
        'sin': ['neg', 'sin', 'cos', 'log'],
        'cos': ['neg', 'sin', 'cos', 'log'],
        'log': ['neg', 'sin', 'cos', 'log'],
        'atom': ['atom']
    },
    values: {
        atom: ['randInt:10', '3.14159265', '2.71828183', '1.61803398']
    }
};

var pi = '3.14159265';
var e = '2.71828183';
var phi = '1.61803398';

function createRules(values) {
    return {
        nodeTypes: {
            'add': 2,
            'sub': 2,
            'mul': 2,
            'div': 2,
            'pow': 2,
            'neg': 1,
            'sin': 1,
            'cos': 1,
            'log': 1,
            'atom': 0
        },
        nodeRules: {
            'start': ['add', 'sub', 'mul', 'div', 'pow', 'neg', 'sin', 'cos', 'log'],
            'end': ['atom']
        },
        rulesOrder: {
            'start': ['start', 'end'],
            'end': ['']
        },
        mutationRules: {
            'add': ['add', 'sub', 'mul', 'div', 'pow'],
            'sub': ['add', 'sub', 'mul', 'div', 'pow'],
            'mul': ['add', 'sub', 'mul', 'div', 'pow'],
            'div': ['add', 'sub', 'mul', 'div', 'pow'],
            'pow': ['add', 'sub', 'mul', 'div', 'pow'],
            'neg': ['neg', 'sin', 'cos', 'log'],
            'sin': ['neg', 'sin', 'cos', 'log'],
            'cos': ['neg', 'sin', 'cos', 'log'],
            'log': ['neg', 'sin', 'cos', 'log'],
            'atom': ['atom']
        },
        values: {
            atom: values
        }
    };
}



function Node(rules, type) {
    this.children = [];

    this.type = type;
    this.arity = rules.nodeTypes[type];
    this.parent = null;

    this.getParent = function() {
        return this.parent;
    }

    this.setParent = function(parent) {
        this.parent = parent;
    }

    this.getType = function() {
        return this.type;
    }

    this.setType = function(type) {
        this.type = type;
        return this;
    }

    this.getArity = function() {
        return this.arity;
    }

    this.setValue = function(value) {
        this.value = value;
        return this;
    }

    this.getValue = function() {
        return this.value;
    }

    this.setChild = function(index, child) {
        if (index >= this.arity) {
            return;
        }
        child.setParent(this);
        this.children[index] = child;
        return this;
    }

    this.setChildren = function(children) {
        this.children = children;
        return this;
    }

    this.getChild = function(index) {
        if (index >= this.arity) {
            return null;
        }
        return this.children[index];
    }

    this.getChildren = function() {
        return this.children;
    }

    this.eval = function() {
        if (this.type === 'atom') {
            return this.value;
        }

        if (this.type === 'add') {
            return this.children[0].eval() + this.children[1].eval();
        }

        if (this.type === 'sub') {
            return this.children[0].eval() - this.children[1].eval();
        }

        if (this.type === 'mul') {
            return this.children[0].eval() * this.children[1].eval();
        }

        if (this.type === 'div') {
            var tmp = this.children[1].eval();
            // if (tmp === 0) { TODO
            //     return 0;
            // }
            return this.children[0].eval() / tmp;
        }

        if (this.type === 'pow') {
            return Math.pow(this.children[0].eval(), this.children[1].eval());
        }

        if (this.type === 'neg') {
            return -(this.children[0].eval());
        }

        if (this.type === 'sin') {
            return Math.sin(this.children[0].eval());
        }

        if (this.type === 'cos') {
            return Math.cos(this.children[0].eval());
        }

        if (this.type === 'log') {
            return Math.log(this.children[0].eval());
        }
    }

    this.evalToStr = function() {
        if (this.type === 'atom') {
            return this.value;
        }

        if (this.type === 'add') {
            return '(' + this.children[0].evalToStr() + '+' + this.children[1].evalToStr() + ')';
        }

        if (this.type === 'sub') {
            return '(' + this.children[0].evalToStr() + '-' + this.children[1].evalToStr() + ')';
        }

        if (this.type === 'mul') {
            return '(' + this.children[0].evalToStr() + '*' + this.children[1].evalToStr() + ')';
        }

        if (this.type === 'div') {
            return '(' + this.children[0].evalToStr() + '/' + this.children[1].evalToStr() + ')';
        }

        if (this.type === 'pow') {
            return '(' + this.children[0].evalToStr() + '^' + this.children[1].evalToStr() + ')';
        }

        if (this.type === 'neg') {
            return '(-' + this.children[0].evalToStr() + ')';
        }

        if (this.type === 'sin') {
            return 'sin(' + this.children[0].evalToStr() + ')';
        }

        if (this.type === 'cos') {
            return 'cos(' + this.children[0].evalToStr() + ')';
        }

        if (this.type === 'log') {
            return 'log(' + this.children[0].evalToStr() + ')';
        }
    }

    this.copy = function() {
        var newNode = new Node(rules, this.type);
        newNode.setValue(this.value);
        newNode.setParent(this.parent);

        for (var i = 0; i < this.arity; i++) {
            var child = this.getChild(i).copy();
            newNode.setChild(i, child);
        }

        return newNode;
    }
}

function Expression(rootNode) {
    this.rootNode = rootNode;
    this.fitness = 0;
    this.targetValue = 0;
    this.nodeList = [];
    this.helper = new GeneticHelper();

    this.getRootNode = function() {
        return this.rootNode;
    }

    this.createRandomExpression = function(maxLen, rules, startRule) {
        this.rootNode = this.helper.createRandomNode(rules, startRule, 0, maxLen);
        return this;
    }

    this.getNodeList = function() {
        this.nodeList = [];
        this.helper.createNodeList(this.rootNode, this.nodeList);
        return this.nodeList;
    }

    this.eval = function() {
        if (this.rootNode === null || this.rootNode === undefined) {
            return 0;
        }
        return this.rootNode.eval();
    }

    this.evalToStr = function() {
        if (this.rootNode === null || this.rootNode === undefined) {
            return 0;
        }
        return this.rootNode.evalToStr();
    }

    this.evalTarget = function(targetValue) {
        this.targetValue = targetValue;
        var evalResult = this.eval();
        this.fitness = Math.abs(Math.abs(targetValue) - Math.abs(evalResult));
        return this.fitness;
    }

    this.setTarget = function(targetValue) {
        this.targetValue = targetValue;
        return this;
    }

    this.getFitness = function() {
        return this.fitness;
    }

    this.copy = function() {
        return new Expression(this.rootNode.copy());
    }

}

function Pool() {
    this.elements = [];
    this.bestElements = [];
    this.newElements = [];

    var helper = new GeneticHelper();
    var that = this;

    this.appendElements = function(newElements) {
        this.elements = this.elements.concat(newElements);
        return this;
    }

    this.getElements = function() {
        return this.elements;
    }

    this.getNewElements = function() {
        return this.newElements;
    }

    this.newGeneration = function(nrOfChildren, mutationFactor, rules) {
        if (this.elements.length < 2) {
            return;
        }

        this.newElements = [];

        for (var i = 0; i < nrOfChildren; i++) {
            var elem1 = this.elements.random().copy();
            var elem2 = this.elements.random().copy();

            helper.crossover(elem1, elem2);

            if (Math.random() < mutationFactor) {
                helper.mutate(rules, elem1);
            }

            this.newElements.push(elem1);
        }
        return this;
    }

    this.addRandomElements = function(nrOfElements, maxExprLength, rules) {
        for (var i = 0; i < nrOfElements; i++) {
            var nex = new Expression().createRandomExpression(maxExprLength, rules, 'start');
            // gg.recurse(nex, 4); TODO
            this.elements.push(nex);
        }
        return this;
    }

    this.evalTarget = function(targetValue, threshold) {
        this.elements.forEach(function(elem) {
            var fitness = elem.evalTarget(targetValue);
            if (Math.abs(fitness) < threshold) {
                that.bestElements.push(elem);
            }
        });
        return this.bestElements;
    }

}

function EvolutionStep(params, withElements) {
    var bestElements = [];
    var newGeneration = [];
    var bestFitness = 0;
    var genetic = new GeneticHelper();
    var error = params.targetValue * params.errorPercent / 100;
    var gen = new Pool();

    if (withElements === undefined || withElements === null || withElements.length === 0) {
        gen.addRandomElements(params.newGenerationNrOfChildren, params.mutationRate, params.rules);
    } else {
        gen.appendElements(withElements);
    }

    var topElems = gen.evalTarget(params.targetValue, error);
    if (topElems.length > 0) {
        bestElements.push(topElems[0]);
    }

    newGeneration = newGeneration.concat(gen.getElements());

    for (var i = 0; i < params.maxNrGenerations; i++) {
        gen = new Pool();
        gen.appendElements(newGeneration);
        gen.newGeneration(params.newGenerationNrOfChildren, params.mutationRate, params.rules);

        newGeneration = [];
        newGeneration = newGeneration.concat(gen.getNewElements());

        topElems = gen.evalTarget(params.targetValue, error);
        if (topElems.length > 0) {
            bestElements.push(topElems[0]);
        }

    }

    if (bestElements.length === 0) {
        var tmpElems = gen.getElements();
        genetic.sort(tmpElems);
        bestElements.push(tmpElems[0]);
    }

    return bestElements;

}

function Evolve(params) {
    var bestElements = [];
    var genetic = new GeneticHelper();

    for (var i = 0; i < 100; i++) {
        bestElements = bestElements.concat(EvolutionStep(params));
    }

    genetic.sort(bestElements);

    var result = {
        eval: bestElements[0].eval(),
        strEval: bestElements[0].evalToStr(),
        mathExprEval: mathPrint(bestElements[0]),
        error: bestElements[0].getFitness()
    };

    bestElements = bestElements.concat(EvolutionStep(params, bestElements));

    genetic.sort(bestElements);

    var result = {
        eval: bestElements[0].eval(),
        strEval: bestElements[0].evalToStr(),
        mathExprEval: mathPrint(bestElements[0]),
        error: bestElements[0].getFitness()
    };

    return result;
}



function GeneticHelper() {

    this.crossover = function(expression1, expression2) {
        var node1 = expression1.getNodeList().random();

        var parent1 = node1.getParent();
        if (parent1 === null || parent1 === undefined) {
            parent1 = node1;
        }

        var arity1 = parent1.getArity();
        var child1 = parent1.getChildren().random();

        //////////
        var node2 = expression2.getNodeList().random();

        var parent2 = node2.getParent();
        if (parent2 === null || parent2 === undefined) {
            parent2 = node2;
        }

        var child2 = parent2.getChildren().random();

        ////////
        child1.setChild(Math.floor(Math.random() * arity1), child2);
    };

    this.mutate = function(rules, expression) {
        var node = expression.getNodeList().random();
        var newType = rules.mutationRules[node.getType()].random();

        node.setType(newType);

        if (node.getType() === 'atom') {
            var value = rules.values.atom.random();
            var index = value.indexOf(':');

            if (index > 0) {
                var parts = value.split(':');
                var max = parseFloat(parts[1]);

                if (parts[0] === 'randInt') {
                    node.setValue(Math.floor(Math.random() * max));
                } else if (parts[0] === 'randFloat') {
                    node.setValue(Math.random() * max);
                }
            } else {
                node.setValue(parseFloat(value));
            }
        }
    }

    this.recurse = function(expression, depth) {
        var level = 0;
        var nextIndex = -1;

        if (depth === undefined) {
            depth = 1;
        }

        var originalExpr = expression.getRootNode().copy();
        var nodeListOrig = expression.getNodeList();
        var totalNodesOrig = nodeListOrig.length;

        while (level < depth) {
            var nodeList = expression.getNodeList();
            var totalNodes = nodeList.length;

            if (totalNodes < 3) {
                return;
            }

            if (level === 0) {
                for (var i = 0; i < 10; i++) { //TODO
                    nextIndex = Math.floor(Math.random() * totalNodes);
                    if (nextIndex !== 0 && nodeList[nextIndex].getArity() !== 0) {
                        break;
                    }
                }
            }
            nextIndex += (level > 0 ? totalNodesOrig - 1 : 0)

            var node = nodeList[nextIndex];

            if (node !== undefined) {
                node.setChild(0, originalExpr.copy());
            }

            level++;
        }
    }

    this.sort = function(exprArr) {
        exprArr.sort(function(a, b) {
            return a.getFitness() - b.getFitness();
        });
    }

    this.createRandomNode = function (rules, rule, index, maxLen) {
        var type = rules.nodeRules[rule].random();
        var nextRule = rules.rulesOrder[rule].random();

        if (index >= maxLen) {
            nextRule = 'end';
        }

        var nn = new Node(rules, type);

        if (type == 'atom') {
            var value = rules.values.atom.random();
            var index = value.indexOf(':');

            if (index > 0) {
                var parts = value.split(':');
                var max = parseFloat(parts[1]);

                if (parts[0] === 'randInt') {
                    nn.setValue(Math.floor(Math.random() * max));
                } else if (parts[0] === 'randFloat') {
                    nn.setValue(Math.random() * max);
                }
            } else {
                nn.setValue(parseFloat(value));
            }
        }

        if (nextRule !== '') {
            for (var i = 0; i < nn.getArity(); i++) {
                index++;
                nn.setChild(i, this.createRandomNode(rules, nextRule, index, maxLen));
            }
        }

        return nn;
    }

    this.createNodeList = function (node, list) {
        var tmpList = [];
        tmpList.push(node);
        while (tmpList.length > 0) {
            var nextNode = tmpList.splice(0, 1)[0];
            list.push(nextNode);
            for (var i = 0; i < nextNode.getArity(); i++) {
                tmpList.push(nextNode.getChild(i));
            }
        }
    }

}

function mathPrint(elem) {
    var result = elem.evalToStr();
    result = result.replace(/\+\-/g, '-');
    result = result.replace(/\+\+/g, '+');
    result = result.replace(/\-\-/g, '+');
    result = result.replace(/3\.14159265/g, 'pi');
    result = result.replace(/2\.71828183/g, 'e');
    result = result.replace(/1\.61803398/g, 'phi');

    return '`' + result + '`';
}

function generateLeftExpression(rules) {

    var gen = new Pool();
    gen.addRandomElements(1000, 5, rules);
    var elems = gen.getElements();
    var leftElem = null;

    elems.forEach(function(elem) {
        if (elem.getNodeList().length > 5 && leftElem === null) {
            var res = elem.eval()
            if (!isNaN(res) && isFinite(res) && res !== 0) {
                leftElem = elem;
            }
        }
    });

    var result = {
        eval: leftElem.eval(),
        strEval: leftElem.evalToStr(),
        mathExprEval: mathPrint(leftElem),
        error: 0
    };


    return result;

}


function main() {
    var leftElem = generateLeftExpression();
    var leftElemVal = leftElem.eval;

    var params = {
        targetValue: leftElemVal,
        errorPercent: 1,
        maxExprLength: 30,
        mutationRate: 0.2,
        minNrGenerations: 10,
        maxNrGenerations: 20,
        newGenerationNrOfChildren : 1000,
        rules: rules_pi_nr
    };

    var res = Evolve(params);

    console.log(leftElem, res);

    return [leftElem.mathExprEval, res.mathExprEval];
}
