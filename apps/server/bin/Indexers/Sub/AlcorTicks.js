import SubIndexer from './SubIndexer.js'
import logger from '@utils/logger.js';

export default class AlcorTicksSubIndexer extends SubIndexer {
	constructor(getRpcIndexer, updateSync) {
		super(getRpcIndexer, updateSync)
	}

	async fetchRows(scopes = ['*']) {
		const pools = this.getRpcIndexer().poolV3Map.getAllPools()
		logger.info(pools.length + ' pools V3 - ticks scope to track')
		return await this.scopesFetchRows(pools.map(p => p.id))
	}
}