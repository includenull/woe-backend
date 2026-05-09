export default class ArrayProcessor {
  constructor(func, numWorkers = 4) {
    this.func = func;
    this.numWorkers = numWorkers;
  }

  async processArray(array) {
    const arrayLength = array.length;
    const chunkSize = Math.ceil(arrayLength / this.numWorkers);

    const promises = [];

    for (let i = 0; i < this.numWorkers; i++) {
      const startIndex = i * chunkSize;
      const endIndex = Math.min(startIndex + chunkSize, arrayLength);

      const chunk = array.slice(startIndex, endIndex);

      promises.push(this.func(chunk));
    }

    const results = await Promise.all(promises);

    return results.flat();
  }
}