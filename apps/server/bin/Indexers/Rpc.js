import AppConfig from '../../config.js'
import {delay} from '../../utils/utils.js'

import PoolMap from '../Models/PoolMap.js'
import PoolSpecialMap from '@models/PoolSpecialMap.js';
import MarketMap from '../Models/MarketMap.js'
import PoolV3Map from '../Models/PoolV3Map.js'
import Tokens from '../Models/Tokens.js'
import logger from '@utils/logger.js';

function doesSourceContainsTokens(source, tokenA, tokenB) {
	return (
		(
			source.token0.contract === tokenA.contract && source.token0.symbol.ticker === tokenA.symbol.ticker
			&& source.token1.contract === tokenB.contract && source.token1.symbol.ticker === tokenB.symbol.ticker
		) || (
			source.token0.contract === tokenB.contract && source.token0.symbol.ticker === tokenB.symbol.ticker
			&& source.token1.contract === tokenA.contract && source.token1.symbol.ticker === tokenA.symbol.ticker
		)
	)
}

class RpcIndexer {
	constructor(getRowsIndexer) {
		this.getRowsIndexer = getRowsIndexer

		this.poolMap = new PoolMap()
    this.poolSpecialMap = new PoolSpecialMap();
		this.marketMap = new MarketMap()
		this.poolV3Map = new PoolV3Map()
		this.tokens = null
		this.loopcpt = 0

		this.doRefresh = false
	}

	async initPools() {
    await this.poolMap.init()
	}

  async initPoolsSpecial() {
    await this.poolSpecialMap.init()
  }

	async initPoolsV3() {
		await this.poolV3Map.init()
	}

	async initMarkets() {
		await this.marketMap.init()
	}

	async initTokens() {
    this.tokens = new Tokens(
    	() => this.poolMap,
    	() => this.poolV3Map,
    	() => this.marketMap,
    	() => this.getRowsIndexer()
    );
    await this.tokens.init()
	}

	async startRefreshTokens() {
		let firstRun = true
		while(true) {
			if(!firstRun) {
				await this.initTokens()
				logger.info('Tokens list refreshed')
			}

			firstRun = false
			await delay(1 * 60000)
		}
	}

	getPairDirectSources(tokenA, tokenB) {
		// Called from swap page
    let sources = []

    sources = sources.concat(this.poolMap.getAllPools().filter(p => doesSourceContainsTokens(p, tokenA, tokenB)).map(s => {
    	s.src_type = 'pools'
    	return s;
    }))
    sources = sources.concat(this.poolV3Map.getAllPools().filter(p => doesSourceContainsTokens(p, tokenA, tokenB)).map(s => {
    	s.src_type = 'poolsv3'
    	return s;
    }))
    sources = sources.concat(this.marketMap.getAllMarkets().filter(m => doesSourceContainsTokens(m, tokenA, tokenB)).map(s => {
    	s.src_type = 'markets'
    	return s;
    }))

    sources.sort((a, b) => {
    	const bToken0Amount = (b.token0.amount !== null) ? b.token0.amount : 0;
    	const bToken1Amount = (b.token1.amount !== null) ? b.token1.amount : 0;
    	const aToken0Amount = (a.token0.amount !== null) ? a.token0.amount : 0;
    	const aToken1Amount = (a.token1.amount !== null) ? a.token1.amount : 0;
      return bToken0Amount*bToken1Amount - aToken0Amount*aToken1Amount;
    })

    sources = sources.map(s => {
    	const source = {
		    src: s.src,
		    src_type: s.src_type,
		    pair_id: (s.pairid !== undefined) ? s.pairid : s.id,
		    token0: s.token0,
		    token1: s.token1,
		    fee: s.fee,
    	}

    	let extra = {}
    	if(s.src_type === 'poolsv3') {
    		extra = {
					sqrtPriceX64: s.sqrtPriceX64,
					liquidity: s.liquidity,
					tick: s.tick,
					feeGrowthGlobalAX64: s.feeGrowthGlobalAX64,
					feeGrowthGlobalBX64: s.feeGrowthGlobalBX64
    		}
    	}

    	return { ...source, ...extra };
	  })

    return sources
	}
}

export default RpcIndexer