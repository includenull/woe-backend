export default class BackgroundWorker {
	constructor(name, maxWorker, callback) {
		this.name = name
		this.maxWorker = Number(maxWorker)
		this.callback = callback
		this.stopped = false
	}
	async start() {
		console.log('Starting '+this.maxWorker+' '+this.name);
		this.stopped = false
		for(let i = 0; i < this.maxWorker; ++i)
			this.run(this.name+i)

  	return true;
	}

	async run(id) {
		while(true && !this.stopped) {
			//console.log('Run worker '+id)
			await this.do(id)
		}
	}

	async stop() {
		this.stopped = true
		console.log('Worker '+this.name+' stopped')
	}

	async do(id) {
		return await this.callback(id);
	}
}