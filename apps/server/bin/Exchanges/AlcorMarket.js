import { fetchFullTable } from '../Connectors/RpcConnector.js'
import Market from '../Models/Market.js'
import Token from '../Models/Token.js'

import {precise} from '../../utils/utils.js'

class AlcorMarket {
	static makeTradeAction({bid, minimum, tokenA, tokenB}) {
    const ask = precise(minimum, tokenB.symbol.precision)

    return {
      to: 'alcordexmain',
      quantity: precise(bid, tokenA.symbol.precision)+' '+tokenA.symbol.ticker,
      memo: ask+' '+tokenB.symbol.ticker+'@'+tokenB.contract
    }
  }

	static async fetchMarkets() {
  	let markets = []

	  const fetchMarkets = await fetchFullTable('alcordexmain', 'alcordexmain', 'markets', true)	 

	  for(const market of fetchMarkets) {
	    const token0 = new Token(market.base_token)
	    const token1 = new Token(market.quote_token)
	    let min_buy = market.min_buy.split(' ')
	    min_buy = Number(min_buy[0])
	    let min_sell = market.min_sell.split(' ')
	    min_sell = Number(min_sell[0])

	   	markets.push(new Market(
	    	market.id,
	    	'alcormarket',
	    	token0,
	    	token1,
				min_buy,
				min_sell,
				(market.frozen > 0),
				market.fee
	    ))
	  }
	
		return markets
	}
}

export default AlcorMarket