import express from 'express';

export default class ApiKlines {
	constructor() {
		this.isReady = false;
		this.api = undefined
	}

	setReady(bool) {
		this.isReady = bool
	}

	async start() {
		this.api = express()

		this.api.use(function(req, res, next) {
		  res.header("Access-Control-Allow-Origin", "*");
		  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
		  next();
		});

		this.api.get('/status', async (req, res) => {
			res.send({'ready': this.isReady})
		});

		this.api.listen(8210, () => {
			console.log('Klines API listening on port 8210!')
		});
	}
}