import { precise } from '@utils/utils.js'
import logger from '@utils/logger.js';

class Pool {
	constructor(pairid, src, fee, lptoken, token0, token1, reserve0, reserve1, input_min_units, active = true) {
	    this.pairid = pairid
	    this.src = src
	    this.fee = fee
	    this.lptoken = lptoken
	    this.token0 = token0
	    this.token1 = token1
	    this.reserve0 = 1*reserve0
	    this.reserve1 = 1*reserve1
	    this.input_min_units = input_min_units
	    this.active = active
	    this.computePrice()
	}

	computePrice() {
		this.price = this.reserve0/this.reserve1
	}

	updateReserve0(amount) {
		amount *= 1
		this.token0.amount = amount
		this.reserve0 = amount
		this.computePrice()
	}

	updateReserve1(amount) {
		amount *= 1
		this.token1.amount = amount
		this.reserve1 = amount
		this.computePrice()
	}

	getRedisFormat() {
		return {
			pairid: this.pairid,
			src: this.src,
			fee: this.fee,
			lptoken_symbol_ticker: this.lptoken.symbol.ticker,
			lptoken_symbol_precision: this.lptoken.symbol.precision,
			lptoken_amount: this.lptoken.amount,
			lptoken_contract: this.lptoken.contract,
			token0_symbol_ticker: this.token0.symbol.ticker,
			token0_symbol_precision: this.token0.symbol.precision,
			token0_amount: this.token0.amount,
			token0_contract: this.token0.contract,
			token1_symbol_ticker: this.token1.symbol.ticker,
			token1_symbol_precision: this.token1.symbol.precision,
			token1_amount: this.token1.amount,
			token1_contract: this.token1.contract,
			reserve0: this.reserve0,
			reserve1: this.reserve1,
			price: this.price
		}
	}

	getFeeMult() {
		return 1 - this.fee/10000
	}

	static getFeeMult(pool) {
		return 1 - pool.fee/10000
	}

	getHash() {
		return this.src+'_'+this.pairid
	}

	static getHashStatic(pool) {
		return pool.src+'_'+pool.pairid
	}

	getAmountIn(pool) {
		return (Math.sqrt(this.reserve0*this.reserve1*(1-this.fee/10000)) - this.reserve0) / (1-this.fee/10000)
	}

	getAmountOut(bid) {
		const unit_size = 1 / Math.pow(10, this.token0.symbol.precision);
		if(bid < this.input_min_units * unit_size)
			return 0;

	  return (this.reserve1*(1-this.fee/10000)*bid)/(this.reserve0+(1-this.fee/10000)*bid)
	}
	static getAmountOutPool(pool, bid) {
		const unit_size = 1 / Math.pow(10, pool.token0.symbol.precision);
		if(bid < pool.input_min_units * unit_size)
			return 0;

    // Exception for neftyblocks, if fee are 0 the transaction will be rejected
    if(pool.src === 'neftyblocks' && pool.fee > 0) {
      // fees are on input token
      /*/ if(pool.pairid === 'USDWAX') {
        logger.info(unit_size)
        logger.info({ first: {bid, second: result: precise(bid * pool.fee / 10000, pool.token0.symbol.precision) * 1 - unit_size} })
      }/**/
      // minus unit_size because if fee are the unit_size the swap contracts might compute 0
      if(precise(bid * pool.fee / 10000, pool.token0.symbol.precision) * 1 - unit_size <= 0) {
        return 0
      }
    }

		return (bid * Pool.getFeeMult(pool) * pool.reserve1) / (pool.reserve0 + bid * Pool.getFeeMult(pool))
	}
	getAmountInWithTargetPrice(targetprice) {
		const pool_price = this.reserve0 / this.reserve1
		return (this.reserve1 * (pool_price - (pool_price - targetprice) / 2 )) - this.reserve0
	}
	reverse() {
		const tmpToken0 = this.token0
		const tmpReserve0 = this.reserve0
		this.token0 = this.token1
		this.reserve0 = this.reserve1
		this.token1 = tmpToken0
		this.reserve1 = tmpReserve0
		this.price = 1/this.price
	}
	static reversePool(pool) {
		return {
			pairid: pool.pairid,
			fee: pool.fee,
			src: pool.src,
			token0: pool.token1,
			token1: pool.token0,
			reserve0: pool.reserve1,
			reserve1: pool.reserve0,
			price: pool.reserve0/pool.reserve1, // actually reserve1/reserve0 of reverted pool
			input_min_units: pool.input_min_units,
			active: pool.active
		}
	}

	static mergePools(buyPool, sellPool) {
	  return new Pool(
	  	'',
	  	'',
	  	sellPool.fee,
	  	null,
	  	buyPool.token0,
	  	sellPool.token1,
	  	(buyPool.reserve0*sellPool.reserve0)/(sellPool.reserve0+buyPool.reserve1*(1-sellPool.fee/10000)),
	  	((1-sellPool.fee/10000)*buyPool.reserve1*sellPool.reserve1)/(sellPool.reserve0+buyPool.reserve1*(1-sellPool.fee/10000))
	  )
	}
}

export default Pool