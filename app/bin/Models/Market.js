class Market {
  constructor(marketid, src, token0, token1, min_buy, min_sell, frozen, fee) {
    this.id = marketid
    this.src = src
    this.token0 = token0
    this.token1 = token1
    this.min_buy = min_buy
    this.min_sell = min_sell
    this.frozen = frozen
    this.fee = fee
    this.lastPrice = null // last unit_price
    this.lastSide = null // last side buy or sell
  }

  getFeeMult() {
    return 1 - this.fee/10000
  }

  getHash() {
    return this.src+'_'+this.id
  }

  static getHashStatic(market) {
    return market.src+'_'+market.id
  }

  static reverseMarket(market) {
    return {
      id: market.id,
      src: market.src,
      token0: market.token1,
      token1: market.token0,
      min_buy: market.min_sell,
      min_sell: market.min_buy,
      frozen: market.frozen,
      fee: market.fee,
      lastPrice: market.lastPrice,
      lastSide: market.lastSide
    }
  }

  static getAmountOutOfMarket (market, orderbook, bid, side = 'buy') {
    if(orderbook === null || orderbook === undefined)
      return 0;

    // Orderbook provided must be correct one depending on side
    // if sell must provide buy orderbook - if buy must provide sell orderbook
    if(side === 'buy') // orderbook is then sell one so must be sorted in asc price
      orderbook.sort((a, b) => a.unit_price - b.unit_price)
    else
      orderbook.sort((a, b) => b.unit_price - a.unit_price)

    const bid_precision = (side === 'buy') ? market.token0.symbol.precision : market.token1.symbol.precision;
    const ask_precision = (side === 'buy') ? market.token1.symbol.precision : market.token0.symbol.precision;

    let out = 0;
    // Remove what is above precision
    bid = Math.floor(bid * Math.pow(10, bid_precision)) / Math.pow(10, bid_precision)

    try {
      for(const orderbookRow of orderbook) {
        let ask_amount = orderbookRow.ask.split(' ')
        ask_amount = Number(ask_amount[0])

        let bid_amount = orderbookRow.bid.split(' ')
        bid_amount = Number(bid_amount[0])

        if(ask_amount >= bid) {
          let row_output = bid_amount * bid / ask_amount
          row_output = Math.floor(row_output * Math.pow(10, ask_precision)) / Math.pow(10, ask_precision)

          out += row_output
          bid = 0;
        }
        else {
          bid -= ask_amount
          out += bid_amount
        }

        if(bid <= bid_precision)
          break;
      }

      return out * (1 - (market.fee / 10000));
    }
    catch(e) {
      console.log(orderbook, 'orderbook')
      console.log(e, 'error');
    }

    return 0
  }
}

export default Market;