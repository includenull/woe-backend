import AlcorPoolV3 from '@exchanges/AlcorPoolV3.js'
import AlcorMarket from '@exchanges/AlcorMarket.js'
import DefiboxPool from '@exchanges/DefiboxPool.js'
import ADexPool from '@exchanges/ADexPool.js';
import NeftyPool from '@exchanges/NeftyPool.js';
import TacoPool from '@exchanges/TacoPool.js'
import Waxonedge from '@exchanges/Waxonedge.js'
import WaxFusionPoolSpecial from '@exchanges/WaxFusionPoolSpecial.js'

export default class Swap {
	constructor(bestRoutes) {
		this.bestRoutes = bestRoutes
	}
	swapActions({ bid, minimums, tokenA, tokenB, route, receiver }) {   
    if(route.type === 'split') {
      return this.splitSwapActions({
        minimums,
        tokenA,
        tokenB,
        route,
        receiver
      })
    }
    else if(route.path.length === 1) {
    	if(route.path[0][0][0] === 'alcorv2') {
				return [AlcorPoolV3.makeSwapAction({
          bid: bid,
          minimum: minimums[0],
          tokenA: tokenA,
          tokenB: tokenB,
          poolId: route.poolsV3[0].id,
          receiver,
				})]
      }
      else if(route.path[0][0][0] === 'taco') {
      	return [TacoPool.makeSwapAction({
          bid: bid,
          minimum: minimums[0],
          tokenA: tokenA,
          tokenB: tokenB,
      	})]
      }
      else if(route.path[0][0][0] === 'defibox') {
        return [DefiboxPool.makeSwapAction({
          bid: bid,
          minimum: minimums[0],
          tokenA: tokenA,
          tokenB: tokenB,
          pool: route.pools[0],
        })]
      }
      else if(route.path[0][0][0] === 'neftyblocks') {
        return [NeftyPool.makeSwapAction({
          bid: bid,
          minimum: minimums[0],
          tokenA: tokenA,
          tokenB: tokenB,
          pool: route.pools[0],
        })]
      }
      else if(route.path[0][0][0] === 'adex') {
        return [ADexPool.makeSwapAction({
          bid: bid,
          minimum: minimums[0],
          tokenA: tokenA,
          tokenB: tokenB,
          pool: route.pools[0],
        })]
      }
      else if(route.path[0][0][0] === 'alcormarket') {
        // Use WaxOnEdge contract to avoid the market order before a limit order
        return[Waxonedge.makeSwapAction({
          bid: bid,
          minimum: minimums[0],
          tokenA: tokenA,
          tokenB: tokenB,
          route
        })];
      	/*return [AlcorMarket.makeTradeAction({
          bid: bid,
          minimum: minimums[0],
          tokenA: tokenA,
          tokenB: tokenB,
          route,
          fromSwap: true,
      	})]*/
      }
      else if(route.path[0][0][0] === 'waxfusion') {
        return WaxFusionPoolSpecial.makeSwapActions({
          bid: bid,
          tokenA: tokenA,
          tokenB: tokenB,
          pool: route.poolsspecial[0],
          receiver
        });
      } 
    }
    else {
    	return [Waxonedge.makeSwapAction({
        bid: bid,
        minimum: minimums[0],
        tokenA: tokenA,
        tokenB: tokenB,
        route
    	})]
    }
  }
	splitSwapActions({ minimums, tokenA, tokenB, route, receiver }) {
    let actions = []
    for(let i = 0; i < route.routes.length; ++i) {
      const bid = route.ins[i]
      const r = this.bestRoutes[route.routes[i]]

      if(r.path.length === 1) {
        if(r.path[0][0][0] === 'alcorv2') {
          actions.push(AlcorPoolV3.makeSwapAction({
            bid: bid,
            minimum: minimums[i],
            tokenA: tokenA,
            tokenB: tokenB,
            poolId: r.poolsV3[0].id,
            receiver
          }))
        }
        else if(r.path[0][0][0] === 'alcormarket') {
          // Use WaxOnEdge contract to avoid the market order before a limit order
          actions.push(Waxonedge.makeSwapAction({
            bid: bid,
            minimum: minimums[i],
            tokenA: tokenA,
            tokenB: tokenB,
            route: r
          }))
        }
        else if(r.path[0][0][0] === 'taco') {
          actions.push(TacoPool.makeSwapAction({
            bid: bid,
            minimum: minimums[i],
            tokenA: tokenA,
            tokenB: tokenB
          }))
        }
        else if(r.path[0][0][0] === 'defibox') {
          actions.push(DefiboxPool.makeSwapAction({
            bid: bid,
            minimum: minimums[i],
            tokenA: tokenA,
            tokenB: tokenB,
            pool: r.pools[0]
          }))
        }
        else if(r.path[0][0][0] === 'neftyblocks') {
          actions.push(NeftyPool.makeSwapAction({
            bid: bid,
            minimum: minimums[i],
            tokenA: tokenA,
            tokenB: tokenB,
            pool: r.pools[0]
          }))
        }
        else if(r.path[0][0][0] === 'adex') {
          actions.push(ADexPool.makeSwapAction({
            bid: bid,
            minimum: minimums[i],
            tokenA: tokenA,
            tokenB: tokenB,
            pool: r.pools[0]
          }))
        }
        else if(r.path[0][0][0] === 'waxfusion') {
          actions = actions.concat(WaxFusionPoolSpecial.makeSwapActions({
            bid: bid,
            tokenA: tokenA,
            tokenB: tokenB,
            pool: r.poolsspecial[0],
            receiver
          }))
        }
      }
      else {
        actions.push(Waxonedge.makeSwapAction({
          bid: bid,
          minimum: minimums[i],
          tokenA: tokenA,
          tokenB: tokenB,
          route: r
        }))
      }
    }

    return actions
	} // split
}