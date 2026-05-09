import { fetchFullTable } from '@connectors/RpcConnector.js';
import Pool from '@models/Pool.js';
import Token from '@models/Token.js';

import { precise } from '@utils/utils.js';

const poolSrc = 'neftyblocks';

import getRedis from '@connectors/RedisConnector.js';

export default class NeftyPool {
	static makeSwapAction({bid, minimum, tokenA, tokenB, pool}) {
    const ask = precise(minimum * Math.pow(10, tokenB.symbol.precision), 0)

    return {
      to: 'swap.nefty',
      quantity: precise(bid, tokenA.symbol.precision)+' '+tokenA.symbol.ticker,
      memo: 'swap:'+pool.pairid+',min:'+ask
    }
  }

	static async fetchPools() {
  	let pools = []

	  const pairs = await fetchFullTable('swap.nefty', 'swap.nefty', 'pairs', true)

	  for(let i = 0; i < pairs.length; ++i) {
	    const pair = pairs[i]

	    const lptoken = new Token({quantity: pair.total_liquidity+' '+pair.code , contract:'lp.nefty'})
	    const token0 = new Token(pair.reserve0)
	    const token1 = new Token(pair.reserve1)

	    pools.push(new Pool(
	    	pair.code,
	    	poolSrc,
	    	30,
	    	lptoken,
	    	token0,
	    	token1,
	    	token0.amount,
	    	token1.amount,
	    	0, 
	    	pair.active
	    ))
	  }

		return pools
	}
}