import SubIndexer from './SubIndexer.js'

export default class OrderbooksSubIndexer extends SubIndexer {
	constructor(getRpcIndexer, updateSync) {
		super(getRpcIndexer, updateSync)
	}

	async fetchRows() {
		const markets = this.getRpcIndexer().marketMap.getAllMarkets()
		console.log(markets.length + ' markets to track')
		return await this.scopesFetchRows(markets.map(m => m.id))
	}
}