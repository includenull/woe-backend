import getRedis from '../Connectors/RedisConnector.js'
import fs from 'fs'

import PoolV3 from './PoolV3.js'

const downloadDirectory = process.cwd()+'/tokens_logo';

// used for the api to be able to fetch Tokens list from redis
class Tokens {
	constructor(getPoolMap, getPoolV3Map, getMarketMap, getRowsIndexer) {
		this.getPoolMap = getPoolMap
		this.getPoolV3Map = getPoolV3Map
		this.getMarketMap = getMarketMap
		this.getRowsIndexer = getRowsIndexer
		this.redisClient = null
		this.tokens = []
		this.tokensLiquidity = {} // used to get max liquidity of a token to be able to find deepest pool and set wax_price
	}

	async init() {
		this.redisClient = await getRedis()
		this.tokens = []
		await this.generateTokensFromPools()
		await this.generateTokensFromMarkets()
		await this.populateTokenImg()

   	this.tokens.sort((a, b) => {
      const waxA = a.in_pool.filter(p => p.vstoken.contract === 'eosio.token' && 'WAX' === p.vstoken.symbol.ticker).sort((a, b) => b.vstoken.amount - a.vstoken.amount)
      const waxB = b.in_pool.filter(p => p.vstoken.contract === 'eosio.token' && 'WAX' === p.vstoken.symbol.ticker).sort((a, b) => b.vstoken.amount - a.vstoken.amount)

      if(waxA.length && waxB.length)
        return 1*waxB[0].vstoken.amount - 1*waxA[0].vstoken.amount
      else
        return waxB.length - waxA.length
    })

    for(let i = 0; i < this.tokens.length; ++i) {
    	this.tokens[i].is_in_pool = (this.tokens[i].in_pool.length > 0); 
    	this.tokens[i].is_in_market = (this.tokens[i].in_market.length > 0);

    	// Look for bagzregistry tokens config
    	this.tokens[i].is_tradeable = undefined

    	const bagzregistry_configs = this.getRowsIndexer().getRowsFromCodeTableScope(this.tokens[i].contract, 'configs', '*');
    	if(bagzregistry_configs.length) {
    		const config = bagzregistry_configs.find(c => c.code === this.tokens[i].symbol.ticker)
    		if(config) {
    			this.tokens[i].is_tradeable = config.is_tradeable
    		}
    	}
    }

		await this.saveTokens()
	}

	static async getTokens({ minimalData }) {
		const redisClient = await getRedis()

		if(minimalData === undefined)
			minimalData = false

		let tokens = await redisClient.get((!minimalData) ? 'tokens' : 'tokens_minimal')
		if(tokens !== null)
			tokens = JSON.parse(tokens)

		return (tokens !== null) ? tokens : []
	}

	async generateTokensFromPools() {
		const pools = await this.getPoolMap().getAllPools()
		const poolsV3 = await this.getPoolV3Map().getAllPools()

		const allPools = pools.concat(poolsV3)

		for(let i = 0; i < allPools.length; ++i) {
			const pool = allPools[i];

			['lptoken', 'token0', 'token1'].forEach((tokenType) => {
				if(pool[tokenType] === undefined)
					return; // continue

				const poolToken = pool[tokenType].getCopy()
				this.addPoolToken(pool, tokenType, poolToken)
			})
		}
	}

	async generateTokensFromMarkets() {
		const markets = this.getMarketMap().getAllMarkets().filter(m => !m.frozen)

		for(const market of markets) {
			for(const tokenType of ['token0', 'token1']) {
				const token = market[tokenType].getCopy()
				this.addMarketToken(market, tokenType, token)
			} // for
		} // for

		// console.log(this.tokens)
	}

	async populateTokenImg() {
		for(let i = 0; i < this.tokens.length; ++i) {
			if(fs.existsSync(downloadDirectory+'/'+this.tokens[i].contract.toLowerCase()+'_'+this.tokens[i].symbol.ticker.toLowerCase()+'.png'))
				this.tokens[i].img = this.tokens[i].contract.toLowerCase()+'_'+this.tokens[i].symbol.ticker.toLowerCase()+'.png'
			else
				this.tokens[i].img = ''
		}
	}

	addPoolToken(pool, tokenType, poolToken) {
		const indexToken = this.tokens.findIndex(t => 
			t.getTicker() === poolToken.getTicker()
			&& t.contract === poolToken.contract
		)

		const tokenHash = poolToken.getTicker()+'_'+poolToken.contract;

		const pool_src_type = (pool.pairid === undefined) ? 'poolsv3' : 'pools';
		const isWaxInPool = (
			(pool.token0.contract === 'eosio.token' && pool.token0.symbol.ticker === 'WAX') 
			|| (pool.token1.contract === 'eosio.token' && pool.token1.symbol.ticker === 'WAX')
		);

		if(indexToken === -1) {
			// Add markets of token
			if(tokenType !== 'lptoken') {
				const vstoken = (tokenType === 'token0') ? pool.token1.getCopy() : pool.token0.getCopy()
				poolToken.in_pool = [{
					src: pool.src,
					src_type: pool_src_type,
					pairid: (pool.pairid === undefined) ? pool.id : pool.pairid,
					quote_amount: poolToken.amount,
					vstoken: vstoken
				}]
				poolToken.tvl = poolToken.amount
				poolToken.amount = 0 // mean nothing in a token list so better set to 0
				poolToken.wax_price = null

				if(this.tokensLiquidity[tokenHash] === undefined)
					this.tokensLiquidity[tokenHash] = 0

				if(poolToken.contract == 'eosio.token' && poolToken.getTicker() == 'WAX')
					poolToken.wax_price = 1
		    else if(isWaxInPool) {
		    	const liquidity = 1*((pool.token0.contract === 'eosio.token' && 'WAX' === pool.token0.symbol.ticker) ? pool.token0.amount : pool.token1.amount);
		    	if(pool.active === true && liquidity > 100 && liquidity > this.tokensLiquidity[tokenHash]) {
		    		this.tokensLiquidity[tokenHash] = liquidity
			      if(pool_src_type === 'pools' && pool.reserve0 > 0 && pool.reserve1 > 0) {
			        if(pool.token0.contract == 'eosio.token' && pool.token0.symbol.ticker == 'WAX')
			          poolToken.wax_price = pool.token0.amount / pool.token1.amount
			        else
			          poolToken.wax_price = pool.token1.amount / pool.token0.amount
			      }
			      else {
		          let price = PoolV3.getPrice(pool)

		          if(pool.token0.contract != 'eosio.token' && pool.token0.symbol.ticker != 'WAX')
		            poolToken.wax_price = price
		          else
		            poolToken.wax_price = (price > 0) ? 1/price : 0
			      }
		    	}
		    }
			}
			else
				poolToken.in_pool = [] // lptoken is not swapable

			poolToken.in_market = [] // will be eventually filled with market tokens generation

			this.tokens.push(poolToken)
		}
		else if(tokenType !== 'lptoken') {
			this.tokens[indexToken].tvl += poolToken.amount

			if(this.tokensLiquidity[tokenHash] === undefined)
				this.tokensLiquidity[tokenHash] = 0

			if(poolToken.contract == 'eosio.token' && poolToken.getTicker() == 'WAX')
				this.tokens[indexToken].wax_price = 1
	    else if(isWaxInPool) {
	    	const liquidity = 1*((pool.token0.contract === 'eosio.token' && 'WAX' === pool.token0.symbol.ticker) ? pool.token0.amount : pool.token1.amount);
	    	if(pool.active === true && liquidity > 100 && liquidity > this.tokensLiquidity[tokenHash]) {
	    		this.tokensLiquidity[tokenHash] = liquidity
		      if(pool_src_type === 'pools' && pool.reserve0 > 0 && pool.reserve1 > 0) {
		        if(pool.token0.contract == 'eosio.token' && pool.token0.symbol.ticker == 'WAX')
		          this.tokens[indexToken].wax_price = pool.token0.amount / pool.token1.amount
		        else
		          this.tokens[indexToken].wax_price = pool.token1.amount / pool.token0.amount
		      }
		      else {
	          let price = PoolV3.getPrice(pool)

	          if(pool.token0.contract != 'eosio.token' && pool.token0.symbol.ticker != 'WAX')
	            this.tokens[indexToken].wax_price = price
	          else
	            this.tokens[indexToken].wax_price = (price > 0) ? 1/price : 0
		      }
	    	}
	    }

			// If pool is not in_pool add it
			if(this.tokens[indexToken].in_pool.findIndex(ip => ip.src === ip.pairid && ip.pairid === pool.pairid) === -1) {
				const vstoken = (tokenType === 'token0') ? pool.token1.getCopy() : pool.token0.getCopy()
				this.tokens[indexToken].in_pool.push({
					src: pool.src,
					src_type: (pool.pairid === undefined) ? 'poolsv3' : 'pools',
					pairid: (pool.pairid === undefined) ? pool.id : pool.pairid,
					quote_amount: poolToken.amount,
					vstoken: vstoken
				})
			}
		}
	}

	addMarketToken(market, tokenType, token) {
		const indexToken = this.tokens.findIndex(t => 
			t.getTicker() === market[tokenType].getTicker()
			&& t.contract === market[tokenType].contract
		)

		if(indexToken === -1) {
			// Add token into this.tokens
			token.in_pool = []

			token.in_market = [{
				src: market.src, 
				id: market.id,
				vstoken: ((tokenType === 'token1') ? market.token0.getCopy() : market.token1.getCopy())	
			}]
			this.tokens.push(token)
		}
		else {
			// Add market into in_market
			const marketAlreadyInserted = (
				this.tokens[indexToken].in_market.findIndex(m => m.id === market.id && m.src === market.src) !== -1
			) ? true : false

			if(!marketAlreadyInserted)
				this.tokens[indexToken].in_market.push({
					src: market.src, 
					id: market.id,
					vstoken: ((tokenType === 'token1') ? market.token0.getCopy() : market.token1.getCopy())
				})
		}
	}

	async saveTokens() {
  	const jsonTokens = JSON.stringify(this.tokens)
  	const jsonTokensMinimal = JSON.stringify(this.tokens.map(t => {
  		return {
  			contract: t.contract,
  			symbol: t.symbol,
  			tvl: t.tvl,
  			wax_price: t.wax_price,
  			img: t.img,
  			is_tradeable: t.is_tradeable,
  			is_in_pool: t.is_in_pool,
				is_in_market: t.is_in_market
  		}
  	}))

    await this.redisClient.set('tokens', jsonTokens, {});
    await this.redisClient.set('tokens_minimal', jsonTokensMinimal, {});
	}
}

export default Tokens