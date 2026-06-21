import axios from 'axios'

import AlcorMarket from '../Exchanges/AlcorMarket.js'

import Market from './Market.js'
import MarketMatch from './Rows/MarketMatch.js'

import Token from './Token.js'

import AppConfig from '../../config.js'
import BanlistLoader from '@models/BanlistLoader.js';
import logger from '@utils/logger.js';

class MarketMapException extends Error {
	constructor({data, code}) {
		super(code)
		this.data = data
		this.code = code
	}
}

export default class MarketMap {
	constructor() {
		this.map = {},
		// Contains api data from marketsPlace to fetchPrice when we can't get them from our database
		this.apiData = {}
    this.banlistLoader = new BanlistLoader('MarketMap');
	}

	async init() {
		await this.fetchMarkets()
		await this.fetchMarketsLastPrices()
		return true
	}

	async fetchMarkets() {
		await Promise.allSettled([
			this.fetchNSaveMarkets('alcormarket')
		])
	}

	async fetchMarketsLastPrices() {
		// First get price from trades into DB
		const marketsHash = Object.keys(this.map)
		for(let i = 0; i < marketsHash.length; ++i) {
			const market = this.map[marketsHash[i]]
			let lastTrade = await MarketMatch.fetchRows({
		  	src: market.src,
		  	pair_id: market.id,
		  	limit: 1,
		  })

		  if(lastTrade.length) {
		  	lastTrade = lastTrade[0]
		  	const splitSrc = lastTrade.src.split('_')
		  	this.map[marketsHash[i]].lastSide = splitSrc[1]
		  	this.map[marketsHash[i]].lastPrice = Number(lastTrade.unit_price)
		  }
		  else {
		  	await this.fetchMarketLastPriceFromApi(marketsHash[i])
		  }
		}
	}

	async fetchApiData(src) {
		if(src === 'alcormarket') {
			const res = await axios.get('https://alcor.exchange/api/markets')
			this.apiData[src] = res.data
		}
	}

	async fetchMarketLastPriceFromApi(marketHash) {
		const market = this.map[marketHash]

		if(this.apiData[market.src] === undefined)
			await this.fetchApiData(market.src)

		if(this.apiData[market.src] !== undefined) {
			let apiMarket = this.apiData[market.src].filter(am => am.id === market.id)
			if(apiMarket.length) {
				apiMarket = apiMarket[0]
				this.map[marketHash].lastPrice = Math.floor(Math.pow(10, 8) * Number(apiMarket.last_price))
			}
		}
	}

	async fetchNSaveMarkets(src) {
		let markets = []

		if(src === 'alcormarket')
			markets = await AlcorMarket.fetchMarkets()

		this.saveMarkets(markets)
		return true
	}

	/** Refresh markets
	 * remove those who are not in the list from marketmap
	 * insert new ones into marketmap
	 * DO not replace the all marketmap like fetchMarkets does
	**/
	async refreshMarkets() {
		const results = await Promise.allSettled([
			AlcorMarket.fetchMarkets()
		])

		// Don't update markets if there is an error to one (it will remove those market from marketmap)
		if(!results.every(r => r.status === 'fulfilled'))
			return false;

		const markets = results.reduce((markets, r) => markets = r.value.concat(markets), [])

		return await this.saveRefresh(markets)
	}

	getMarket(src, pairid) {
		if(this.map[src+'_'+pairid] !== undefined)
			return this.map[src+'_'+pairid]

		return null
	}

	getAllMarkets() {
		let markets = []

		const allMarketsHashes = Object.keys(this.map)

		for(let i = 0; i < allMarketsHashes.length; ++i)
			markets.push(this.map[allMarketsHashes[i]])

		return markets
	}

	updateMarket(src, pairid, data) {
		const hash = src+'_'+pairid

		if(this.map[hash] === undefined) {
			throw new MarketMapException({code: 'missing_market', data: {src: src, market_id: pairid}})
			return false;
		}

		const dataKeys = Object.keys(data)
		for(let i = 0; i < dataKeys.length; ++i) {
			this.map[hash][dataKeys[i]] = data[dataKeys[i]]
		}

		return this.map[hash]
	}

	saveRefresh(markets) {
		const marketsMap = markets.reduce((map, market, i) => {
		  const key = market.src + '_' + market.pairid;
		  map[key] = i;
		  return map;
		}, {});

		// Add missing market in class poolmap
		const marketsToAdd = Object.keys(marketsMap).filter(hash => this.map[hash] === undefined);
		for(const marketToAdd of marketsToAdd)
			this.saveMarket(markets[marketsMap[marketToAdd]])
		// Remove missing market in function marketmap
		const marketsToRemove = Object.keys(this.map).filter(hash => marketsMap[hash] === undefined)
		for(const marketToRemove of marketsToRemove)
			this.removeMarket(marketToRemove)
	}

	saveMarkets(markets) {
		try {
			for(const market of markets)
				this.saveMarket(market);

			return true
		}
		catch(e) {
			logger.error(e)
			return false
		}
	}

	async saveMarket(market) {
    const banlist = await this.banlistLoader.getContent()
		// ignore scam contracts pool
		if(banlist.scam_contracts.indexOf(market.token0.contract) !== -1 || -1 !== banlist.scam_contracts.indexOf(market.token1.contract))
			return;

		this.map[Market.getHashStatic(market)] = market
	}

	removeMarket(market) {
		delete this.map[Market.getHashStatic(market)]
	}

	static createMarketFromRow(row) {
		const token0 = new Token(row.value.base_token)
    const token1 = new Token(row.value.quote_token)
    let min_buy = row.value.min_buy.split(' ')
    min_buy = Number(min_buy[0])
    let min_sell = row.value.min_sell.split(' ')
    min_sell = Number(min_sell[0])

   	return new Market(
    	row.value.id,
    	'alcormarket',
    	token0,
    	token1,
			min_buy,
			min_sell,
			(row.value.frozen > 0),
			row.value.fee
    )
	}

	insertMarketWithRow(row) {
		const market = MarketMap.createMarketFromRow(row)
		this.saveMarket(market)
		logger.info({ market }, 'insertMarketWithRow')
	}

	updateMarketWithRow(oldMarket, row) {
		// must keep lastSide and lastPrice properties
		const market = MarketMap.createMarketFromRow(row)
		market.lastSide = oldMarket.lastSide
		market.lastPrice = oldMarket.lastPrice

		this.saveMarket(market)
		logger.info({ market }, 'updateMarketWithRow')
	}

	deleteMarketWithRow(row) {
		const market = MarketMap.createMarketFromRow(row)
		logger.info({ row }, 'deleteMarketWithRow')
		this.removeMarket(market)
	}

	updateMarketWithMatch(market, data) {
		const marketUpdate = {}
		const splittedSrc = data.src.split('_')
		marketUpdate.lastSide = splittedSrc[1]
		marketUpdate.lastPrice = data.unit_price
		try {
			this.updateMarket(splittedSrc[0]+'market', data.market_id, marketUpdate)
		}
		catch(e) {
			if(e.code !== undefined) {
				if(e.code === 'missing_market')
					logger.info('Market '+e.data.market_id+' from '+e.data.src+' not indexed yet')
			}
			else {
				logger.error({ err: e }, 'Unhandled error')
			}
		}
	}
}