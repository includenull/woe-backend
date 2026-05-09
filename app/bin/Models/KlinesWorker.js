import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)

import { Worker, isMainThread, workerData, parentPort } from 'worker_threads';

import KlinesIndexer from '../Indexers/Klines.js';

export default class KlinesWorker {
	constructor(name, max_workers) {
		this.name = name
		this.max_workers = Number(max_workers)
		this.works = {}
		for(let i = 0; i < this.max_workers; ++i)
			this.works[i] = null
	}

	hasAvailableWorker() {
		return Object.values(this.works).includes(null)
	}

	areAllWorkersAvailable() {
		return Object.values(this.works).reduce((acc, curr) => acc && (curr === null), true);
	}

  countAllWorkersOnWork() {
    return Object.values(this.works).filter(v => v !== null).length;
  }

	areWorkersOnWork(work_id) {
		return Object.values(this.works).includes(work_id)	
	}

	getFirstAvailableWorkerIndex() {
		return Object.values(this.works).findIndex(w => w === null)
	}

	async runWork(work_id, source) {
    const worker_index = this.getFirstAvailableWorkerIndex();
    if (worker_index === -1)
      return false;

    this.works[worker_index] = work_id;

    const worker = new Worker(__filename, {
      workerData: { workerId: this.name + worker_index, worker_index, source }
    });

		worker.on('message', (worker_index) => {
			this.works[worker_index] = null;
			worker.terminate();
		});

		return true;
  }
}

if (!isMainThread) {
  const { workerId, worker_index, source } = workerData;
  await KlinesIndexer.doSyncWork(workerId, source)
  parentPort.postMessage(worker_index);
}