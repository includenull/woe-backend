import { fetchFullTable } from '../Connectors/RpcConnector.js'
import Pool from '../Models/Pool.js'
import Token from '../Models/Token.js'

import {precise} from '../../utils/utils.js'

const poolSrc = 'taco'

class TacoPool {
	static makeSwapAction({bid, minimum, tokenA, tokenB}) {
    const ask = precise(minimum, tokenB.symbol.precision)

    return {
	    to: 'swap.taco',
	    quantity: precise(bid, tokenA.symbol.precision)+' '+tokenA.symbol.ticker,
	    memo: ask+' '+tokenB.symbol.ticker+'@'+tokenB.contract
    }
  }

	static async fetchPools() {
  	let pools = []

	  const pairs = await fetchFullTable('swap.taco', 'swap.taco', 'pairs', true)

	  for(let i = 0; i < pairs.length; ++i) {
	    const pair = pairs[i]

	    const lptoken = new Token({quantity: pair.supply, contract:'swap.taco'})
	    const token0 = new Token(pair.pool1)
	    const token1 = new Token(pair.pool2)

	    pools.push(new Pool(
	    	pair.id,
	    	poolSrc,
	    	30,
	    	lptoken,
	    	token0,
	    	token1,
	    	token0.amount,
	    	token1.amount,
	    	0
	    ))
	  }

		return pools
	}
}

export default TacoPool