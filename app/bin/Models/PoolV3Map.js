import AlcorPoolV3 from '../Exchanges/AlcorPoolV3.js'

import Token from './Token.js'
import PoolV3 from './PoolV3.js'

import AppConfig from '../../config.js'
import BanlistLoader from '@models/BanlistLoader.js';

export default class PoolV3Map {
	constructor() {
		this.map = {}
		this.waxMap = {} // links in which direct wax pools a token is
    this.banlistLoader = new BanlistLoader('PoolV3Map');
	}

	async init() {
		const pools = await AlcorPoolV3.fetchPools()
		this.savePools(pools)
		// console.log(this.map)

		return true
	}

  getWaxPools(contract, ticker) {
    const tokenHash = Token.getHashFromContractTickerStatic(contract, ticker)

    if(this.waxMap[tokenHash] === undefined)
      return []

    let pools = []

    for(const poolHash of this.waxMap[tokenHash])
      pools.push(this.getPoolByHash(poolHash))

    return pools
  }

  getDeepestWaxPool(contract, ticker) {
    // Get deepest pool
    let waxPools = this.getWaxPools(contract, ticker)
    waxPools.sort((a, b) => {
      let wax_amount_a = (a.token0.contract == 'eosio.token' && a.token0.symbol.ticker == 'WAX') ? a.reserve0 : a.reserve1
      let wax_amount_b = (b.token0.contract == 'eosio.token' && b.token0.symbol.ticker == 'WAX') ? b.reserve0 : b.reserve1

      return wax_amount_b - wax_amount_a
    })

    return (waxPools.length) ? waxPools[0] : null
  }

	getPool(src, pairid) {
		return this.getPoolByHash(src+'_'+pairid)
	}

	getPoolByHash(poolHash) {
		if(this.map[poolHash] !== undefined)
			return this.map[poolHash]

		return null
	}

	getAllPools() {
		let pools = []

		const allPoolsHashes = Object.keys(this.map)

		for(let i = 0; i < allPoolsHashes.length; ++i)
			pools.push(this.map[allPoolsHashes[i]])

		return pools
	}

	savePools(pools) {
		try {
			for(let i = 0; i < pools.length; ++i)
				this.savePool(pools[i]);

			return true
		}
		catch(e) {
			console.log(e)
			return false
		}
	}

	async savePool(pool) {
    const banlist = await this.banlistLoader.getContent()
		// ignore scam contracts pool
		if(banlist.scam_contracts.indexOf(pool.token0.contract) !== -1 || -1 !== banlist.scam_contracts.indexOf(pool.token1.contract))
			return;

		this.map[PoolV3.getHashStatic(pool)] = pool

		if(pool.token0.symbol.ticker === 'WAX' && 'eosio.token' === pool.token0.contract) {
			if(this.waxMap[Token.getHashStatic(pool.token1)] === undefined)
				this.waxMap[Token.getHashStatic(pool.token1)] = []
			this.waxMap[Token.getHashStatic(pool.token1)].push(PoolV3.getHashStatic(pool))
		}

		if(pool.token1.symbol.ticker === 'WAX' && 'eosio.token' === pool.token1.contract) {
			if(this.waxMap[Token.getHashStatic(pool.token0)] === undefined)
				this.waxMap[Token.getHashStatic(pool.token0)] = []
			this.waxMap[Token.getHashStatic(pool.token0)].push(PoolV3.getHashStatic(pool))
		}
	}

	async updatePool(pool) {
    const banlist = await this.banlistLoader.getContent()
		// ignore scam contracts pool
		if(banlist.scam_contracts.indexOf(pool.token0.contract) !== -1 || -1 !== banlist.scam_contracts.indexOf(pool.token1.contract))
			return;

		this.map[PoolV3.getHashStatic(pool)] = pool
	}

	removePool(pool) {
		delete this.map[PoolV3.getHashStatic(pool)]

		if(pool.token0.symbol.ticker === 'WAX' && 'eosio.token' === pool.token0.contract) {
			if(this.waxMap[Token.getHashStatic(pool.token1)] !== undefined) {
				const index = this.waxMap[Token.getHashStatic(pool.token1)].indexOf(PoolV3.getHashStatic(pool))
				if(index !== -1)
					this.waxMap[Token.getHashStatic(pool.token1)].splice(index, 1)
			}
		}

		if(pool.token1.symbol.ticker === 'WAX' && 'eosio.token' === pool.token1.contract) {
			if(this.waxMap[Token.getHashStatic(pool.token0)] !== undefined) {
				const index = this.waxMap[Token.getHashStatic(pool.token0)].indexOf(PoolV3.getHashStatic(pool))
				if(index !== -1)
					this.waxMap[Token.getHashStatic(pool.token0)].splice(index, 1)
			}
		}
	}

	static createPoolFromRow(row) {
		const token0 = new Token(row.value.tokenA)
		const token1 = new Token(row.value.tokenB)

		return new PoolV3({
    	id: row.value.id,
    	src: 'alcorv2',
    	active: row.value.active,
    	token0,
    	token1,
    	fee: row.value.fee/100, // Alcor v2 put 3000 for 0.3% while others value would be 30 so we must divide by 100
    	feeProtocol: row.value.feeProtocol/100, // Alcor v2 put 3000 for 0.3% while others value would be 30 so we must divide by 100
    	tickSpacing: row.value.tickSpacing,
    	maxLiquidityPerTick: row.value.maxLiquidityPerTick,
    	sqrtPriceX64: row.value.currSlot.sqrtPriceX64,
    	tick: row.value.currSlot.tick,
    	lastObservationTimestamp: row.value.currSlot.lastObservationTimestamp,
    	currentObservationNum: row.value.currSlot.currentObservationNum,
    	maxObservationNum: row.value.currSlot.maxObservationNum,
    	feeGrowthGlobalAX64: row.value.feeGrowthGlobalAX64,
    	feeGrowthGlobalBX64: row.value.feeGrowthGlobalBX64,
    	protocolFeeA: row.value.protocolFeeA,
    	protocolFeeB: row.value.protocolFeeB,
    	liquidity: row.value.liquidity
    })
	}

	insertPoolWithRow(row) {
		const pool = PoolV3Map.createPoolFromRow(row)
		this.savePool(pool)
		console.log('insertPoolWithRow', pool)
	}

	updatePoolWithRow(row) {
		const pool = PoolV3Map.createPoolFromRow(row)
		this.updatePool(pool)
		//console.log('updatePoolWithRow', pool)
	}

	deletePoolWithRow(row) {
		const pool = PoolV3Map.createPoolFromRow(row)
		this.remove(pool)
		console.log('deletePoolWithRow', pool)
	}

}