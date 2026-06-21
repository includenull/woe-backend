import { fetchFullTable } from '@connectors/RpcConnector.js';
import Pool from '@models/Pool.js';
import Token from '@models/Token.js';

import { precise } from '@utils/utils.js';

const poolSrc = 'adex';

import getRedis from '@connectors/RedisConnector.js';

export default class ADexPool {
	static makeSwapAction({bid, minimum, tokenA, tokenB, pool}) {
		const ask = precise(minimum * Math.pow(10, tokenB.symbol.precision), 0)

    return {
      to: 'swap.adex',
      quantity: precise(bid, tokenA.symbol.precision)+' '+tokenA.symbol.ticker,
      memo: 'swap:'+pool.pairid+';min:'+ask
    }
	}

	static async fetchPools() {
		let pools = []

		const pairs = await fetchFullTable('swap.adex', 'swap.adex', 'pools', true)

		for(const pair of pairs) {

			const lptoken = new Token({ quantity: '0 '+pair.code, contract: 'swap.adex'})
			const token0 = new Token(pair.base_token)
			const token1 = new Token(pair.quote_token)

			let pool_fee =  pair.pool_fee.split(' ');
			pool_fee = pool_fee[0] * 100
			let platform_fee =  pair.platform_fee.split(' ');
			platform_fee = platform_fee[0] * 100

			pools.push(new Pool(
	    	pair.id,
	    	poolSrc,
	    	pool_fee + platform_fee,
	    	lptoken,
	    	token0,
	    	token1,
	    	token0.amount,
	    	token1.amount,
	    	800
	    ));
		}

		return pools;
	}
}