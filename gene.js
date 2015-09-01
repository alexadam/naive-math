"use strict";

Array.prototype.random = function() {
    return this[Math.floor((Math.random() * this.length))];
}

////////////

var rules1 = {
    nodeTypes: {
        'add': 2,
        'sub': 2,
        'mul': 2,
        'div': 2,
        'pow': 2,
        'neg': 1,
        'sin': 1,
        'atom': 0
    },
    nodeRules: {
        'start': ['add', 'sub', 'mul', 'div', 'pow', 'neg', 'sin'],
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
        'neg': ['neg', 'sin'],
        'sin': ['neg', 'sin'],
        'atom': ['atom']
    }
};


var rules_e = {
    nodeTypes: {
        'add': 2,
        'sub': 2,
        'mul': 2,
        'div': 2,
        'pow': 2,
        'neg': 1,
        'sin': 1,
        'atom_e': 0,
        'atom_e': 0
    },
    nodeRules: {
        'start': ['add', 'sub', 'mul', 'div', 'pow', 'neg', 'sin'],
        'end': ['atom_e', 'atom_e']
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
        'neg': ['neg', 'sin'],
        'sin': ['neg', 'sin'],
        'atom_e': ['atom_e', 'atom_e'],
        'atom_e': ['atom_e', 'atom_e']
    }
};

var rules_pi = {
    nodeTypes: {
        'add': 2,
        'sub': 2,
        'mul': 2,
        'div': 2,
        'pow': 2,
        'neg': 1,
        'sin': 1,
        'atom_pi': 0,
        'atom_pi': 0
    },
    nodeRules: {
        'start': ['add', 'sub', 'mul', 'div', 'pow', 'neg', 'sin'],
        'end': ['atom_pi', 'atom_pi']
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
        'neg': ['neg', 'sin'],
        'sin': ['neg', 'sin'],
        'atom_pi': ['atom_pi', 'atom_pi'],
        'atom_pi': ['atom_pi', 'atom_pi']
    }
};



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

        if (this.type === 'atom_e') {
            return 2.71828183;
        }

        if (this.type === 'atom_pi') {
            return 3.14159265;
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
            if (tmp === 0) {
                return 0;
            }
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
    }

    this.evalToStr = function() {
        if (this.type === 'atom') {
            return this.value;
        }

        if (this.type === 'atom_e') {
            return 2.71828183;
        }

        if (this.type === 'atom_pi') {
            return 3.14159265;
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
    }

    this.copy = function() {
        var newNode = new Node(rules1, this.type);
        newNode.setValue(this.value);
        newNode.setParent(this.parent);

        for (var i = 0; i < this.arity; i++) {
            var child = this.getChild(i).copy();
            newNode.setChild(i, child);
        }

        return newNode;
    }
}

function createNodeList(node, list) {
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

function createRandomNode(rules, rule, index, maxLen) {
    var type = rules.nodeRules[rule].random();
    var nextRule = rules.rulesOrder[rule].random();

    if (index >= maxLen) {
        nextRule = 'end';
    }

    var nn = new Node(rules, type);

    if (type == 'atom') {
        nn.setValue(Math.floor(Math.random() * 10));
    }

    if (type === 'atom_e') {
        nn.setValue(2.71828183);
    }

    if (type === 'atom_pi') {
        nn.setValue(3.14159265);
    }

    if (nextRule !== '') {
        for (var i = 0; i < nn.getArity(); i++) {
            index++;
            nn.setChild(i, createRandomNode(rules, nextRule, index, maxLen));
        }
    }

    return nn;
}

function Expression(rootNode) {
    this.rootNode = rootNode;
    this.fitness = 0;
    this.targetValue = 0;
    this.nodeList = [];

    this.getRootNode = function() {
        return this.rootNode;
    }

    this.createRandomExpression = function(maxLen, rules) {
        this.rootNode = createRandomNode(rules, 'start', 0, maxLen);
        return this;
    }

    this.getNodeList = function() {
        this.nodeList = [];
        createNodeList(this.rootNode, this.nodeList);
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
        this.fitness = Math.abs(targetValue - evalResult);
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
            node.setValue(Math.floor(Math.random() * 10));
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

}

function Pool() {
    this.elements = [];
    this.bestElements = [];

    var gg = new GeneticHelper();
    var that = this;

    this.appendElements = function(newElements) {
        this.elements = this.elements.concat(newElements);
        return this;
    }

    this.getElements = function() {
        return this.elements;
    }

    this.mutate = function(rules, rate) {
        if (this.elements.length === 0) {
            return;
        }

        this.elements.forEach(function(element) {
            if (Math.random() < rate) {
                gg.mutate(rules, element);
            }
        });

        return this;
    }

    this.newGeneration = function(nrOfChildren, mutationFactor, rules) {
        if (this.elements.length < 2) {
            return;
        }

        for (var i = 0; i < nrOfChildren; i++) {
            var elem1 = this.elements.random().copy();
            var elem2 = this.elements.random().copy();

            gg.crossover(elem1, elem2);

            if (Math.random() < mutationFactor) {
                gg.mutate(rules, elem1);
            }

            this.elements.push(elem1);
        }
        return this;
    }

    this.addRandomElements = function(nrOfElements, maxExprLength, rules) {
        for (var i = 0; i < nrOfElements; i++) {
            var nex = new Expression().createRandomExpression(maxExprLength, rules);
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

function Evolve(targetValue, error) {
    // 1. create random pool
    // 2. evaluate
    // 3. get best of them; also add to best of best
    // 4. crossover and mutate the best
    //

    var allBestElements = [];


}

function EvolutionStep(targetValue, error, rules) {
    var bestElements = [];
    var bestFitness = 0;
    var genetic = new GeneticHelper();

    var gen = new Pool();
    gen.addRandomElements(1000, 30, rules_pi);
    // bestElements = bestElements.concat(gen.evalTarget(3.1415 * 2.71, 0.14));
    // bestElements = bestElements.concat(gen.evalTarget(23.14, 1.14));
    // bestElements = bestElements.concat(gen.evalTarget(24.14 / 22.14, 0.05));
    bestElements = bestElements.concat(gen.evalTarget(targetValue, error));

    for (var i = 0; i < 10; i++) {
        var tmpGen = new Pool();
        tmpGen.appendElements(bestElements);
        tmpGen.newGeneration(1000, 0.2, rules);
        bestElements = bestElements.concat(tmpGen.evalTarget(targetValue, error));
    }

    genetic.sort(bestElements);

    console.log(bestElements[0].evalToStr(), bestElements[0].eval(), bestElements[0].getFitness());

    return mathPrint(bestElements[0]);

}

function mathPrint(elem) {
    var result = elem.evalToStr();
    result = result.replace(/\+\-/g, '-');
    result = result.replace(/\+\+/g, '+');
    result = result.replace(/\-\-/g, '+');
    result = result.replace(/3\.14159265/g, 'pi');
    result = result.replace(/2\.71828183/g, 'e');

    return '`' + result + '`';
}

function generateLeftExpression() {
    var gen = new Pool();
    gen.addRandomElements(1000, 5, rules_e);
    var elems = gen.getElements();
    var leftElem = null;

    elems.forEach(function(elem) {
        if (elem.getNodeList().length > 5 && leftElem === null && !isNaN(elem.eval())) {
            leftElem = elem;
        }
        // console.log(elem.evalToStr());
    });

    console.log(leftElem.eval());

    return leftElem;
}


var paramsEx = {
    targetValue: 0,
    errorPercent: 1,
    maxExprLength: 10,
    mutationRate: 0.2,
    maxNrGenerations: 1000,
    rules: rules_e
};

function Genetic(params) {
    // genetic -> pool -> expressions -> nodes
}

function main() {
    // var expr = new Node('add');
    // var expr1 = new Node('mul');
    //
    // var expr2 = new Node('atom').setValue(7);
    // var expr3 = new Node('atom').setValue(2);
    // var expr4 = new Node('atom').setValue(3);
    //
    // expr1.setChild(0, expr3);
    // expr1.setChild(1, expr4);
    // expr.setChild(0, expr1);
    // expr.setChild(1, expr2);
    //
    // var ex = new Expression(expr);
    //
    // console.log('1', ex.evalToStr());
    //
    // var gigi = new GeneticHelper();
    // gigi.recurse(ex, 5);
    //
    // console.log('1', ex.evalToStr());

    ///////////////////////////////////////////////


    // var ex2 = new Expression();
    // ex2.createRandomExpression(20);
    //
    // console.log(ex2.evalToStr(), ex2.eval());
    //
    // var ex3 = new Expression().createRandomExpression(20);
    // console.log(ex3.evalToStr(), ex3.eval());
    //
    // var gigi = new GeneticHelper();
    // gigi.mutate(ex3);
    // gigi.crossover(ex2, ex3);
    //
    // console.log(ex3.evalToStr(), ex3.eval());
    // console.log(ex2.evalToStr(), ex2.eval());
    //
    // console.log('-=-=-=-=-=');


    // var bestElements = [];
    //
    // for (var i = 0; i < 10; i++) {
    //     var gen = new Pool();
    //     gen.addRandomElements(500, 30);
    //     // bestElements = bestElements.concat(gen.evalTarget(3.1415 * 2.71, 0.14));
    //     // bestElements = bestElements.concat(gen.evalTarget(23.14, 1.14));
    //     bestElements = bestElements.concat(gen.evalTarget(24.14 / 22.14, 0.05));
    // }
    //
    // gigi.sort(bestElements);
    //
    // bestElements.forEach(function(elem) {
    //     console.log(elem.evalToStr(), elem.eval(), elem.getFitness());
    //     //gigi.recurse(elem, 1);
    //     //console.log('RECURSE', elem.evalToStr(), elem.eval(), elem.evalTarget(3.1415*2.71));
    // });
    //
    // var gen2 = new Pool();
    // gen2.appendElements(bestElements);
    // gen2.newGeneration(500);
    //
    // // bestElements = bestElements.concat(gen2.evalTarget(3.1415 * 2.71, 0.14));
    // // bestElements = bestElements.concat(gen2.evalTarget(23.14, 0.14));
    // bestElements = bestElements.concat(gen2.evalTarget(24.14 / 22.14, 0.05));
    // gigi.sort(bestElements);
    // console.log('@@@@@@@@@@ GEN 2');
    // bestElements.forEach(function(elem) {
    //     console.log(elem.evalToStr(), elem.eval(), elem.getFitness());
    //     //gigi.recurse(elem, 1);
    //     //console.log('RECURSE', elem.evalToStr(), elem.eval(), elem.evalTarget(3.1415*2.71));
    // });
    //
    // // gigi.recurse(bestElements[0], 4);
    //
    // var result = bestElements[0].evalToStr();
    // result = result.replace(/\+\-/g, '-');
    // result = result.replace(/\+\+/g, '+');
    // result = result.replace(/\-\-/g, '+');
    // result = result.replace(/3\.1415/g, 'pi');
    // result = result.replace(/2\.71/g, 'e');
    //
    // return '`' + result + '`';

    var leftElem = generateLeftExpression();
    var leftElemVal = leftElem.eval();

    return [mathPrint(leftElem), EvolutionStep(leftElemVal, 0.05, rules_pi)];
}
