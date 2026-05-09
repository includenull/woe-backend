// Keep bigInts as string so it doesn't mess with the front api, convert to bigint only when necessary 
/*import jsbi_pkg from 'jsbi';
const { BigInt } = jsbi_pkg;*/
import {
  Token as AlcorToken,
  Pool as AlcorPool,
  Position as AlcorPosition,
  Trade as AlcorTrade,
  CurrencyAmount as AlcorCurrencyAmount,
  tickToPrice,
  TickMath,
  nearestUsableTick,
  TICK_SPACINGS
} from '@alcorexchange/alcor-swap-sdk'

export default class PoolV3 {
	constructor({
    id,
    src,
    active,
    token0,
    token1,
    fee,
    feeProtocol,
    tickSpacing,
    maxLiquidityPerTick, //bi
    sqrtPriceX64, // bi
    tick,
    lastObservationTimestamp,
    currentObservationNum,
    maxObservationNum,
    feeGrowthGlobalAX64, // bi
    feeGrowthGlobalBX64, // bi
    protocolFeeA,
    protocolFeeB,
    liquidity, // bi
  }) {
      this.id = id,
      this.src = src,
      this.active = active,
      this.token0 = token0,
      this.token1 = token1,
      this.fee = fee,
      this.feeProtocol = feeProtocol
      this.tickSpacing = tickSpacing
      this.maxLiquidityPerTick = maxLiquidityPerTick//BigInt(maxLiquidityPerTick)
      this.sqrtPriceX64 = sqrtPriceX64//BigInt(sqrtPriceX64)
      this.tick = tick
      this.lastObservationTimestamp = lastObservationTimestamp
      this.currentObservationNum = currentObservationNum
      this.maxObservationNum = maxObservationNum
      this.feeGrowthGlobalAX64 = feeGrowthGlobalAX64//BigInt(feeGrowthGlobalAX64)
      this.feeGrowthGlobalBX64 = feeGrowthGlobalBX64//BigInt(feeGrowthGlobalBX64)
      this.protocolFeeA = protocolFeeA
      this.protocolFeeB = protocolFeeB
      this.liquidity = liquidity//BigInt(liquidity)
	}

  getFeeMult() {
    return 1 - (this.fee + this.feeProtocol)/10000
  }

  getHash() {
    return this.src+'_'+this.id
  }

  static getHashStatic(pool) {
    return pool.src+'_'+pool.id
  }

  static getPrice(
    pool,
    side = 'tokenA',
    sqrtPriceX64 = null,
    tick = null,
    liquidity = null
  ) {
    const tokenA = new AlcorToken(
      pool.token0.contract,
      pool.token0.symbol.precision,
      pool.token0.symbol.ticker.toUpperCase(),
      (pool.token0.symbol.ticker + '-' + pool.token0.contract).toLowerCase()
    );
    const tokenB = new AlcorToken(
      pool.token1.contract,
      pool.token1.symbol.precision,
      pool.token1.symbol.ticker.toUpperCase(),
      (pool.token1.symbol.ticker + '-' + pool.token1.contract).toLowerCase()
    );
    const alcorPool = new AlcorPool({
      id: pool.id,
      tokenA,
      tokenB,
      fee: pool.fee * 100,
      sqrtPriceX64: (sqrtPriceX64 !== null && undefined !== sqrtPriceX64) ? sqrtPriceX64 : pool.sqrtPriceX64,
      liquidity: (liquidity !== null && undefined !== liquidity) ? liquidity : pool.liquidity,
      tickCurrent: (tick !== null && undefined !== tick) ? tick : pool.tick,
      feeGrowthGlobalAX64: pool.feeGrowthGlobalAX64,
      feeGrowthGlobalBX64: pool.feeGrowthGlobalBX64
    });

    return 1*alcorPool[side+'Price'].toFixed(18)
  }

  // Only reverse both tokens, beware rest is not modified if you need do to math
  static reversePool(pool) {
    return new PoolV3({
      id: pool.id,
      src: pool.src,
      active: pool.active,
      token0: pool.token1,
      token1: pool.token0,
      fee: pool.fee,
      feeProtocol: pool.feeProtocol,
      tickSpacing: pool.tickSpacing,
      maxLiquidityPerTick: pool.maxLiquidityPerTick, //bi
      sqrtPriceX64: pool.sqrtPriceX64, // bi
      tick: pool.tick,
      lastObservationTimestamp: pool.lastObservationTimestamp,
      currentObservationNum: pool.currentObservationNum,
      maxObservationNum: pool.maxObservationNum,
      feeGrowthGlobalAX64: pool.feeGrowthGlobalAX64, // bi
      feeGrowthGlobalBX64: pool.feeGrowthGlobalBX64, // bi
      protocolFeeA: pool.protocolFeeA,
      protocolFeeB: pool.protocolFeeB,
      liquidity: pool.liquidity
    })
  }

  // A bit spagetthi but getters can't be async so this code is here
  static async getAmountOutOfPool(pool, pool_ticks, bid, isReversed) {
    if(isNaN(bid))
      return 0

    const tokenA = new AlcorToken(
      pool.token0.contract,
      pool.token0.symbol.precision,
      pool.token0.symbol.ticker.toUpperCase(),
      (pool.token0.symbol.ticker + '-' + pool.token0.contract).toLowerCase()
    );
    const tokenB = new AlcorToken(
      pool.token1.contract,
      pool.token1.symbol.precision,
      pool.token1.symbol.ticker.toUpperCase(),
      (pool.token1.symbol.ticker + '-' + pool.token1.contract).toLowerCase()
    );
    const tokenIn = (isReversed) ? tokenB : tokenA;
    const tokenOut = (isReversed) ? tokenA : tokenB;

    try {
      const alcorPool = new AlcorPool({
        id: pool.id,
        tokenA,
        tokenB,
        fee: pool.fee * 100,
        sqrtPriceX64: pool.sqrtPriceX64,
        liquidity: pool.liquidity,
        tickCurrent: pool.tick,
        feeGrowthGlobalAX64: pool.feeGrowthGlobalAX64,
        feeGrowthGlobalBX64: pool.feeGrowthGlobalBX64,
        ticks: pool_ticks
      });
      // console.log(alcorPool)
      //console.log(bid, parseFloat(parseFloat( ((1*bid).toFixed(tokenIn.decimals)*Math.pow(10, tokenIn.decimals)).toFixed(tokenIn.decimals) ).toFixed(0)) )
      const amountIn = AlcorCurrencyAmount.fromRawAmount(tokenIn, parseFloat(parseFloat( ((1*bid).toFixed(tokenIn.decimals)*Math.pow(10, tokenIn.decimals)).toFixed(tokenIn.decimals) ).toFixed(0))  )
      //console.log(amountIn)

      const alcorTrade = await AlcorTrade.bestTradeExactIn([alcorPool], amountIn, tokenOut, { maxHops: 1 });

      if(!alcorTrade.length)
        return 0

      return alcorTrade[0].outputAmount.toFixed()
    }
    catch(e) {
      console.log(e)
      return 0
    }
  }
}