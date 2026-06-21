/**
 * Example usage
  const optimalBidSplit = optimize(pool0, pool1, 0.1, 1000);
	console.log("Optimal bid split:", optimalBidSplit);
 */

// Define the iter optimization parameters
const maxSteps = 10000; // security to avoid infinite computation
const stepPrecision = 1000; //500; // bigger is more precise 1000 = 0.1% 10000 = 0.01%

export default class Binarysearch {
  // Create the objective function for optimization
  static async objectiveIter(getAmountsOutOfRoute, allocation, bid, routes) {
    // Calculate the result using the functions and percentages
    const inputs = [];
    const outputs = [];
    for (let i = 0; i < routes.length; ++i) {
      const input = (bid * allocation[i]) / stepPrecision;
      inputs.push(input);
      const amountsOut = await getAmountsOutOfRoute(routes[i], input);
      outputs.push(amountsOut[amountsOut.length - 1]);
    }

    return { inputs, outputs };
  }

  static async findMaxOutputIter(getAmountsOutOfRoute, routes, bid) {
    // Initial allocation
    const allocation = routes.map((_r) => 0);
    const inputs = routes.map((_r) => 0);
    const outputs = routes.map((_r) => 0);

    let i = 0;
    let totalIncrement = 0;
    while (i < maxSteps && totalIncrement < stepPrecision) {
      const stepIncrement = Math.max(
        1,
        Math.floor((stepPrecision - totalIncrement) / (2 * routes.length)),
      );
      const candidateResults = await Binarysearch.objectiveIter(
        getAmountsOutOfRoute,
        allocation.map((a) => a + stepIncrement),
        bid,
        routes,
      );
      const diff = candidateResults.outputs.map((r, i) => r - outputs[i]);
      const diffIndex = diff.indexOf(Math.max(...diff));

      allocation[diffIndex] += stepIncrement;
      inputs[diffIndex] = candidateResults.inputs[diffIndex];
      outputs[diffIndex] = candidateResults.outputs[diffIndex];
      ++i;
      totalIncrement += stepIncrement;
    }

    return {
      //allocation,
      inputs,
      outputs,
    };
  }
}
