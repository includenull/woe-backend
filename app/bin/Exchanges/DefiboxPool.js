import { fetchTable } from '../Connectors/RpcConnector.js'
import Pool from '../Models/Pool.js'
import Token from '../Models/Token.js'

import {precise} from '../../utils/utils.js'

const poolSrc = 'defibox'

import getRedis from '../Connectors/RedisConnector.js'

class DefiboxPool {
	static makeSwapAction({bid, minimum, tokenA, tokenB, pool}) {
    const ask = precise(minimum * Math.pow(10, tokenB.symbol.precision), 0)

    return {
      to: 'swap.box',
      quantity: precise(bid, tokenA.symbol.precision)+' '+tokenA.symbol.ticker,
      memo: 'swap,'+ask+','+pool.pairid
    }
  }

	static incrementLPTicker(chars) {
		const letters = ['A', 'B', 'C', 'D', 'E', 'F','G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']

		let lastChar = chars[chars.length - 1]
		let prevChars = (chars.length > 1) ? chars.substr(0, chars.length -1) : ''

		if(lastChar === 'Z')
			return DefiboxPool.incrementLPTicker(prevChars) + 'A'
		else
			return prevChars + letters[letters.indexOf(lastChar) + 1]
	}

	static getLPTickerFromId(id) {
		id = 1*id - 1
		let ticker = 'BOX'

		let tSuf = 'A'
		for(let i = 0; i < id; ++i)
			tSuf = DefiboxPool.incrementLPTicker(tSuf)

		return ticker + tSuf
	}

	static async fetchPools() {
  	let pools = []

	  const pairs = await fetchTable('swap.box', 'swap.box', 'pairs')

	  for(let i = 0; i < pairs.length; ++i) {
	    const pair = pairs[i]

	    // update tokens to get right format
	    pair.token0.quantity = pair.reserve0
	    pair.token1.quantity = pair.reserve1

	    const lptoken = new Token({quantity: pair.liquidity_token+' '+DefiboxPool.getLPTickerFromId(pair.id), contract:'lptoken.box'})
	    const token0 = new Token(pair.token0)
	    const token1 = new Token(pair.token1)

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

export default DefiboxPool