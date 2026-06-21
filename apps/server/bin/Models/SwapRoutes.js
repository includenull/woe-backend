import RouteMap from './RouteMap.js'

import Pool from './Pool.js'
import PoolV3 from './PoolV3.js'
import Market from './Market.js'
import PoolSpecial from '@models/PoolSpecial.js';

import Swap from '../Exchanges/Swap.js'

import Binarysearch from '../../utils/Binarysearch.js'

import { precise } from '../../utils/utils.js'

export default class SwapRoutes {
	constructor(getRpcIndexer, getRowsIndexer) {
		this.getRpcIndexer = getRpcIndexer
		this.getRowsIndexer = getRowsIndexer

    this.amount_in = 0
		this.token_in = null
		this.token_out = null
    this.slippage = 50
    this.receiver = ''
    this.limit = -1

		this.routes = []
		this.deepestRoutes = []
		this.bestRoutes = []
		this.bestRoutesMap = {}
		this.splitRoutes = []
  	this.splitRoutesMap = {}
  	this.viewRoutes = []

  	this.filterExchange = []
  	this.filterType = []

  	this.numberOfDistinctBRSplit = 6
	}

	async getSwapRoutes({ token_in, token_out, amount_in, slippage, receiver, split_max_routes, filter_exchange, filter_type, limit }) {
    this.amount_in = Number(amount_in)
		this.token_in = token_in
		this.token_out = token_out
    this.slippage = slippage
    this.receiver = receiver
    this.numberOfDistinctBRSplit = Math.min(10, Math.max(0, Number(split_max_routes)))
    this.filterExchange = (null !== filter_exchange && undefined !== filter_exchange) ? filter_exchange : []
    this.filterType = (null !== filter_type && undefined !== filter_type) ? filter_type : []
    this.limit = (limit !== undefined) ? limit : -1;

		const routeMap = new RouteMap(this.getRpcIndexer)
		await routeMap.init()
		this.routes = await routeMap.getRoutes(token_in, token_out)
		this.filterDeepestRoutes()
		await this.computeBestRoutes(this.amount_in)
		await this.computeSplitRoutes()
		this.computeViewRoutes()

		return this.makeJsonOutput()
	}

	filterDeepestRoutes() {
		const maxRoutes = 100 // max per src_type
    let routesData = []

    // Populate routesData
    for(let i = 0; i < this.routes.length; ++i) {
      const route = this.routes[i]
			const { pools, markets, poolsV3, poolsspecial, srcedPath } = this.getSourcesOfRoutes(route)

      let fees = 0
      let isLiquidityPositive = true

      for(const pool of pools) {
        fees += 1*pool.fee
        if(pool.token0.amount === 0 || 0 === pool.token1.amount)
          isLiquidityPositive = false
      }

      for(const pool of poolsspecial) {
        fees += Number(pool.fee)
      }

      // avoid additionnal computation
      if(!isLiquidityPositive)
        continue;

      let areMarketsLoaded = (route.src_types.includes('market') && markets.length > 0) ? true : false;
      for(const market of markets) {
        fees += 1*market.fee

        let buy_orderbook = this.getRowsIndexer().getRowsFromCodeTableScope('alcordexmain', 'buyorder', market.id);
        if(buy_orderbook === null || undefined === buy_orderbook)
          buy_orderbook = []
        let sell_orderbook = this.getRowsIndexer().getRowsFromCodeTableScope('alcordexmain', 'sellorder', market.id); 
        if(sell_orderbook === null || undefined === sell_orderbook)
          sell_orderbook = []

        if(( buy_orderbook.length + sell_orderbook.length ) === 0) {
          areMarketsLoaded = false
          break;
        }
      }

      if(route.src_types.includes('market') && !areMarketsLoaded)
        continue;

      for(const poolV3 of poolsV3) {
        fees += 1*poolV3.fee + 1*poolV3.feeProtocol
        // If no liquidity for output token or no ticks in pools
        if(0 === poolV3.token1.amount)
          isLiquidityPositive = false
        else {
          const poolTicks = this.getRowsIndexer().getRowsFromCodeTableScope('swap.alcor', 'ticks', poolV3.id)
          if(poolTicks === null || undefined === poolTicks)
            isLiquidityPositive = false
          else if(poolTicks?.length === 0)
            isLiquidityPositive = false
        }
      }

      // avoid additionnal computation
      if(!isLiquidityPositive)
        continue;

      // must check markets orderbook too

      routesData.push({
        i,
        pools,
        markets,
        poolsV3,
        poolsspecial,
        srcedPath,
        fees,
        areMarketsLoaded // if all markets orderbooks are loaded
      })
    }

    // Separate by src_types and remove not loaded markets orderbooks routes
    const separatedRoutesData = {
      'pool' : [],
      'market': [],
      'poolv3': [],
      'poolspecial': [],
      'pool_market': [],
      'poolv3_market': [],
      'pool_poolv3': [],
      'poolspecial_pool': [],
      'poolspecial_poolv3': [],
      'poolspecial_market': []
      // only 2 src / route max for now so no need for more types
    }
    for(const routeData of routesData) {
      const route = this.routes[routeData.i]

      routeData.routeLiquidity = this.getRouteLiquidity(routeData)

      if(route.src_types.length === 1)
        separatedRoutesData[route.src_types[0]].push(routeData)
      else { // else if length === 2
        if(route.src_types.includes('pool') && route.src_types.includes('market'))
          separatedRoutesData['pool_market'].push(routeData)
        else if(route.src_types.includes('pool') && route.src_types.includes('poolv3'))
          separatedRoutesData['pool_poolv3'].push(routeData)
        else if(route.src_types.includes('poolv3') && route.src_types.includes('market'))
          separatedRoutesData['poolv3_market'].push(routeData)
        else if(route.src_types.includes('poolspecial') && route.src_types.includes('pool'))
          separatedRoutesData['poolspecial_pool'].push(routeData)
        else if(route.src_types.includes('poolspecial') && route.src_types.includes('poolv3'))
          separatedRoutesData['poolspecial_poolv3'].push(routeData)
        else if(route.src_types.includes('poolspecial') && route.src_types.includes('market'))
          separatedRoutesData['poolspecial_market'].push(routeData)
      }
    }

    // sort by pools best depth
    separatedRoutesData.pool.sort((a, b) => {
      if(isNaN(a.routeLiquidity.output))
        return 1
      if(isNaN(b.routeLiquidity.output))
        return -1
      return (b.routeLiquidity.output) - (a.routeLiquidity.output)
    })
    // Market sorting missing 
    // Market + pool sorting missing
    // Pools v3 sorting missing

    let deepestRoutes = []
    for(const src_type of Object.keys(separatedRoutesData) ) {
      for(let i = 0; i < Math.min(separatedRoutesData[src_type].length, maxRoutes); ++i) {
        const route = {
          src_types: this.routes[separatedRoutesData[src_type][i].i].src_types,
          path: this.routes[separatedRoutesData[src_type][i].i].path
        }

        route.i = separatedRoutesData[src_type][i].i
        route.type = (
          ( (separatedRoutesData[src_type][i].pools.length + separatedRoutesData[src_type][i].poolsspecial.length + separatedRoutesData[src_type][i].poolsV3.length + separatedRoutesData[src_type][i].markets.length ) > 1 )
          ? 'routing' : 'direct'
        );
        route.pools = separatedRoutesData[src_type][i].pools
        route.markets = separatedRoutesData[src_type][i].markets
        route.poolsV3 = separatedRoutesData[src_type][i].poolsV3
        route.poolsspecial = separatedRoutesData[src_type][i].poolsspecial
        route.srcedPath = separatedRoutesData[src_type][i].srcedPath
        route.fees = separatedRoutesData[src_type][i].fees
        route.exchanges = separatedRoutesData[src_type][i].pools.map(
            p => p.src
          ).concat(
            separatedRoutesData[src_type][i].markets.map(
              m => m.src
          )).concat(
            separatedRoutesData[src_type][i].poolsV3.map(
              p => p.src
          )).concat(
            separatedRoutesData[src_type][i].poolsspecial.map(
              p => p.src
          ));

        route.routeLiquidity  = separatedRoutesData[src_type][i].routeLiquidity
        route.hash = separatedRoutesData[src_type][i].pools.reduce(
            (hash, pool) => hash + pool.src+'_'+pool.pairid+'|', ''
          ).slice(0, -1)
          +separatedRoutesData[src_type][i].markets.reduce(
            (hash, market) => hash + market.src+'_'+market.id+'|', ''
          ).slice(0, -1)
          +separatedRoutesData[src_type][i].poolsV3.reduce(
            (hash, poolV3) => hash + poolV3.src+'_'+poolV3.id+'|', ''
          ).slice(0, -1)
          +separatedRoutesData[src_type][i].poolsspecial.reduce(
            (hash, pool) => hash + pool.src+'_'+pool.id+'|', ''
          ).slice(0, -1)
        deepestRoutes.push(route)
      }
    }

    this.deepestRoutes = deepestRoutes
	}

	async computeBestRoutes(amount_in) {
   	const bestRoutes = []

    for(let i = 0; i < this.deepestRoutes.length; ++i) {
      let route = {
        type: this.deepestRoutes[i].type,
        src_types: this.deepestRoutes[i].src_types,
        path : this.deepestRoutes[i].path,
        i : this.deepestRoutes[i].i,
        fees: this.deepestRoutes[i].fees,
        platform_fees: 10000*this.getRoutePlatformFees(this.deepestRoutes[i]),
        hash: this.deepestRoutes[i].hash,
        pools: this.deepestRoutes[i].pools,
        markets: this.deepestRoutes[i].markets,
        poolsspecial: this.deepestRoutes[i].poolsspecial,
        poolsV3: this.deepestRoutes[i].poolsV3,
        srcedPath: this.deepestRoutes[i].srcedPath,
        exchanges: this.deepestRoutes[i].exchanges,
        routeLiquidity : this.deepestRoutes[i].routeLiquidity,
      }

      route.in = amount_in
      route.outs = await this.getAmountsOutOfRoute(route, route.in)
      route.out = (route.outs.length) ? route.outs[route.outs.length - 1] : 0

      bestRoutes.push(route)
    }

    if(amount_in !== undefined) // sort by best output
      bestRoutes.sort((a, b) => b.out - a.out)
    else { // sort by lowest > 0 input
      bestRoutes.sort((a, b) => {
        if(a.in < 0)
          return 1
        if(b.in < 0)
          return -1

        return a.in - b.in
      })
    }
    this.bestRoutes = bestRoutes
    this.computeBestRoutesMap()
  }

  computeBestRoutesMap() {
    let bestRoutesMap = {}
    for(let i = 0; i < this.bestRoutes.length; ++i)
      bestRoutesMap[this.bestRoutes[i].hash] = i

    this.bestRoutesMap = bestRoutesMap
  }

  async computeSplitRoutes() {
    let bestDistinctSrcRoutes = this.selectBestDistincSrcRoutes()

    let splitRoutes = []

    // Best pool routes
    if(bestDistinctSrcRoutes.length > 1) {
      let searchOutput = await Binarysearch.findMaxOutputIter(
        async (route, bid) => await this.getAmountsOutOfRoute(route, bid),
        bestDistinctSrcRoutes.map(brI => this.bestRoutes[brI]),
        this.bestRoutes[0].in // user bid
      );

      // Round inputs to input token precisionl
      searchOutput.inputs = searchOutput.inputs.map(i => 1*i.toFixed(this.token_in.symbol.precision))
      const total = 1* searchOutput.inputs.reduce((total, v) => total += v, 0).toFixed(this.token_in.symbol.precision)
      const expectedTotal = 1*this.bestRoutes[0].in
      

      if(total > expectedTotal) {
        // Find index of lowest value above 0
        let minValue = Number.POSITIVE_INFINITY;
        let minIndex = -1;

        for (let i = 0; i < searchOutput.inputs.length; i++) {
          if (searchOutput.inputs[i] > 0 && searchOutput.inputs[i] < minValue) {
            minValue = searchOutput.inputs[i];
            minIndex = i;
          }
        }

        searchOutput.inputs[minIndex] -= total - expectedTotal
        searchOutput.inputs[minIndex] = 1*searchOutput.inputs[minIndex].toFixed(this.token_in.symbol.precision)
      }
      else if(total < expectedTotal) {
        // Find index of max value
        let maxValue = Number.NEGATIVE_INFINITY;
        let maxIndex = -1;

        // Iterate through the array
        for (let i = 0; i < searchOutput.inputs.length; i++) {
          if (searchOutput.inputs[i] > maxValue) {
            maxValue = searchOutput.inputs[i];
            maxIndex = i;
          }
        }

        searchOutput.inputs[maxIndex] -= expectedTotal - total
        searchOutput.inputs[maxIndex] = 1*searchOutput.inputs[maxIndex].toFixed(this.token_in.symbol.precision)
      }

      // Remove not used routes
      const tmpNewBestDistinctSrcRoutes = []
      const tmpNewSearchOutput = {
        inputs: [],
        outputs: []
      }
      for(let i = 0; i < searchOutput.outputs.length; ++i) {
        if(searchOutput.outputs[i] > 0) {
          tmpNewBestDistinctSrcRoutes.push(bestDistinctSrcRoutes[i])
          tmpNewSearchOutput.inputs.push(searchOutput.inputs[i])
          tmpNewSearchOutput.outputs.push(searchOutput.outputs[i])
        }
      }
      bestDistinctSrcRoutes = tmpNewBestDistinctSrcRoutes
      searchOutput = tmpNewSearchOutput

      const fees = bestDistinctSrcRoutes.reduce(
        (fees, brI, index) => fees += this.bestRoutes[brI].fees * searchOutput.inputs[index]/this.bestRoutes[brI].in
      , 0)

      const platform_fees = bestDistinctSrcRoutes.reduce(
        (platform_fees, brI, index) => platform_fees += this.bestRoutes[brI].platform_fees * searchOutput.inputs[index]/this.bestRoutes[brI].in
      , 0)

      if(searchOutput.inputs.filter(v => v > 0).length > 1)
        splitRoutes.push({
          routes: bestDistinctSrcRoutes,
          type: 'split',
          hash: bestDistinctSrcRoutes.reduce((hash, ibr) => hash += this.bestRoutes[ibr].hash + '&', '').slice(0, -1),
          exchanges: bestDistinctSrcRoutes.reduce((ex, ibr) => ex = ex.concat(this.bestRoutes[ibr].exchanges), []),
          ins: searchOutput.inputs,
          in: this.bestRoutes[0].in,
          outs: searchOutput.outputs,
          fees: fees,
          platform_fees,
          out: searchOutput.outputs.reduce((t, o) => t += o, 0),
          routeLiquidity: {
            input: bestDistinctSrcRoutes.reduce((total, ibr) => total = total + this.bestRoutes[ibr].routeLiquidity.input, 0),
            output: bestDistinctSrcRoutes.reduce((total, ibr) => total = total + this.bestRoutes[ibr].routeLiquidity.output, 0)
          }
        })
    }
    
    this.splitRoutes = splitRoutes
    this.computeSplitRoutesMap()
  }

  computeSplitRoutesMap() {
    let splitRoutes = this.splitRoutes.slice()
    let splitRoutesMap = {}

    for(let i = 0; i < splitRoutes.length; ++i)
      splitRoutesMap[splitRoutes[i].hash] = i

    this.splitRoutesMap = splitRoutesMap
  }
  async computeViewRoutes() {
    let viewRoutes = []

    let bestRoutes = this.bestRoutes.slice()
    bestRoutes = bestRoutes.filter(br => (
      !this.filterExchange.length || br.exchanges.length == br.exchanges.filter(src => this.filterExchange.indexOf(src) !== -1).length
    ))
    let splitRoutes = this.splitRoutes.slice()
    splitRoutes = splitRoutes.filter(sr => {
      for(const ir of sr.routes)
        if(!(
          !this.filterExchange.length || this.bestRoutes[ir].exchanges.length == this.bestRoutes[ir].exchanges.filter(src => this.filterExchange.indexOf(src) !== -1).length
        ))
          return false

      return true
    })

    viewRoutes = bestRoutes.concat(splitRoutes)
      .filter(vr => (!this.filterType.length || this.filterType.indexOf(vr.type) !== -1))
      .sort((a, b) => {
        if((b.out === a.out) && ((b.type === 'split' && a.type !== 'split') || (a.type === 'split' && b.type !== 'split')) )
          return (a.type !== 'split') ? -1 : 1
        else
          return b.out - a.out
      })

    this.viewRoutes = viewRoutes
  }

	// GETTERS
	makeJsonOutput() {
		const output = []

    const swap = new Swap(this.bestRoutes)

    let i = 0;
		for(const vr of this.viewRoutes) {
      const minimums = this.getMinimumsReceived(vr)
			const json = {}

      json.hash = vr.hash
      json.exchanges = vr.exchanges
      json.markets = vr.markets
      json.path = vr.path
      json.pools = vr.pools
      json.poolsV3 = vr.poolsV3
      json.poolsspecial = vr.poolsspecial
      json.routeLiquidity = vr.routeLiquidity
      json.src_types = vr.src_types
      json.srcedPath = vr.srcedPath
      json.route_price = this.getRoutePrice(vr)

      if(vr.type === 'split')
        json.routes = vr.routes.map(route_index => this.bestRoutes[route_index].hash)

      json.type = vr.type
      json.fees = vr.fees
      json.platform_fees = vr.platform_fees
      json.amount_in = vr.in
      if(vr.type === 'split')
        json.amounts_in = vr.ins
      json.amount_received = vr.out
      json.amounts_received = vr.outs
      json.minimum_received = minimums.reduce((total, m) => total += m, 0)
      json.minimums_received = minimums
			json.actions = swap.swapActions({
        bid: this.amount_in,
        minimums,
        tokenA: this.token_in,
        tokenB: this.token_out,
        route: this.getAssociatedRoute(vr),
        receiver: this.receiver
      })

			output.push(json)

      ++i;
      if(this.limit > -1 && i >= this.limit)
        break;
		}

		return output
	}
  selectBestDistincSrcRoutes() {
    if(this.numberOfDistinctBRSplit === 0)
      return []

    // Create a data structure to store routes with unique sources.
    const uniqueSourceRoutes = [];

    for (let i = 0; i < this.bestRoutes.length; i++) {
      if(
        this.filterExchange.length
        && this.bestRoutes[i].exchanges.length !== this.bestRoutes[i].exchanges.filter(src => this.filterExchange.indexOf(src) !== -1).length
      )
        continue;

      if (this.bestRoutes[i].src_types.length === 1) {
        // Extract the sources from the current route.
        const currentSources = new Set(
          this.bestRoutes[i].srcedPath.map((srcPath) => {
            const src = this.bestRoutes[i][srcPath.type][srcPath.index].src;
            const id = srcPath.type === 'pools'
              ? this.bestRoutes[i][srcPath.type][srcPath.index].pairid
              : this.bestRoutes[i][srcPath.type][srcPath.index].id;
            return src + '_' + id;
          })
        );

        // Check if the sources in the current route are unique.
        const isUnique = !uniqueSourceRoutes.some((route) => {
          const intersection = new Set([...route.sources].filter((x) => currentSources.has(x)));
          return intersection.size > 0;
        });

        if (isUnique) {
          // Add the route to the unique source routes.
          uniqueSourceRoutes.push({
            index: i,
            sources: currentSources,
          });
        }
      }
    }

    // Sort the unique source routes by their index.
    uniqueSourceRoutes.sort((a, b) => a.index - b.index);

    // Select up to 3 routes with different sources.
    const selectedRoutes = uniqueSourceRoutes.slice(0, this.numberOfDistinctBRSplit).map((route) => route.index);

    // Log the selected routes.

    return selectedRoutes;
  }
  getRoutePlatformFees (route) {
    if(route === undefined)
      return 0

    if(route.path !== undefined)
      return (route.path.length > 1) ? 30 / 10000 : 0
    
    let fees = 0
    for(let i = 0; i < route.routes.length; ++i)
      fees += (this.bestRoutes[route.routes[i]].path.length > 1) ? (30 * route.ins[i]) / (10000 * route.in)  : 0

    return fees
  }
  getAssociatedRoute(viewRoute) {
    if(viewRoute.type === 'split')
      return this.splitRoutes[this.splitRoutesMap[viewRoute.hash]]
    else
      return this.bestRoutes[this.bestRoutesMap[viewRoute.hash]]
  }
  getMinimumsReceived(viewRoute) {
    const route = this.getAssociatedRoute(viewRoute)
    // if splitted route
    if(viewRoute.type === 'split') {
      let minimums = []
      for(let i = 0; i < route.routes.length; ++i)
        minimums.push((1 - this.slippage/10000) * route.outs[i])

      return minimums
    }
    else
      return [(1 - this.slippage/10000) * route.out]
  }
  async getAmountsOutOfRoute(route, bid) {
    let outs = []
    for(let j = 0; j < route.path.length; ++j) {
      const routeEl = route.path[j]
      const lastOut = (outs.length) ? outs[outs.length - 1] : 0
      const toBid = (j === 0) ? bid : lastOut

      let pool = this.getRpcIndexer().poolMap.getPool(routeEl[0][0], routeEl[0][1])
      const market = this.getRpcIndexer().marketMap.getMarket(routeEl[0][0], routeEl[0][1])
      const poolV3 = this.getRpcIndexer().poolV3Map.getPool(routeEl[0][0], routeEl[0][1])
      let poolSpecial = this.getRpcIndexer().poolSpecialMap.getPool(routeEl[0][0], routeEl[0][1])

      const feesMult = (j == route.path.length - 1)
        ? (1 - this.getRoutePlatformFees(route))
        : 1

      if(pool !== null) {
        // if isReverse
        if(routeEl[1])
          pool = Pool.reversePool(pool)

        outs.push(1*precise(feesMult* Pool.getAmountOutPool(pool, toBid), pool.token1.symbol.precision))
      }
      else if(market !== null) {
        // if isReverse
        const side = ((routeEl[1]) ? 'sell' : 'buy')
        const oppositeside = (side === 'buy') ? 'sell' : 'buy';
        const orderbook = this.getRowsIndexer().getRowsFromCodeTableScope('alcordexmain', oppositeside+'order', market.id)
        const out = Market.getAmountOutOfMarket(market, orderbook, toBid, side);
        outs.push(1*precise(feesMult* out, ((routeEl[1]) ? market.token0.symbol.precision : market.token1.symbol.precision) ))
      }
      else if(poolV3 !== null) {
      	const ticks = this.getRowsIndexer().getRowsFromCodeTableScope('swap.alcor', 'ticks', poolV3.id).sort((a, b) => a.id - b.id)
        const out = await PoolV3.getAmountOutOfPool(poolV3, ticks, toBid, routeEl[1]);
        outs.push(1*precise(feesMult* out, ((routeEl[1]) ? poolV3.token0.symbol.precision : poolV3.token1.symbol.precision) ))
      }
      else if(poolSpecial !== null) {
        // if isReverse
        if(routeEl[1])
          poolSpecial = PoolSpecial.reversePool(poolSpecial)

        const out = PoolSpecial.getAmountOutStatic(poolSpecial, toBid)
        outs.push(1* precise(feesMult* out, poolSpecial.token1.symbol.precision) )
      }
    }

    return outs
  }

  getRouteLiquidity(routeData) {
    let input = 0
    let output = 0

    for(let i = 0; i < routeData.srcedPath.length; ++i) {
      const srcedPath = routeData.srcedPath[i]
      const src = routeData[srcedPath.type][srcedPath.index]

      if(!['markets'].includes(srcedPath.type)) {
        if(i === 0) {
          input = src.token0.amount
          output = src.token1.amount
        }
        else {
          if(output < src.token0.amount) {
            // We reduce output depending on last output size compared to currentsrc input
            output = src.token1.amount * output / src.token0.amount
          }
          else {
            // We reduce route input depending on current src output size
            input = input * src.token0.amount / output
            output = src.token1.amount
          }
        }
      }
      else {
        // Other type of source liquidity to implement
      }
    }

    return { input, output }
  }
	getSourcesOfRoutes(route) {
    let srcs = {
      pools: [],
      markets: [],
      poolsV3: [],
      poolsspecial: [],
      srcedPath: [], // {type, index}..
    }

    for(let i = 0; i < route.path.length; ++i) {
      const routeEl = route.path[i]

      if(routeEl[4] === 'pool') {
        let pool = this.getRpcIndexer().poolMap.getPool(routeEl[0][0], routeEl[0][1])
        if(pool !== null) {
          // if isReverse
          if(routeEl[1])
            pool = Pool.reversePool(pool)

          srcs.srcedPath.push({type: 'pools', index: srcs.pools.length})
          srcs.pools.push(pool)
        }
      }
      else if(routeEl[4] === 'poolv3') {
        let poolV3 = this.getRpcIndexer().poolV3Map.getPool(routeEl[0][0], routeEl[0][1])
        if(poolV3 !== null) {
          // if isReverse
          if(routeEl[1]) {
            poolV3 = PoolV3.reversePool(poolV3) // warning only reverse token without tick/sqrtPrice
          }

          srcs.srcedPath.push({type: 'poolsV3', index: srcs.poolsV3.length})
          srcs.poolsV3.push(poolV3)
        }
      }
      else if(routeEl[4] === 'market') {
        let market = this.getRpcIndexer().marketMap.getMarket(routeEl[0][0], routeEl[0][1])
        if(market !== null) {
          // if isReverse
          if(routeEl[1])
            market = Market.reverseMarket(market)

          srcs.srcedPath.push({type: 'markets', index: srcs.markets.length})
          srcs.markets.push(market)
        }
      }
      else if(routeEl[4] === 'poolspecial') {
        let pool = this.getRpcIndexer().poolSpecialMap.getPool(routeEl[0][0], routeEl[0][1])
        if(pool !== null) {
          // if isReverse
          if(routeEl[1])
            pool = PoolSpecial.reversePool(pool)

          srcs.srcedPath.push({type: 'poolsspecial', index: srcs.poolsspecial.length})
          srcs.poolsspecial.push(pool)
        }
      }
    }

    return srcs
  }
  getRoutePrice(route) {
    if(route === undefined)
      return 1

    let price = 1

    // Splitted route
    if(route.routes !== undefined){
      if(route.amount_in === 0)
        return 1

      price = 0
      let totalIn = 0
      for(let i = 0; i < route.routes.length; ++i) {
        const routePrice = this.getRoutePrice(this.bestRoutes[route.routes[i]])
        if(routePrice > 0) {
          price += route.ins[i]*routePrice
          totalIn += route.ins[i]
        }
      }
      return price / totalIn
    }

    for(let i = 0; i < route.srcedPath.length; ++i) {
      const srcedPath = route.srcedPath[i]
      const src = route[srcedPath.type][srcedPath.index]
      if(srcedPath.type === 'pools') {
        price *= (!route.path[i][1]) ? src.price : 1/src.price;
      }
      else if(srcedPath.type === 'poolsV3') {
        price *= (route.path[i][1]) ? PoolV3.getPrice(src) : 1/PoolV3.getPrice(src);
      }
      else if(srcedPath.type === 'markets') {
        if(src.lastPrice)
          price *= (route.path[i][1]) ? 1/(src.lastPrice / Math.pow(10, 8)) : (src.lastPrice / Math.pow(10, 8));
      }
      else if(srcedPath.type === 'poolsspecial') {
        price *= (route.path[i][1]) ? PoolSpecial.getPriceStatic(src) : 1/PoolSpecial.getPriceStatic(src);
      }
    }

    return price
  }
}