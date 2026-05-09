import DefiboxPool from '@exchanges/DefiboxPool.js'
import TacoPool from '@exchanges/TacoPool.js'
import ADexPool from '@exchanges/ADexPool.js';
import NeftyPool from '@exchanges/NeftyPool.js';

import Token from '@models/Token.js'
import Pool from '@models/Pool.js'

import AppConfig from '@root/config.js'
import BanlistLoader from '@models/BanlistLoader.js';

class PoolMapException extends Error {
	constructor({data, code}) {
		super(code)
		this.data = data
		this.code = code
	}
}

class PoolMap {
	constructor() {
		this.map = {}
		this.waxMap = {} // links in which direct wax pools a token is
    this.banlistLoader = new BanlistLoader('PoolMap');
	}

	async init() {
		await this.fetchPools()
		return true
	}

	async fetchPools() {
		await Promise.allSettled([
			this.fetchNSavePools('neftyblocks'),
			this.fetchNSavePools('adex'),
			this.fetchNSavePools('defibox'),
			this.fetchNSavePools('taco')
		])
	}

	async fetchNSavePools(src) {
		let pools = []

		if(src === 'defibox')
			pools = await DefiboxPool.fetchPools()
		else if(src === 'taco')		
			pools = await TacoPool.fetchPools()
		else if(src === 'adex')
			pools = await ADexPool.fetchPools()
		else if(src === 'neftyblocks')
			pools = await NeftyPool.fetchPools()

		this.savePools(pools)
		return true
	}

	/** Refresh pools
	 * remove those who are not in the list from poolmap
	 * insert new ones into poolmap
	 * DO not replace the all poolmap like fetchPools does
	**/
	async refreshPools() {
		const results = await Promise.allSettled([
			//AlcorPool.fetchPools(),
			DefiboxPool.fetchPools(),
			TacoPool.fetchPools()
		])

		// Don't update pools if there is an error to one (it will remove those pool from poolmap)
		if(!results.every(r => r.status === 'fulfilled'))
			return false;

		const pools = results.reduce((pools, r) => pools = r.value.concat(pools), [])

		return await this.saveRefresh(pools)
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

	updatePool(src, pairid, data, update_num) {
		const hash = src+'_'+pairid

		if(this.map[hash] === undefined) {
			throw new PoolMapException({code: 'missing_pool', data: {src: src, pair_id: pairid}})
			return false;
		}

		if(this.map[hash].update_num === undefined)
			this.map[hash].update_num = 0

		if(this.map[hash].update_num > update_num)
			return false;

		this.map[hash].update_num = update_num

		const dataKeys = Object.keys(data)
		for(let i = 0; i < dataKeys.length; ++i) {
			this.map[hash][dataKeys[i]] = data[dataKeys[i]]
		}
		return this.map[hash]
	}

	saveRefresh(pools) {
		const poolsMap = pools.reduce((map, pool, i) => {
		  const key = pool.src + '_' + pool.pairid;
		  map[key] = i;
		  return map;
		}, {});

		// Add missing pool in class poolmap
		const poolsToAdd = Object.keys(poolsMap).filter(hash => this.map[hash] === undefined);
		for(const poolToAdd of poolsToAdd)
			this.savePool(pools[poolsMap[poolToAdd]])
		// Remove missing pool in function poolmap
		const poolsToRemove = Object.keys(this.map).filter(hash => poolsMap[hash] === undefined)
		for(const poolToRemove of poolsToRemove)
			this.removePool(poolToRemove)
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

		if(AppConfig.pools_blacklist.find(pb => pb.src === pool.src && pb.id === pool.pairid) !== undefined)
			return;

		this.map[Pool.getHashStatic(pool)] = pool

		if(pool.token0.symbol.ticker === 'WAX' && 'eosio.token' === pool.token0.contract) {
			if(this.waxMap[Token.getHashStatic(pool.token1)] === undefined)
				this.waxMap[Token.getHashStatic(pool.token1)] = []
			this.waxMap[Token.getHashStatic(pool.token1)].push(Pool.getHashStatic(pool))
		}

		if(pool.token1.symbol.ticker === 'WAX' && 'eosio.token' === pool.token1.contract) {
			if(this.waxMap[Token.getHashStatic(pool.token0)] === undefined)
				this.waxMap[Token.getHashStatic(pool.token0)] = []
			this.waxMap[Token.getHashStatic(pool.token0)].push(Pool.getHashStatic(pool))
		}
	}

	removePool(pool) {
		delete this.map[Pool.getHashStatic(pool)]

		if(pool.token0.symbol.ticker === 'WAX' && 'eosio.token' === pool.token0.contract) {
			if(this.waxMap[Token.getHashStatic(pool.token1)] !== undefined) {
				const index = this.waxMap[Token.getHashStatic(pool.token1)].indexOf(Pool.getHashStatic(pool))
				if(index !== -1)
					this.waxMap[Token.getHashStatic(pool.token1)].splice(index, 1)
			}
		}

		if(pool.token1.symbol.ticker === 'WAX' && 'eosio.token' === pool.token1.contract) {
			if(this.waxMap[Token.getHashStatic(pool.token0)] !== undefined) {
				const index = this.waxMap[Token.getHashStatic(pool.token0)].indexOf(Pool.getHashStatic(pool))
				if(index !== -1)
					this.waxMap[Token.getHashStatic(pool.token0)].splice(index, 1)
			}
		}
	}

	static createPoolFromRow(row) {
		let rowToken0 = null;
		let rowToken1 = null;
		let rowLptoken = null;
		let fee = 30;
		let rowId = row.value.id;
		let rowActive = true

		if(row.src === 'taco') {
			rowLptoken = new Token({quantity: row.value.supply, contract:'swap.taco'})
			rowToken0 = new Token(row.value.pool1)
			rowToken1 = new Token(row.value.pool2)
		}
		else if(row.src === 'defibox') {
			// update tokens to get right format
	    row.value.token0.quantity = row.value.reserve0
	    row.value.token1.quantity = row.value.reserve1

	    rowLptoken = new Token({quantity: row.value.liquidity_token+' '+DefiboxPool.getLPTickerFromId(row.value.id), contract:'lptoken.box'})
	    rowToken0 = new Token(row.value.token0)
	    rowToken1 = new Token(row.value.token1)
		}
		else if(row.src === 'neftyblocks') {
			rowId = row.value.code;
			rowLptoken = new Token({quantity: row.value.total_liquidity+' '+row.value.code, contract:'lp.nefty'});
			rowToken0 = new Token(row.value.reserve0)
			rowToken1 = new Token(row.value.reserve1)
			rowActive = row.value.active
		}
		else if(row.src === 'adex') {
			rowLptoken = new Token({ quantity: '0 '+row.value.code, contract: 'swap.adex'})
			rowToken0 = new Token(row.value.base_token)
			rowToken1 = new Token(row.value.quote_token)

			let pool_fee =  row.value.pool_fee.split(' ');
			pool_fee = pool_fee[0] * 100
			let platform_fee =  row.value.platform_fee.split(' ');
			platform_fee = platform_fee[0] * 100

			fee = pool_fee + platform_fee
		}

		return new Pool(
    	rowId,
    	row.src,
    	fee,
    	rowLptoken,
    	rowToken0,
    	rowToken1,
    	rowToken0.amount,
    	rowToken1.amount,
    	rowActive
    )
	}

	insertPoolWithRow(row) {
		const pool = PoolMap.createPoolFromRow(row)
		console.log('insertPoolWithRow savepool', pool)
		this.savePool(pool)
	}

	// MUST DOUBLE CHECK THIS FUNCTION, there shouldn't be any in_market, in_pool or img in tokens from pools
	// Those are inside tokens from all tokens
	updatePoolWithRow(pool, row) {
		let rowToken0 = null;
		let rowToken1 = null;
		let rowLptoken = null;
		let fee = 30;
		let rowId = row.value.id;
		let rowActive = true

		if(pool.src === 'taco') {
			rowLptoken = new Token({quantity: row.value.supply, contract:'swap.taco'})
			rowToken0 = new Token(row.value.pool1)
			rowToken1 = new Token(row.value.pool2)
		}
		else if(pool.src === 'defibox') {
			// update tokens to get right format
	    row.value.token0.quantity = row.value.reserve0
	    row.value.token1.quantity = row.value.reserve1

	    rowLptoken = new Token({quantity: row.value.liquidity_token+' '+DefiboxPool.getLPTickerFromId(row.value.id), contract:'lptoken.box'})
	    rowToken0 = new Token(row.value.token0)
	    rowToken1 = new Token(row.value.token1)
		}
		else if(row.src === 'neftyblocks') {
			rowId = row.value.code;
			rowLptoken = new Token({quantity: row.value.total_liquidity+' '+row.value.code, contract:'lp.nefty'});
			rowToken0 = new Token(row.value.reserve0)
			rowToken1 = new Token(row.value.reserve1)
			rowActive = row.value.active
		}
		else if(pool.src === 'adex') {
			rowLptoken = new Token({ quantity: '0 '+row.value.code, contract: 'swap.adex'})
			rowToken0 = new Token(row.value.base_token)
			rowToken1 = new Token(row.value.quote_token)

			let pool_fee =  row.value.pool_fee.split(' ');
			pool_fee = pool_fee[0] * 100
			let platform_fee =  row.value.platform_fee.split(' ');
			platform_fee = platform_fee[0] * 100

			fee = pool_fee + platform_fee
		}

		const poolUpdate = {}

		if(pool.token0.symbol.ticker != rowToken0.symbol.ticker || pool.token0.contract !== rowToken0.contract) {
			poolUpdate.token0 = rowToken1.getCopy()
			poolUpdate.token1 = rowToken0.getCopy()

			if(pool.token1.in_pool !== undefined)
				poolUpdate.token0.in_pool = pool.token1.in_pool
			if(pool.token1.in_market !== undefined)
				poolUpdate.token0.in_market = pool.token1.in_market
			if(pool.token1.img !== undefined)
				poolUpdate.token0.img = pool.token1.img

			if(pool.token0.in_pool !== undefined)
				poolUpdate.token1.in_pool = pool.token0.in_pool
			if(pool.token0.in_market !== undefined)
				poolUpdate.token1.in_market = pool.token0.in_market
			if(pool.token0.img !== undefined)
				poolUpdate.token1.img = pool.token0.img
		}
		else {
			poolUpdate.token0 = rowToken0.getCopy()
			poolUpdate.token1 = rowToken1.getCopy()

			if(pool.token0.in_pool !== undefined)
				poolUpdate.token0.in_pool = pool.token0.in_pool
			if(pool.token0.in_market !== undefined)
				poolUpdate.token0.in_market = pool.token0.in_market
			if(pool.token0.img !== undefined)
				poolUpdate.token0.img = pool.token0.img

			if(pool.token1.in_pool !== undefined)
				poolUpdate.token1.in_pool = pool.token1.in_pool
			if(pool.token1.in_market !== undefined)
				poolUpdate.token1.in_market = pool.token1.in_market
			if(pool.token1.img !== undefined)
				poolUpdate.token1.img = pool.token1.img
		}
		poolUpdate.lptoken = rowLptoken.getCopy()
		if(pool.lptoken.in_pool !== undefined)
			poolUpdate.lptoken.in_pool = pool.lptoken.in_pool
		if(pool.lptoken.in_market !== undefined)
			poolUpdate.lptoken.in_market = pool.lptoken.in_market
		if(pool.lptoken.img !== undefined)
			poolUpdate.lptoken.img = pool.lptoken.img
		poolUpdate.reserve0 = poolUpdate.token0.amount
		poolUpdate.reserve1 = poolUpdate.token1.amount
		poolUpdate.fee = fee
		poolUpdate.price = poolUpdate.reserve0/poolUpdate.reserve1
		poolUpdate.active = rowActive

		try {
			this.updatePool(pool.src, rowId, poolUpdate, row.block_num)
		}
		catch(e) {
			if(e.code !== undefined) {
				if(e.code === 'missing_pool')
					console.log('Pool '+e.data.pair_id+' from '+e.data.src+' not indexed yet')
			}
			else {
				console.log('Unhandled error', e)
			}
		}
	}

	deletePoolWithRow(row) {
		const pool = PoolMap.createPoolFromRow(row)
		console.log('deletePoolWithRow removePool', pool)
		this.removePool(pool)
	}
}

export default PoolMap