import SubIndexer from './SubIndexer.js'

export default class AlcorPositionsSubIndexer extends SubIndexer {
	constructor(getRpcIndexer, updateSync) {
		super(getRpcIndexer, updateSync)
	}

	async fetchRows(scopes = ['*']) {
		const pools = this.getRpcIndexer().poolV3Map.getAllPools()
		console.log(pools.length + ' pools V3 - positions scope to track')
		return await this.scopesFetchRows(pools.map(p => p.id))
	}
}