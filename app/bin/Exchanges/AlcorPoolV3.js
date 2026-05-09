import { fetchFullTable } from '../Connectors/RpcConnector.js'
import PoolV3 from '../Models/PoolV3.js'
import Token from '../Models/Token.js'

import { precise } from '../../utils/utils.js'

const src = 'alcorv2';

export default class AlcorPoolV3 {
	static makeSwapAction({ bid, minimum, tokenA, tokenB, poolId, receiver }) {
    const ask = precise(minimum, tokenB.symbol.precision)

    return {
      to: 'swap.alcor',
      quantity: precise(bid, tokenA.symbol.precision)+' '+tokenA.symbol.ticker,
      // swapexactin#2#myaccount#1.0013 USDT@tethertether#0
      memo: 'swapexactin#'+poolId+'#'+receiver+'#'+ask+' '+tokenB.symbol.ticker+'@'+tokenB.contract+'#0'
    }
  }
	static async fetchPools() {
		const pools = []

		const pairs = await fetchFullTable('swap.alcor', 'swap.alcor', 'pools', true)

		for(const pair of pairs) {
			const token0 = new Token(pair.tokenA)
			const token1 = new Token(pair.tokenB)

	    pools.push(new PoolV3({
	    	id: pair.id,
	    	src,
	    	active: pair.active,
	    	token0,
	    	token1,
	    	fee: pair.fee/100, // Alcor v2 put 3000 for 0.3% while others value would be 30 so we must divide by 100
	    	feeProtocol: pair.feeProtocol/100, // Same as pair.fee
	    	tickSpacing: pair.tickSpacing,
	    	maxLiquidityPerTick: pair.maxLiquidityPerTick,
	    	sqrtPriceX64: pair.currSlot.sqrtPriceX64,
	    	tick: pair.currSlot.tick,
	    	lastObservationTimestamp: pair.currSlot.lastObservationTimestamp,
	    	currentObservationNum: pair.currSlot.currentObservationNum,
	    	maxObservationNum: pair.currSlot.maxObservationNum,
	    	feeGrowthGlobalAX64: pair.feeGrowthGlobalAX64,
	    	feeGrowthGlobalBX64: pair.feeGrowthGlobalBX64,
	    	protocolFeeA: pair.protocolFeeA,
	    	protocolFeeB: pair.protocolFeeB,
	    	liquidity: pair.liquidity
	    }))
		}

		return pools
	}
}