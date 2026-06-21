import express from 'express'
import getRedis from '../Connectors/RedisConnector.js'
import { Token as AlcorToken, Pool as AlcorPool } from '@alcorexchange/alcor-swap-sdk'

import BackgroundWorker from '../Models/BackgroundWorker.js'

import MarketMatchRow from '../Models/Rows/MarketMatch.js'
import SwapOrderRow from '../Models/Rows/SwapOrder.js'
import SwapVThreeOrderRow from '../Models/Rows/SwapVThreeOrder.js'

import {delay} from '../../utils/utils.js'
import AppConfig from '../../config.js'
import { fetchIndexerApi } from '@class/apiFetcher.js';
import ApiLastStats from '@indexers/Api/LastStats.js'
import logger from '@utils/logger.js';

function getTimeLimit(nbDay) {
	const nowTime = Date.now()
	const timeLimit = nowTime - (nbDay * 24 * 60 * 60 * 1000)

	return timeLimit
}

function getPoolV3Price(pool, swaplogRow) {
	// No need to create real token, only need price
	const dumtickerA = 'dmtckrA'
	const dumtickerB = 'dmtckrB'
	const dummycontract = 'dumcontract'
  const tokenA = new AlcorToken(
    dummycontract,
   	8,
    dumtickerA.toUpperCase(),
    (dumtickerA + '-' + dummycontract).toLowerCase()
  );
  const tokenB = new AlcorToken(
    dummycontract,
   	8,
    dumtickerB.toUpperCase(),
    (dumtickerB + '-' + dummycontract).toLowerCase()
  );

  const alcorPool = new AlcorPool({
    id: pool.id,
    tokenA,
    tokenB,
    fee: pool.fee * 100,
    sqrtPriceX64: swaplogRow.sqrtPriceX64,
    liquidity: 0,
    tickCurrent: 1*swaplogRow.tick,
    feeGrowthGlobalAX64: 0,
    feeGrowthGlobalBX64: 0
  });

  return 1*alcorPool.tokenBPrice.toFixed(18)
}

function getTokenHash(token) {
	return token.contract.toLowerCase()+'_'+token.symbol.ticker.toLowerCase()
}

export default class LastStatsIndexer {
	constructor() {
		this.pools = []
		this.poolsV3 = []
		this.markets = []
		this.worker_volumes = new BackgroundWorker(
			'last_stats_indexer_volumes_worker',
			1,
			async(id) => await this.doLastStatsVolumesWork(id)
		)
		this.lastStatsVolumesWorkInitialized = false
		this.worker_price_changes = new BackgroundWorker(
			'last_stats_indexer_price_changes_worker',
			1,
			async(id) => await this.doLastStatsPriceChangesWork(id)
		)
		this.lastStatsPriceChangesWorkInitialized = false

		this.lastVolumes = {
 			'24h': { 'markets': {}, 'pools': {}, 'poolsv3': {}, 'tokens': {}, 'exchanges': {}},
 			'7d': { 'markets': {}, 'pools': {}, 'poolsv3': {}, 'tokens': {}, 'exchanges': {}},
 			'30d': { 'markets': {}, 'pools': {}, 'poolsv3': {}, 'tokens': {}, 'exchanges': {}}
 		}

 		this.lastPriceChanges = {
 			'24h': { 'markets': {}, 'pools': {}, 'poolsv3': {} }
 		}

 		this.api = new ApiLastStats({
 			getLastVolumes: () => this.lastVolumes,
 			getLastPriceChanges: () => this.lastPriceChanges,
 		})

 		this.maxGlobalSequenceInPriceChangesStats = 0 // Keep track of max global sequence processed
		this.trxInPriceChangesStats = [] // Keep track of current trx in stats to handle expiration
		this.trxQueueToAddInPriceChangesStats = [] // Queue of trx received in stream
		this.pairsPrice = {} // Contains last price
		this.pairsBeforeDayPrice = {} // Contains last price before 24h
		this.tokensWaxPriceCache = {} // Cache for tokens wax_price

 		this.maxGlobalSequenceInVolumeStats = 0 // Keep track of max global sequence processed
 		this.trxInVolumeStats = [] // Keep track of current trx in stats to handle expiration
 		this.trxQueueToAddInVolumeStats = [] // Queue of trx received in stream
	}

	async start() {
		logger.info('LastStats start')
		await this.init()
		await this.connectStream()

		this.worker_volumes.start()
		this.worker_price_changes.start()
	}

	async waitForApiToBeReady() {
		while (true) {
			const api_status = await fetchIndexerApi('/status')

			if (
				(Array.isArray(api_status) && api_status.length === 0) ||
				api_status?.ready === false
			) {
				logger.info('Indexer api not ready, wait 30 seconds')
				await delay(30000)
				continue
			}

			logger.info('Indexer api is ready')
			return
		}
	}

	async init() {
		await this.api.start();

		logger.info('Check if indexer api is ready')
		await this.waitForApiToBeReady()

		this.pools = await fetchIndexerApi('/pools')
		if(['', undefined].includes(this.pools))
			this.pools = []
		this.poolsV3 = await fetchIndexerApi('/poolsv3')
		if(['', undefined].includes(this.poolsV3))
			this.poolsV3 = []
		this.markets = await fetchIndexerApi('/markets')
		if(['', undefined].includes(this.markets))
			this.markets = []		
 	}

 	updateApiStatus() {
 		if(this.lastStatsVolumesWorkInitialized && this.lastStatsPriceChangesWorkInitialized) {
			logger.info('Set api status to ready')
			this.api.setReady(true)
 		}
 	}

 	async getMarket(id) {
 		let market = this.markets.find(m => m.id == id)
 		if(market === undefined) {
 			market = await fetchIndexerApi('/market/alcormarket/'+id)
 			if(!['', undefined].includes(market))
 				this.markets.push(market)
 			else {
 				return null
 			}
 		}

 		return market
 	}

 	async getPool(src, id) {
 		let pool = this.pools.find(p => p.src === src && p.pairid === id)
 		if(pool === undefined) {
 			pool = await fetchIndexerApi('/pool/'+src+'/'+id)
 			if(!['', undefined].includes(pool))
 				this.pools.push(pool)
 			else {
 				return null
 			}
 		}

 		return pool
 	}

 	async getPoolV3(src, id) {
 		let poolV3 = this.poolsV3.find(p => p.src === src && p.id == id)

 		if(poolV3 === undefined) {
 			poolV3 = await fetchIndexerApi('/poolv3/'+src+'/'+id)
 			if(!['', undefined].includes(poolV3))
 				this.poolsV3.push(poolV3)
 			else {
 				return null
 			}
 		}

 		return poolV3
 	}

 	/*
 		Fetch swap swapVThree and market matches made on last 30d
 	*/
 	async fetchLastTrades(day_amount) {
 		const ret = {}

 		const timeLimit = getTimeLimit(day_amount)

		ret.markets = await MarketMatchRow.fetchRows({ startAt: timeLimit, limit: false })
		ret.pools = await SwapOrderRow.fetchRows({ startAt: timeLimit, limit: false })
		ret.poolsv3 = await SwapVThreeOrderRow.fetchRows({ startAt: timeLimit, limit: false })

		return ret
 	}

 	async getTokenWaxPrice(contract, ticker) {
 		const timeLimit = 30000 // 30 seconds
 		const key = contract+'_'+ticker
 		if(this.tokensWaxPriceCache[key] !== undefined) {
 			if( (Date.now() - this.tokensWaxPriceCache[key].updated_at_time) < timeLimit)
 				return this.tokensWaxPriceCache[key].wax_price
 		}

 		const fetched = await fetchIndexerApi('/wax_price/'+contract+'/'+ticker)
 		
 		if(fetched === undefined || fetched.wax_price === null)
 			return null;
 		
 		this.tokensWaxPriceCache[key] = {
	 		wax_price: fetched.wax_price,
	 		updated_at_time: Date.now()
 		};

 		return this.tokensWaxPriceCache[key].wax_price
 	}

 	async getTokensWaxVolume(token0, token1, tradeVolumeA, tradeVolumeB) {
 		if(token0.contract === 'eosio.token' && 'WAX' === token0.symbol.ticker)
 			return tradeVolumeA
 		else if(token1.contract === 'eosio.token' && 'WAX' === token1.symbol.ticker)
 			return tradeVolumeB
 		else {
 			const token0_wax_price = await this.getTokenWaxPrice(token0.contract, token0.symbol.ticker)
 			if(token0_wax_price !== null)
 				return token0_wax_price * tradeVolumeA
 			
 			const token1_wax_price = await this.getTokenWaxPrice(token1.contract, token1.symbol.ticker)
 			if(token1_wax_price !== null)
 				return token1_wax_price * tradeVolumeB
 		}

 		return 0
 	}

 	getPairPrice(srcType, src, pair_id) {
 		if(this.pairsPrice[srcType+'_'+src+'_'+pair_id] === undefined)
 			return null;

 		return this.pairsPrice[srcType+'_'+src+'_'+pair_id];
 	}
 	getPairBeforeDayPrice(srcType, src, pair_id) {
 		if(this.pairsBeforeDayPrice[srcType+'_'+src+'_'+pair_id] === undefined)
 			return null;

 		return this.pairsBeforeDayPrice[srcType+'_'+src+'_'+pair_id];
 	}

 	updatePairPrice(srcType, src, pair_id, price) {
 		this.pairsPrice[srcType+'_'+src+'_'+pair_id] = price
 	}
 	updatePairBeforeDayPrice(srcType, src, pair_id, price) {
 		this.pairsBeforeDayPrice[srcType+'_'+src+'_'+pair_id] = price
 	}

 	addTradeInPriceChangesStats(srcType, trade, price) {
 		this.maxGlobalSequenceInPriceChangesStats = Math.max(Number(trade.global_sequence), this.maxGlobalSequenceInPriceChangesStats)

 		const dayTimeLimit = getTimeLimit(1)

 		this.trxInPriceChangesStats.push({
 			srcType,
 			src: trade.src,
 			pair_id: trade.pair_id,
 			global_sequence: trade.global_sequence,
 			updated_at_time: trade.updated_at_time,
 			price,
			dayLimit: (Number(trade.updated_at_time) < dayTimeLimit)
 		})
 	}

 	expireTradeInPriceChangesStats() {
 		const expiredTrades = []

 		const dayTimeLimit = getTimeLimit(1)

 		for(let i = 0; i< this.trxInPriceChangesStats.length; ++i) {
			const newDayLimit = (Number(this.trxInPriceChangesStats[i].updated_at_time) < dayTimeLimit)

			const expiredDurations = []

			if(newDayLimit !== this.trxInPriceChangesStats[i].dayLimit) {
				expiredDurations.push('24h')
			}

			this.trxInPriceChangesStats[i].dayLimit = newDayLimit

			if(expiredDurations.length)
				expiredTrades.push({
					...this.trxInPriceChangesStats[i],
					durations: expiredDurations
				})
 		}

 		// Clean full expired trx
 		this.trxInPriceChangesStats = this.trxInPriceChangesStats.filter(t => !t.dayLimit)

 		return expiredTrades
 	}

 	async computeLastPriceChanges(srcType, trades) {
 		for(let i = trades.length - 1; i >= 0; --i) {
 			await this.addTradeLastPriceChanges(srcType, trades[i])
 		}
 	}

 	refreshPairPriceChange(srcType, src, pair_id) {
		const lastPriceCurrent = this.getPairPrice(srcType, src, pair_id)
		const lastPriceBeforeDay = this.getPairBeforeDayPrice(srcType, src, pair_id)

		if(lastPriceCurrent !== null && null !== lastPriceBeforeDay)
			this.lastPriceChanges['24h'][srcType][src][pair_id] = lastPriceCurrent / lastPriceBeforeDay
 	}

 	async addTradeLastPriceChanges(srcType, trade) {
 		const dayTimeLimit = getTimeLimit(1)

		let lastPriceCurrent = null
		let lastPriceBeforeDay = null

		if(srcType === 'markets') {
			// Ugly fix to format market trades same as pools trades
			trade.src = 'alcormarket'
			trade.pair_id = trade.market_id

			if(this.lastPriceChanges['24h'][srcType][trade.src] === undefined)
				this.lastPriceChanges['24h'][srcType][trade.src] = {}

			lastPriceCurrent = 1*trade.unit_price / Math.pow(10, 8)

			if(lastPriceCurrent !== null)
				this.updatePairPrice(srcType, trade.src, trade.pair_id, lastPriceCurrent)

			lastPriceBeforeDay = this.getPairBeforeDayPrice(srcType, trade.src, trade.pair_id)

			if(lastPriceBeforeDay === null) {
				const marketRow = await MarketMatchRow.fetchRows({
					src: 'alcormarket',
					pair_id: trade.market_id,
					endAt: dayTimeLimit,
					limit: 1
				})

				if(marketRow.length) {
					lastPriceBeforeDay = 1*marketRow[0].unit_price / Math.pow(10, 8)
					this.updatePairBeforeDayPrice(srcType, trade.src, trade.pair_id, lastPriceBeforeDay)
				}
			}

			if(lastPriceCurrent !== null && null !== lastPriceBeforeDay) {
				const priceChange = lastPriceCurrent / lastPriceBeforeDay
				this.lastPriceChanges['24h'][srcType][trade.src][trade.market_id] = priceChange

				this.addTradeInPriceChangesStats(srcType, trade, lastPriceCurrent)
			}
		}
		else if(srcType === 'pools') {
			if(this.lastPriceChanges['24h'][srcType][trade.src] === undefined)
				this.lastPriceChanges['24h'][srcType][trade.src] = {}

			// SwapOrderRow
			lastPriceCurrent = Number(trade.amount_reserveA)/Number(trade.amount_reserveB)

			if(lastPriceCurrent !== null)
				this.updatePairPrice(srcType, trade.src, trade.pair_id, lastPriceCurrent)

			lastPriceBeforeDay = this.getPairBeforeDayPrice(srcType, trade.src, trade.pair_id)

			if(lastPriceBeforeDay === null) {
				const swapRow = await SwapOrderRow.fetchRows({
					src: trade.src,
					pair_id: trade.pair_id,
					endAt: dayTimeLimit,
					limit: 1
				})

				if(swapRow.length) {
					lastPriceBeforeDay = Number(swapRow[0].amount_reserveA)/Number(swapRow[0].amount_reserveB)
					this.updatePairBeforeDayPrice(srcType, trade.src, trade.pair_id, lastPriceBeforeDay)
				}
			}

			if(lastPriceCurrent !== null && null !== lastPriceBeforeDay) {
				const priceChange = lastPriceCurrent / lastPriceBeforeDay
				this.lastPriceChanges['24h'][srcType][trade.src][trade.pair_id] = priceChange

				this.addTradeInPriceChangesStats(srcType, trade, lastPriceCurrent)
			}
		}
		else if(srcType === 'poolsv3') {
			if(this.lastPriceChanges['24h'][srcType][trade.src] === undefined)
				this.lastPriceChanges['24h'][srcType][trade.src] = {}

			const poolV3 = await this.getPoolV3(trade.src, trade.pair_id)
			
			if(poolV3 !== null) {
				lastPriceCurrent = getPoolV3Price(poolV3, trade)

				if(lastPriceCurrent !== null)
					this.updatePairPrice(srcType, trade.src, trade.pair_id, lastPriceCurrent)

				lastPriceBeforeDay = this.getPairBeforeDayPrice(srcType, trade.src, trade.pair_id)

				if(lastPriceBeforeDay === null) {
	 				const swapV3Row = await SwapVThreeOrderRow.fetchRows({
	 					src: trade.src,
	 					pair_id: trade.pair_id,
	 					endAt: dayTimeLimit,
	 					limit: 1
	 				})

					if(swapV3Row.length) {
	 					lastPriceBeforeDay = getPoolV3Price(poolV3, swapV3Row[0])
	 					this.updatePairBeforeDayPrice(srcType, trade.src, trade.pair_id, lastPriceBeforeDay)
					}
				}

 				if(lastPriceCurrent !== null && null !== lastPriceBeforeDay) {
 					const priceChange = lastPriceCurrent / lastPriceBeforeDay
 					this.lastPriceChanges['24h'][srcType][trade.src][trade.pair_id] = priceChange

 					this.addTradeInPriceChangesStats(srcType, trade, lastPriceCurrent)
 				}
			}
		}
 	}

 	addTradeInVolumeStats(srcType, trade, tokenAHash, tokenBHash, volumeA,	volumeB, tokenWaxVolume) {
 		this.maxGlobalSequenceInVolumeStats = Math.max(Number(trade.global_sequence), this.maxGlobalSequenceInVolumeStats)

 		const dayTimeLimit = getTimeLimit(1)
 		const weekTimeLimit = getTimeLimit(7)
 		const monthTimeLimit = getTimeLimit(30)

 		this.trxInVolumeStats.push({
 			srcType,
 			src: trade.src,
 			pair_id: trade.pair_id,
 			global_sequence: trade.global_sequence,
 			updated_at_time: trade.updated_at_time,
			tokenAHash,
			tokenBHash,
 			volumeA,
 			volumeB,
 			tokenWaxVolume,
 			monthLimit: (Number(trade.updated_at_time) < monthTimeLimit),
			weekLimit: (Number(trade.updated_at_time) < weekTimeLimit),
			dayLimit: (Number(trade.updated_at_time) < dayTimeLimit)
 		})
 	}

 	expireTradeInVolumeStats() {
 		const expiredTrades = []

 		const dayTimeLimit = getTimeLimit(1)
 		const weekTimeLimit = getTimeLimit(7)
 		const monthTimeLimit = getTimeLimit(30)

 		for(let i = 0; i< this.trxInVolumeStats.length; ++i) {
			const newMonthLimit = (Number(this.trxInVolumeStats[i].updated_at_time) < monthTimeLimit)
			const newWeekLimit = (Number(this.trxInVolumeStats[i].updated_at_time) < weekTimeLimit)
			const newDayLimit = (Number(this.trxInVolumeStats[i].updated_at_time) < dayTimeLimit)

			const expiredDurations = []

			if(newMonthLimit !== this.trxInVolumeStats[i].monthLimit) {
				expiredDurations.push('30d')
			}
			if(newWeekLimit !== this.trxInVolumeStats[i].weekLimit) {
				expiredDurations.push('7d')
			}
			if(newDayLimit !== this.trxInVolumeStats[i].dayLimit) {
				expiredDurations.push('24h')
			}

			this.trxInVolumeStats[i].monthLimit = newMonthLimit
			this.trxInVolumeStats[i].weekLimit = newWeekLimit
			this.trxInVolumeStats[i].dayLimit = newDayLimit

			if(expiredDurations.length)
				expiredTrades.push({
					...this.trxInVolumeStats[i],
					durations: expiredDurations
				})
 		}

 		// Clean full expired trx
 		this.trxInVolumeStats = this.trxInVolumeStats.filter(t => !t.monthLimit || !t.weekLimit || !t.dayLimit)

 		return expiredTrades
 	}

 	async computeLastVolumes(srcType, trades) {
		// Looping in reverse to get asc order
		for(let i = trades.length - 1; i >= 0; --i) {
			await this.addTradeLastVolumes(srcType, trades[i])
 		}
 	}

 	async addTradeLastVolumes(srcType, trade) {
 		const dayTimeLimit = getTimeLimit(1)
 		const weekTimeLimit = getTimeLimit(7)
 		const monthTimeLimit = getTimeLimit(30)

		if(srcType === 'markets') {
			const market = await this.getMarket(trade.market_id)

			// Ugly fix to format market trades same as pools trades
			trade.src = 'alcormarket'
			trade.pair_id = trade.market_id

			if(market === null) {
				return;
			}

			// Do not count volume for banned contracts
			if(AppConfig.novolume_contracts.includes(market.token0.contract) || AppConfig.novolume_contracts.includes(market.token1.contract))
				return;

			let tradeVolumeA = 0
			let tradeVolumeB = 0
			if(trade.code_bid === market.token0.symbol.ticker) {
				tradeVolumeA = Number(trade.amount_bid)
				tradeVolumeB = Number(trade.amount_ask)
			}
			else {
				tradeVolumeA = Number(trade.amount_ask)
				tradeVolumeB = Number(trade.amount_bid)
			}

			const tokenAHash = getTokenHash(market.token0)
			const tokenBHash = getTokenHash(market.token1)

			for(const duration of Object.keys(this.lastVolumes)) {
				if(this.lastVolumes[duration][srcType][trade.src] === undefined)
					this.lastVolumes[duration][srcType][trade.src] = {}

        if(this.lastVolumes[duration]['exchanges'][trade.src] === undefined)
          this.lastVolumes[duration]['exchanges'][trade.src] = { 'volume': 0 }

				if(this.lastVolumes[duration][srcType][trade.src][trade.market_id] === undefined)
					this.lastVolumes[duration][srcType][trade.src][trade.market_id] = { 'volumeA': 0, 'volumeB': 0 }

				if(this.lastVolumes[duration]['tokens'][tokenAHash] === undefined)
					this.lastVolumes[duration]['tokens'][tokenAHash] = { 'volume': 0 }
				if(this.lastVolumes[duration]['tokens'][tokenBHash] === undefined)
					this.lastVolumes[duration]['tokens'][tokenBHash] = { 'volume': 0 }
			}

			const tokenWaxVolume = await this.getTokensWaxVolume(market.token0, market.token1, tradeVolumeA, tradeVolumeB)

			if(Number(trade.updated_at_time) >= monthTimeLimit) {
				this.lastVolumes['30d'][srcType][trade.src][trade.market_id].volumeA += tradeVolumeA
				this.lastVolumes['30d'][srcType][trade.src][trade.market_id].volumeB += tradeVolumeB
				this.lastVolumes['30d']['tokens'][tokenAHash].volume += tokenWaxVolume
				this.lastVolumes['30d']['tokens'][tokenBHash].volume += tokenWaxVolume
        this.lastVolumes['30d']['exchanges'][trade.src].volume += tokenWaxVolume

				if(Number(trade.updated_at_time) >= weekTimeLimit) {
					this.lastVolumes['7d'][srcType][trade.src][trade.market_id].volumeA += tradeVolumeA
					this.lastVolumes['7d'][srcType][trade.src][trade.market_id].volumeB += tradeVolumeB
					this.lastVolumes['7d']['tokens'][tokenAHash].volume += tokenWaxVolume
					this.lastVolumes['7d']['tokens'][tokenBHash].volume += tokenWaxVolume
          this.lastVolumes['7d']['exchanges'][trade.src].volume += tokenWaxVolume

	 				if(Number(trade.updated_at_time) >= dayTimeLimit) {
						this.lastVolumes['24h'][srcType][trade.src][trade.market_id].volumeA += tradeVolumeA
						this.lastVolumes['24h'][srcType][trade.src][trade.market_id].volumeB += tradeVolumeB
						this.lastVolumes['24h']['tokens'][tokenAHash].volume += tokenWaxVolume
						this.lastVolumes['24h']['tokens'][tokenBHash].volume += tokenWaxVolume
            this.lastVolumes['24h']['exchanges'][trade.src].volume += tokenWaxVolume
	 				}
				}
			}

			this.addTradeInVolumeStats(srcType, trade, tokenAHash, tokenBHash, tradeVolumeA, tradeVolumeB, tokenWaxVolume)
		}
		else if(srcType === 'pools') {
			const pool = await this.getPool(trade.src, trade.pair_id)

			if(pool === null) {
				return;
			}

			// Do not count volume for banned contracts
			if(AppConfig.novolume_contracts.includes(pool.token0.contract) || AppConfig.novolume_contracts.includes(pool.token1.contract))
				return;

			// Skip pools with same code_in as code_out since we can't determine which contract it is
			if(trade.code_in === trade.code_out) {
				return;
			}

			let tradeVolumeA = 0
			let tradeVolumeB = 0
			if(trade.code_in === trade.code_reserveA) {
				tradeVolumeA = Number(trade.amount_in)
				tradeVolumeB = Number(trade.amount_out)
			}
			else {
				tradeVolumeA = Number(trade.amount_out)
				tradeVolumeB = Number(trade.amount_in)
			}

			const tokenAHash = getTokenHash(pool.token0)
			const tokenBHash = getTokenHash(pool.token1)

			for(const duration of Object.keys(this.lastVolumes)) {
				if(this.lastVolumes[duration][srcType][trade.src] === undefined)
					this.lastVolumes[duration][srcType][trade.src] = { }

        if(this.lastVolumes[duration]['exchanges'][trade.src] === undefined)
          this.lastVolumes[duration]['exchanges'][trade.src] = { 'volume': 0 }

				if(this.lastVolumes[duration][srcType][trade.src][trade.pair_id] === undefined)
					this.lastVolumes[duration][srcType][trade.src][trade.pair_id] = { 'volumeA': 0, 'volumeB': 0 }

				if(this.lastVolumes[duration]['tokens'][tokenAHash] === undefined)
					this.lastVolumes[duration]['tokens'][tokenAHash] = { 'volume': 0 }
				if(this.lastVolumes[duration]['tokens'][tokenBHash] === undefined)
					this.lastVolumes[duration]['tokens'][tokenBHash] = { 'volume': 0 }
			}

			const tokenWaxVolume = await this.getTokensWaxVolume(pool.token0, pool.token1, tradeVolumeA, tradeVolumeB)

			if(Number(trade.updated_at_time) >= monthTimeLimit) {
				this.lastVolumes['30d'][srcType][trade.src][trade.pair_id].volumeA += tradeVolumeA
				this.lastVolumes['30d'][srcType][trade.src][trade.pair_id].volumeB += tradeVolumeB
				this.lastVolumes['30d']['tokens'][tokenAHash].volume += tokenWaxVolume
				this.lastVolumes['30d']['tokens'][tokenBHash].volume += tokenWaxVolume
        this.lastVolumes['30d']['exchanges'][trade.src].volume += tokenWaxVolume

				if(Number(trade.updated_at_time) >= weekTimeLimit) {
					this.lastVolumes['7d'][srcType][trade.src][trade.pair_id].volumeA += tradeVolumeA
					this.lastVolumes['7d'][srcType][trade.src][trade.pair_id].volumeB += tradeVolumeB
					this.lastVolumes['7d']['tokens'][tokenAHash].volume += tokenWaxVolume
					this.lastVolumes['7d']['tokens'][tokenBHash].volume += tokenWaxVolume
          this.lastVolumes['7d']['exchanges'][trade.src].volume += tokenWaxVolume

	 				if(Number(trade.updated_at_time) >= dayTimeLimit) {
						this.lastVolumes['24h'][srcType][trade.src][trade.pair_id].volumeA += tradeVolumeA
						this.lastVolumes['24h'][srcType][trade.src][trade.pair_id].volumeB += tradeVolumeB
						this.lastVolumes['24h']['tokens'][tokenAHash].volume += tokenWaxVolume
						this.lastVolumes['24h']['tokens'][tokenBHash].volume += tokenWaxVolume
            this.lastVolumes['24h']['exchanges'][trade.src].volume += tokenWaxVolume
	 				}
				}
			}

			this.addTradeInVolumeStats(srcType, trade, tokenAHash, tokenBHash, tradeVolumeA, tradeVolumeB, tokenWaxVolume)
		}
		else if(srcType === 'poolsv3') {
			const pool = await this.getPoolV3(trade.src, trade.pair_id)

			if(pool === null) {
				return;
			}

			// Do not count volume for banned contracts
			if(AppConfig.novolume_contracts.includes(pool.token0.contract) || AppConfig.novolume_contracts.includes(pool.token1.contract))
				return;

			const tradeVolumeA = Number(trade.amountA)
			const tradeVolumeB = Number(trade.amountB)

			const tokenAHash = getTokenHash(pool.token0)
			const tokenBHash = getTokenHash(pool.token1)

			for(const duration of Object.keys(this.lastVolumes)) {
				if(this.lastVolumes[duration][srcType][trade.src] === undefined)
					this.lastVolumes[duration][srcType][trade.src] = { }

        if(this.lastVolumes[duration]['exchanges'][trade.src] === undefined)
          this.lastVolumes[duration]['exchanges'][trade.src] = { 'volume': 0 }

				if(this.lastVolumes[duration][srcType][trade.src][trade.pair_id] === undefined)
					this.lastVolumes[duration][srcType][trade.src][trade.pair_id] = { 'volumeA': 0, 'volumeB': 0 }

				if(this.lastVolumes[duration]['tokens'][tokenAHash] === undefined)
					this.lastVolumes[duration]['tokens'][tokenAHash] = { 'volume': 0 }
				if(this.lastVolumes[duration]['tokens'][tokenBHash] === undefined)
					this.lastVolumes[duration]['tokens'][tokenBHash] = { 'volume': 0 }
			}

			const tokenWaxVolume = await this.getTokensWaxVolume(pool.token0, pool.token1, tradeVolumeA, tradeVolumeB)

			if(Number(trade.updated_at_time) >= monthTimeLimit) {
				this.lastVolumes['30d'][srcType][trade.src][trade.pair_id].volumeA += tradeVolumeA
				this.lastVolumes['30d'][srcType][trade.src][trade.pair_id].volumeB += tradeVolumeB
				this.lastVolumes['30d']['tokens'][tokenAHash].volume += tokenWaxVolume
				this.lastVolumes['30d']['tokens'][tokenBHash].volume += tokenWaxVolume
        this.lastVolumes['30d']['exchanges'][trade.src].volume += tokenWaxVolume

					if(Number(trade.updated_at_time) >= weekTimeLimit) {
						this.lastVolumes['7d'][srcType][trade.src][trade.pair_id].volumeA += tradeVolumeA
						this.lastVolumes['7d'][srcType][trade.src][trade.pair_id].volumeB += tradeVolumeB
						this.lastVolumes['7d']['tokens'][tokenAHash].volume += tokenWaxVolume
						this.lastVolumes['7d']['tokens'][tokenBHash].volume += tokenWaxVolume
            this.lastVolumes['7d']['exchanges'][trade.src].volume += tokenWaxVolume

		 				if(Number(trade.updated_at_time) >= dayTimeLimit) {
							this.lastVolumes['24h'][srcType][trade.src][trade.pair_id].volumeA += tradeVolumeA
							this.lastVolumes['24h'][srcType][trade.src][trade.pair_id].volumeB += tradeVolumeB
							this.lastVolumes['24h']['tokens'][tokenAHash].volume += tokenWaxVolume
							this.lastVolumes['24h']['tokens'][tokenBHash].volume += tokenWaxVolume
              this.lastVolumes['24h']['exchanges'][trade.src].volume += tokenWaxVolume
		 				}
					} 
			}
			this.addTradeInVolumeStats(srcType, trade, tokenAHash, tokenBHash, tradeVolumeA, tradeVolumeB, tokenWaxVolume)
		}
 	}

 	removeLastVolumes(expiredTrx) {
 		for(const duration of expiredTrx.durations) {
			this.lastVolumes[duration][expiredTrx.srcType][expiredTrx.src][expiredTrx.pair_id].volumeA -= expiredTrx.volumeA
			this.lastVolumes[duration][expiredTrx.srcType][expiredTrx.src][expiredTrx.pair_id].volumeB -= expiredTrx.volumeB
			this.lastVolumes[duration]['tokens'][expiredTrx.tokenAHash].volume -= expiredTrx.tokenWaxVolume
			this.lastVolumes[duration]['tokens'][expiredTrx.tokenBHash].volume -= expiredTrx.tokenWaxVolume
      this.lastVolumes[duration]['exchanges'][expiredTrx.src].volume -= expiredTrx.tokenWaxVolume

			this.lastVolumes[duration][expiredTrx.srcType][expiredTrx.src][expiredTrx.pair_id].volumeA = Math.max(0, this.lastVolumes[duration][expiredTrx.srcType][expiredTrx.src][expiredTrx.pair_id].volumeA)
			this.lastVolumes[duration][expiredTrx.srcType][expiredTrx.src][expiredTrx.pair_id].volumeB = Math.max(0, this.lastVolumes[duration][expiredTrx.srcType][expiredTrx.src][expiredTrx.pair_id].volumeB)
			this.lastVolumes[duration]['tokens'][expiredTrx.tokenAHash].volume = Math.max(0, this.lastVolumes[duration]['tokens'][expiredTrx.tokenAHash].volume)
			this.lastVolumes[duration]['tokens'][expiredTrx.tokenBHash].volume = Math.max(0, this.lastVolumes[duration]['tokens'][expiredTrx.tokenBHash].volume)
      this.lastVolumes[duration]['exchanges'][expiredTrx.src].volume = Math.max(0, this.lastVolumes[duration]['exchanges'][expiredTrx.src].volume)
 		}
 	}

 	async doLastStatsVolumesWork(worker_id) {
 		const startTime = Date.now()
 		logger.info(worker_id+': Last stats volumes work starts')

 		if(!this.trxInVolumeStats.length) {
 			// init
	 		const last30dTrades = await this.fetchLastTrades(30)

	 		logger.info(worker_id+': Computing last volumes')
	 		for(const srcType of Object.keys(last30dTrades)) {
	 			await this.computeLastVolumes(srcType, last30dTrades[srcType])
	 		}

	 		logger.info(worker_id+': Last stats volumes work done in '+Math.floor((Date.now() - startTime) / 1000)+' seconds')
	 		this.lastStatsVolumesWorkInitialized = true
	 		this.updateApiStatus()
 		}
 		else {
 			// Update trxInVolumeStats and expire old tx + update volume
 			const expiredTrxs = this.expireTradeInVolumeStats()
 			logger.info(worker_id+': '+expiredTrxs.length+' expired trades')
 			for(const expiredTrx of expiredTrxs)
 				this.removeLastVolumes(expiredTrx)

 			// Get new trades (queue or db fetch) and insert them into volume count
 			const newTrxCpt = this.trxQueueToAddInVolumeStats.length
 			logger.info(worker_id+': '+newTrxCpt + ' new trades')
 			for(let i = 0; i < newTrxCpt; ++i) {
 				const trade = this.trxQueueToAddInVolumeStats.shift()
 				// Safety to not include trade already processed
 				if(this.maxGlobalSequenceInVolumeStats < Number(trade.global_sequence))
 					this.addTradeLastVolumes(trade.srcType, trade)
 			}
 		}
		await delay(2000)
 	}

 	async doLastStatsPriceChangesWork(worker_id) {
 		const startTime = Date.now()
 		logger.info(worker_id+': Last stats price changes work starts')

 		if(!this.trxInPriceChangesStats.length) {
	 		const lastDayTrades = await this.fetchLastTrades(1)
	 		logger.info(worker_id+': Computing last price changes')
	 		for(const srcType of Object.keys(lastDayTrades)) {
	 		  await this.computeLastPriceChanges(
	 		  	srcType,
	 		  	lastDayTrades[srcType]
	 		  )
	 		}

	 		logger.info(worker_id+': Last stats price changes work done in '+Math.floor((Date.now() - startTime) / 1000)+' seconds')
	 		this.lastStatsPriceChangesWorkInitialized = true
	 		this.updateApiStatus()
 		}
 		else {
 			const expiredTrxs = this.expireTradeInPriceChangesStats()
 			logger.info(worker_id+': '+expiredTrxs.length+' expired trades')
 			for(const expiredTrx of expiredTrxs) {
				this.updatePairBeforeDayPrice(expiredTrx.srcType, expiredTrx.src, expiredTrx.pair_id, expiredTrx.price)
				this.refreshPairPriceChange(expiredTrx.srcType, expiredTrx.src, expiredTrx.pair_id)
 			}

 			// Get new trades (queue or db fetch) and insert them into volume count
 			const newTrxCpt = this.trxQueueToAddInPriceChangesStats.length
 			logger.info(worker_id+': '+newTrxCpt + ' new trades')
 			for(let i = 0; i < newTrxCpt; ++i) {
 				const trade = this.trxQueueToAddInPriceChangesStats.shift()
 				// Safety to not include trade already processed
 				if(this.maxGlobalSequenceInPriceChangesStats < Number(trade.global_sequence))
 					this.addTradeLastPriceChanges(trade.srcType, trade)
 			}
 		}
 		await delay(2000)
 	}

 	async connectStream() {
 		const redis = await getRedis('laststats_subscriber')

		const swapOrdersQueueName = 'swapOrders_insert_klinesIndexer'
		const swapVThreeOrdersQueueName = 'swapVThreeOrders_insert'
    const marketMatchesQueueName = 'marketMatches_insert_indexer'

		try {
			redis.subscribe(swapOrdersQueueName, (jsonData) => {
				const trade = JSON.parse(jsonData)
				trade.srcType = 'pools'
				this.trxQueueToAddInPriceChangesStats.push(trade)
				this.trxQueueToAddInVolumeStats.push(trade)
			})
    } catch(err) {
    	logger.error({ err: err }, 'Error while listening to queue '+swapOrdersQueueName)
    }
    try {
			redis.subscribe(swapVThreeOrdersQueueName, (jsonData) => {
				const trade = JSON.parse(jsonData)
				trade.srcType = 'poolsv3'
				this.trxQueueToAddInPriceChangesStats.push(trade)
				this.trxQueueToAddInVolumeStats.push(trade)
			})
    } catch(err) {
    	logger.error({ err: err }, 'Error while listening to queue '+swapVThreeOrdersQueueName)
    }
    try {
			redis.subscribe(marketMatchesQueueName, (jsonData) => {
				const trade = JSON.parse(jsonData)
				trade.srcType = 'markets'
				this.trxQueueToAddInPriceChangesStats.push(trade)
				this.trxQueueToAddInVolumeStats.push(trade)
			})
    } catch(err) {
    	logger.error({ err: err }, 'Error while listening to queue '+marketMatchesQueueName)
    }
 	}
}