import logger from '@utils/logger.js';
export default class BackgroundWorker {
	constructor(name, maxWorker, callback) {
		this.name = name
		this.maxWorker = Number(maxWorker)
		this.callback = callback
		this.stopped = false
	}
	async start() {
		logger.info('Starting '+this.maxWorker+' '+this.name);
		this.stopped = false
		for(let i = 0; i < this.maxWorker; ++i)
			this.run(this.name+i)

  	return true;
	}

	async run(id) {
		while(true && !this.stopped) {
			await this.do(id)
		}
	}

	async stop() {
		this.stopped = true
		logger.info('Worker '+this.name+' stopped')
	}

	async do(id) {
		return await this.callback(id);
	}
}