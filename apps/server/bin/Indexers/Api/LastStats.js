import express from 'express';
import logger from '@utils/logger.js';

export default class ApiLastStats {
	constructor({
		getLastVolumes,
		getLastPriceChanges
	}) {
		this.getLastVolumes = getLastVolumes;
		this.getLastPriceChanges = getLastPriceChanges;
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

		this.api.get('/lastVolumes/:srcType', async (req, res) => {
			if(req.params.srcType !== undefined) {
				const lastVolumes = {}
				for(const duration of Object.keys(this.getLastVolumes())) {
					if(lastVolumes[duration] === undefined)
						lastVolumes[duration] = {}

					if(this.getLastVolumes()[duration][req.params.srcType] !== undefined)
						lastVolumes[duration][req.params.srcType] = this.getLastVolumes()[duration][req.params.srcType]
				}
				res.send(lastVolumes)
			} else {
				res.send(this.getLastVolumes())
			}
		});
		this.api.get('/lastVolumes', async (req, res) => {
			res.send(this.getLastVolumes())
		});

		this.api.get('/lastPriceChanges/:srcType', async (req, res) => {
			if(req.params.srcType !== undefined) {
				const lastPriceChanges = {}
				for(const duration of Object.keys(this.getLastPriceChanges())) {
					if(lastPriceChanges[duration] === undefined)
						lastPriceChanges[duration] = {}

					if(this.getLastPriceChanges()[duration][req.params.srcType] !== undefined)
						lastPriceChanges[duration][req.params.srcType] = this.getLastPriceChanges()[duration][req.params.srcType]
				}
				res.send(lastPriceChanges)
			} else {
				res.send(this.getLastPriceChanges())
			}
		});

		this.api.get('/lastPriceChanges', async (req, res) => {
			res.send(this.getLastPriceChanges())
		});

		this.api.listen(8220, () => {
			logger.info('Last stats Api listening on port 8220!')
		});
	}
}