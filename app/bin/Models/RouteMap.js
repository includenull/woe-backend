import Route from './Route.js'

import ArrayProcessor from './ArrayProcessor.js'

// Call static functions 
import Pool from './Pool.js'
import Market from './Market.js'
import PoolV3 from './PoolV3.js'
import PoolSpecial from '@models/PoolSpecial.js';
import Token from './Token.js'
import Tokens from '@models/Tokens.js';

import AppConfig from '../../config.js'

// Cache same route
import getRedis from '../Connectors/RedisConnector.js'

class RouteMap {
	constructor(getRpcIndexer) {
		this.redisClient = null
	
		this.getRpcIndexer = getRpcIndexer

		this.notTradeableTokens = []; // Tokens from Indexer with is_tradeable attribute set to false

		this.routes = []
		this.tokenMap = {} // in which market / pool a token is
		this.routePoolMap = {} // in which routes a pool is
		this.routeMarketMap = {} // in which routes a market is
		this.findRoutesCache = {}
		this.cacheExpiryTime = 48*3600 // seconds
	}

	async init() {
		this.redisClient = await getRedis()
		await this.generateTokenMap()
		this.notTradeableTokens = await Tokens.getTokens({ minimalData: true})
		this.notTradeableTokens = this.notTradeableTokens.filter(t => t.is_tradeable === false)
		//console.log('notTradeableTokens', this.notTradeableTokens)
	}

	containsNoswapTokens(swap_source) {
		if(AppConfig.noswap_contracts.includes(swap_source.token0.contract) || AppConfig.noswap_contracts.includes(swap_source.token1.contract))
			return true;

		if(this.notTradeableTokens.find(
			(t => t.contract === swap_source.token0.contract && t.symbol.ticker === swap_source.token0.symbol.ticker)
			|| (t => t.contract === swap_source.token1.contract && t.symbol.ticker === swap_source.token1.symbol.ticker)
		)) {
			return true;
		}

		return false;
	}

	/**
	 * Link in which market/pool a token is
	**/
	generateTokenMap() {
		for(const pool of this.getRpcIndexer().poolMap.getAllPools()) {
			if(this.containsNoswapTokens(pool))
				continue;

			if(!pool.active)
				continue;

			const poolKey = Pool.getHashStatic(pool);

			['token0', 'token1'].forEach((token) => {
				const tokenKey = pool[token].symbol.ticker+'_'+pool[token].contract
				if(this.tokenMap[tokenKey] === undefined)
					this.tokenMap[tokenKey] = []

				if(this.tokenMap[tokenKey].findIndex(tm => tm.src_type === 'pool' && tm.key === poolKey) === -1)
					this.tokenMap[tokenKey].push({src_type: 'pool', key: poolKey})
			})
		}

		for(const market of this.getRpcIndexer().marketMap.getAllMarkets().filter(m => !m.frozen)) {
			if(this.containsNoswapTokens(market))
				continue;

			const marketKey = Market.getHashStatic(market);

			['token0', 'token1'].forEach((token) => {
				const tokenKey = market[token].symbol.ticker+'_'+market[token].contract
				if(this.tokenMap[tokenKey] === undefined)
					this.tokenMap[tokenKey] = []

				if(this.tokenMap[tokenKey].findIndex(tm => tm.src_type === 'market' && tm.key === marketKey) === -1)
					this.tokenMap[tokenKey].push({src_type: 'market', key: marketKey})
			});
		}

		for(const pool of this.getRpcIndexer().poolV3Map.getAllPools()) {
			if(this.containsNoswapTokens(pool))
				continue;

			if(!pool.active)
				continue;

			const poolKey = PoolV3.getHashStatic(pool);

			['token0', 'token1'].forEach((token) => {
				const tokenKey = pool[token].symbol.ticker+'_'+pool[token].contract
				if(this.tokenMap[tokenKey] === undefined)
					this.tokenMap[tokenKey] = []

				if(this.tokenMap[tokenKey].findIndex(tm => tm.src_type === 'poolv3' && tm.key === poolKey) === -1)
					this.tokenMap[tokenKey].push({src_type: 'poolv3', key: poolKey})
			});
		}

    for(const pool of this.getRpcIndexer().poolSpecialMap.getAllPools()) {
      if(this.containsNoswapTokens(pool))
        continue;

      const poolKey = PoolSpecial.getHashStatic(pool);

      ['token0', 'token1'].forEach((token) => {
        const tokenKey = pool[token].symbol.ticker+'_'+pool[token].contract
        if(this.tokenMap[tokenKey] === undefined)
          this.tokenMap[tokenKey] = []

        if(this.tokenMap[tokenKey].findIndex(tm => tm.src_type === 'poolspecial' && tm.key === poolKey) === -1)
          this.tokenMap[tokenKey].push({src_type: 'poolspecial', key: poolKey})
      });
    }
	}

	/**
	 * Link in which route a pool is
	 * Useful after pools initialisation for getRoutesWithPool
	 **/
	generateRoutePoolMap() {
		for(let i = 0; i < this.routes.length; ++i) {
			if(!this.routes[i].src_types.includes('pool'))
				continue;

			for(let j = 0; j < this.routes[i].path.length; ++j) {
				const pathEl = this.routes[i].path[j]
				const pool = this.getRpcIndexer().poolMap.getPool(pathEl[0][0], pathEl[0][1])
				if(pool === null)
					continue;

				const poolHash = Pool.getHashStatic(pool)

				if(this.routePoolMap[poolHash] === undefined)
					this.routePoolMap[poolHash] = []

				if(this.routePoolMap[poolHash].indexOf(i) === -1)
					this.routePoolMap[poolHash].push(i)
			}
		}
	}

	/**
	 * Link in which route a market is
	 * Useful after markets initialisation for getRoutesWithMarket
	 **/
	generateRouteMarketMap() {
		for(let i = 0; i < this.routes.length; ++i) {
			if(!this.routes[i].src_types.includes('market'))
				continue;

			for(let j = 0; j < this.routes[i].path.length; ++j) {
				const pathEl = this.routes[i].path[j]
				const market = this.getRpcIndexer().marketMap.getMarket(pathEl[0][0], pathEl[0][1])
				if(market === null)
					continue;

				const marketHash = Market.getHashStatic(market)

				if(this.routeMarketMap[marketHash] === undefined)
					this.routeMarketMap[marketHash] = []

				if(this.routeMarketMap[marketHash].indexOf(i) === -1)
					this.routeMarketMap[marketHash].push(i)
			}
		}
	}

	getRoutesWithPool(src, id) {
		const pool = this.getRpcIndexer().poolMap.getPool(src, id)
		if(pool === null)
			return []

		const poolHash = Pool.getHashStatic(pool)

		let routes = []
		for(let i = 0; i < this.routePoolMap[poolHash].length; ++i)
			routes.push(this.routes[this.routePoolMap[poolHash][i]])

		return routes
	}

	getRoutesWithMarket(src, id) {
		const market = this.market.getMarket(src, id)
		if(market === null)
			return []

		const marketHash = Market.getHashStatic(market)

		let routes = []
		for(let i = 0; i < this.routeMarketMap[marketHash].length; ++i)
			routes.push(this.routes[this.routeMarketMap[marketHash][i]])

		return routes
	}

	async getRoutes(tokenIn, tokenOut) {
		this.findRoutesCache = {}
		const tokenInHash = tokenIn.symbol.ticker+'_'+tokenIn.contract
    const tokenOutHash = tokenOut.symbol.ticker+'_'+tokenOut.contract

    let routes = await this.redisClient.get(tokenInHash+'@'+tokenOutHash)
    let cache_time = await this.redisClient.get(tokenInHash+'@'+tokenOutHash+'_time')
    let sources_update_time = await this.redisClient.get('lastAddedOrDeletedSwapSource')

    if(sources_update_time === null) 
    	sources_update_time = 0;

		if(routes !== null && AppConfig.enableRouteMapCache && Number(cache_time) > Number(sources_update_time)) {
			//console.log('return routes from cache')
			routes = JSON.parse(routes)
			this.routes = routes
			//this.generateRoutePoolMap()
			//this.generateRouteMarketMap()
			return routes
		}

		//console.log('return routes from computing')
		try {
			routes = await this.computeAndGetRoutes(tokenIn, tokenOut)
			this.routes = routes
			//this.generateRoutePoolMap()
			//this.generateRouteMarketMap()
			return routes
		}
		catch(e) {
			console.error('ERROR COMPUTING ROUTES');
			console.error(e)
			return []
		}
	}

	async computeAndGetRoutes(tokenIn, tokenOut) {
		const routes = await this.findRoutes(
			tokenIn,
			tokenOut,
			1
		)

		if(routes.length > 0)
			await this.saveRoutes(tokenIn, tokenOut, routes)

		return routes
	}

	async findRoutes(tokenIn, tokenOut, maxDepth = 1, depth = 0, prevRoutes = [], filterOutput = true) {		
		let paramsHash = ''
		if(tokenIn !== null)
			paramsHash += tokenIn.contract+'_'+tokenIn.symbol.ticker
		if(tokenOut !== null)
			paramsHash += '&'+tokenOut.contract+'_'+tokenOut.symbol.ticker

		paramsHash = paramsHash+'@'+maxDepth+'@'+depth+prevRoutes.length

		if(this.findRoutesCache[paramsHash] !== undefined)
			return this.findRoutesCache[paramsHash]

    const tokenInHash = tokenIn.symbol.ticker+'_'+tokenIn.contract
    const tokenOutHash = (tokenOut !== null) ? tokenOut.symbol.ticker+'_'+tokenOut.contract : ''

    // if tokenIn or tokenOut are not in any pool
 		if(
			this.tokenMap[tokenInHash] === undefined ||
			(tokenOut !== null && undefined === this.tokenMap[tokenOutHash])
		)
 			return []

    let newRoutes = []

    if(depth === 0) {
    	const processor = new ArrayProcessor( async (tokenMapChunk) => {
    		let routes = []
	      for(const tokenMapEl of tokenMapChunk) {
	        const srcKey = tokenMapEl.key.split('_')
	        let src = null;

        	if(tokenMapEl.src_type === 'pool')
        		src = this.getRpcIndexer().poolMap.getPool(srcKey[0], srcKey[1])
        	else if(tokenMapEl.src_type === 'market')
        		src = this.getRpcIndexer().marketMap.getMarket(srcKey[0], srcKey[1])
        	else if(tokenMapEl.src_type === 'poolv3')
        		src = this.getRpcIndexer().poolV3Map.getPool(srcKey[0], srcKey[1])
          else if(tokenMapEl.src_type === 'poolspecial')
            src = this.getRpcIndexer().poolSpecialMap.getPool(srcKey[0], srcKey[1])

        	if(src === null)
        		continue;

	        const route = new Route([ tokenMapEl.src_type ])
	        if(src.token1.symbol.ticker === tokenIn.symbol.ticker && src.token1.contract == tokenIn.contract) {
	          route.add(srcKey, true, Token.getHashStatic(src.token1), Token.getHashStatic(src.token0), tokenMapEl.src_type)
	        }
	        else
	          route.add(srcKey, false, Token.getHashStatic(src.token0), Token.getHashStatic(src.token1), tokenMapEl.src_type)

	        routes.push(route)
	      }

	      return routes
    	}, 4);

      newRoutes = await processor.processArray(this.tokenMap[tokenInHash]);
    }
    else {
      // for each route find possible path
      const processor = new ArrayProcessor( async (prevRoutesChunk) => {
      	let routes = []
      	for(let i = 0; i < prevRoutesChunk.length; ++i) {
      		const prevRoute = prevRoutesChunk[i]
	        // Otherwise route is already complete	
	        if(prevRoute.path.length === depth) {
	        	const lastOutHash = prevRoute.path[prevRoute.path.length - 1][3]
	        	const lastOutHashSplit = lastOutHash.split('_')

	          // If last route pool out != tokenOut
	          if(lastOutHash !== tokenOutHash) {

							if(this.tokenMap[lastOutHash] !== undefined) {
	              // we don't provide out token for findRoutes as we want all possible path
	              const possiblePaths = await this.findRoutes(
	              	{contract: lastOutHashSplit[1], symbol: {ticker: lastOutHashSplit[0]}},
	              	null, 0, 0, [], false
	              )

	              for(let j = 0; j < possiblePaths.length; ++j) {
	              	const newR = new Route(
	              		prevRoute.src_types.concat(possiblePaths[j].src_types.filter(x => !prevRoute.src_types.includes(x))),
	              		prevRoute.path.concat(possiblePaths[j].path)
	              	);
	                routes.push(newR)
	              }
	            }
	            // else do nothing route is a dead end

	          }
	          else
	            routes.push(prevRoute)
	        }
	        else
	          routes.push(prevRoute)
      	}
        return routes
      }, 6);

			newRoutes = await processor.processArray(prevRoutes);
    }

    if(depth < maxDepth) {
      return await this.findRoutes(tokenIn, tokenOut, maxDepth, depth + 1, newRoutes)
    }
    else {
      // Remove uncomplete routes
      if(filterOutput) {
      	const processor = new ArrayProcessor( async (routesChunk) => {
    			return routesChunk.filter(r => r.path[r.path.length - 1][3] === tokenOutHash)
    		}, 4);
 	     	newRoutes = await processor.processArray(newRoutes);
      }

			this.findRoutesCache[paramsHash] = newRoutes
      return newRoutes
    }
  }

  async delRoutes(tokenIn, tokenOut) {
  	const tokenInHash = tokenIn.symbol.ticker+'_'+tokenIn.contract
    const tokenOutHash = tokenOut.symbol.ticker+'_'+tokenOut.contract

  	await this.redisClient.del(tokenInHash+'@'+tokenOutHash)
  }

  async saveRoutes(tokenIn, tokenOut, routes) {
  	const jsonRoutes = JSON.stringify(routes)
    const tokenInHash = tokenIn.symbol.ticker+'_'+tokenIn.contract
    const tokenOutHash = tokenOut.symbol.ticker+'_'+tokenOut.contract

    await this.redisClient.set(tokenInHash+'@'+tokenOutHash, jsonRoutes, {
		  EX: this.cacheExpiryTime,
		  NX: false
		});
		await this.redisClient.set(tokenInHash+'@'+tokenOutHash+'_time', Date.now(), {
		  EX: this.cacheExpiryTime,
		  NX: false
		});
  }


}

export default RouteMap