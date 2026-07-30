# naive-math

Symbolic regression with genetic programming: evolve an expression that matches a
target function of `x`.

The terminal set is `x` plus the named constants `pi`, `e`, `phi` and ephemeral
random constants; the operators are `+ - * / ^ neg sin cos log`. Fitness is the
**RMS error over ~20 sampled points of x**, so a candidate has to be right across
the whole domain rather than hitting a single number by arithmetic coincidence.
That is what separates this from constant approximation — and it lets the search
rediscover real things:

| target | domain | evolved |
| --- | --- | --- |
| `sin(2x)` | `[-pi, pi]` | `sin(x+x)` |
| `e^x` | `[-2, 2]` | `e^x` |
| `sin(x)^2+cos(x)^2` | `[-pi, pi]` | `log(e)` — i.e. 1 |
| `sqrt(x)` | `[0, 4]` | `x^0.5045…` |
| `1/(1-x)` | `[-0.8, 0.8]` | `0.9989/(1-x)` |

## Usage

```js
const { createEngine, TARGETS } = require("./app/gene.js");

const gp = createEngine({ seed: 42, populationSize: 2000, generations: 200 });

// A function of x — symbolic regression.
const fit = gp.evolve(Math.sin, { xMin: -Math.PI, xMax: Math.PI });
console.log(fit.expr, fit.error);      // expression + RMS error
console.log(fit.points);               // [{ x, y, fit }] at every sample

// Raw data points work too.
gp.evolve([[0, 0], [1, 1], [2, 4], [3, 9]]).expr;   // -> (x*x)

// A plain number is the one-point case: approximate a scalar.
gp.evolve(42).expr;
```

`node app/gene.js` runs a demo of both modes. `TARGETS` holds the named target
functions used by the web app, each with the domain it is interesting on.

### Engine options

`seed`, `populationSize`, `generations`, `tournamentSize`, `elitism`,
`crossoverRate`, `mutationRate`, `subtreeMutationRate`, `minInitDepth`,
`maxInitDepth`, `maxDepth`, `parsimony`, `errorPercent`, `absoluteTolerance`,
`samples`, `xMin`, `xMax`. Selection is tournament + elitism, mutation is subtree
and arity-preserving point mutation, and bloat is controlled by a depth cap plus a
target-scaled parsimony penalty. Power, division, and log are protected against
non-finite results. Output trees are simplified before printing.

The browser exposes the PRNG seed and saves all run inputs in the URL hash. A URL
such as `#seed=42&pop=2000` restores those values, making a run shareable and
reproducible. Evolution runs in a Web Worker, streams the current best expression
and error into the page after every generation, and can be cancelled without
blocking the UI.

## Demo

https://alexadam.dev/naive-math/

## Examples:


![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex1.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex2.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex3.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex4.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex5.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex6.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex7.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex8.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex9.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex10.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex11.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex12.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex13.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex14.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex15.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex16.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex17.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex18.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex19.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex20.png)

![alt result](https://github.com/alexadam/naive-math/blob/master/examples/ex21.png)
