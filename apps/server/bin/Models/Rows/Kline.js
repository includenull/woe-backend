import { Token as AlcorToken, Pool as AlcorPool } from '@alcorexchange/alcor-swap-sdk'

import KlinesTable from '../Tables/Klines.js'
import getDb from '../../Connectors/DbPGConnector.js'
import getRedis from '../../Connectors/RedisConnector.js'

import { isPairReverted } from '../../../utils/utils.js'
import logger from '@utils/logger.js';

const TIME_UNITS = {
	'1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '2h': 2 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000
};

export class KlineRow {
	constructor({
		id = null,
		src,
		pair_id,
		mode,
		duration,
		block_num,
		global_sequence,
		updated_at_time,
		// Candle
		high,
		low,
		open,
		close,

		oldVolumeA,
		volumeA,
		oldVolumeB,
		volumeB,
		trade_count,
		accounts,

		// system
		exists, // if candle already exists in db
		updated // if candle is updated
	}) {
		this.id = id

		this.src = src
		this.pair_id = pair_id
		this.duration = duration

		this.mode = mode
		this.block_num = block_num
		this.global_sequence = global_sequence
		this.updated_at_time = updated_at_time

		this.high = high
		this.low = low
		this.open = open
		this.close = close

		this.oldVolumeA = Number(oldVolumeA)
		this.volumeA = Number(volumeA)
		this.oldVolumeB = Number(oldVolumeB)
		this.volumeB = Number(volumeB)
		this.trade_count = trade_count
		this.accounts = accounts

		this.exists = exists
		this.updated = updated
	}

	merge(candle) {
		if(candle.mode !== 'history' && this.mode === 'history')
			this.mode = candle.mode

		this.close = (Number(candle.global_sequence) > Number(this.global_sequence)) ? Number(candle.close) : Number(this.close)
		this.block_num = Math.max(Number(this.block_num), Number(candle.block_num))
		this.global_sequence = Math.max(Number(this.global_sequence), Number(candle.global_sequence))
		this.high = Math.max(Number(this.high), Number(candle.high))
		this.low = Math.min(Number(this.low), Number(candle.low))
		this.volumeA = Number(this.volumeA) + Number(candle.volumeA)
		this.volumeB = Number(this.volumeB) + Number(candle.volumeB)
		this.trade_count = Number(this.trade_count) + Number(candle.trade_count)
		this.accounts = [...new Set(this.accounts.concat(candle.accounts))]
	}

	update(trade) {
		// never update history candle from db
		if(this.exists && this.mode === 'history')
			return;

		if(trade.mode != 'history') {
			this.mode = trade.mode
			this.updated = true
		}

    if(this.high < trade.price) {
      this.high = trade.price;
      this.updated = true
    }

    if(this.low > trade.price) {
      this.low = trade.price;
      this.updated = true
    }

  	this.volumeA += Number(trade.volumeA)
    if(this.oldVolumeA !== undefined && this.volumeA > this.oldVolumeA)
  		this.updated = true

  	this.volumeB += Number(trade.volumeB)
    if(this.oldVolumeB !== undefined && this.volumeB > this.oldVolumeB)
  		this.updated = true

		++this.trade_count
  	this.accounts = [...new Set(this.accounts.concat(trade.accounts))]
  } // update

	getTableName() {
		return 'klines_'+this.src+'_'+this.pair_id
	}
}

class KlineRowsException extends Error {
	constructor({code, message}) {
    super(message);
		this.code = code
  }
}

export class KlineRows {
  constructor(exchangeLocation, ut) {
    this.rows = {};
    this.exchangeLocation = exchangeLocation // contains either pool or market
    this.srcType = (exchangeLocation.pairid !== undefined) ? 'pool' : 'market'

    if(this.exchangeLocation.src === 'alcorv2')
    	this.srcType = 'poolV3'

    if(this.srcType === 'pool')
    	this.exchangeLocation.id = this.exchangeLocation.pairid

    this.tableName = 'klines_'+this.exchangeLocation.src+'_'+this.exchangeLocation.id
    this.ut = ut
    this.addTableNameUT();
  }

  static getSupportedDurations() {
  	return ['1m','5m','15m','30m','1h','2h','4h','6h','12h','1d']
  }

  static reverseCandles(candles) {
  	return candles.map(c => {
  		const candle_high = c.high
  		c.high = 1/Number(c.low)
  		c.low = 1/Number(candle_high)
  		c.open = 1/Number(c.open)
  		c.close = 1/Number(c.close)

  		return c
  	})
  }

  static async removeAboveBlocknum(src, pair_id, block_num) {
  	const db = await getDb()

  	try {
  		await db('klines_'+src+'_'+pair_id).where('block_num', '>=', block_num).del()
  	}
  	catch(err) {
  		logger.error({ err: err }, 'Failed to remove candles of '+src+' '+pair_id+' above block '+block_num)
  	}
  }

  static async fetchRows({
  	duration,
  	src,
  	pair_id,
  	startAt,
  	endAt,
  	limit,
  	orderBy = 'ASC'
  }) {
  	if(KlineRows.getSupportedDurations().indexOf(duration) === -1) {
  		throw new KlineRowsException({code: 400, message: 'Duration not supported'})
  		return false;
  	}

  	const klinesTable = new KlinesTable(src, pair_id)
  	const doesExist = await klinesTable.doesExist()

  	if(!doesExist) {
  		throw new KlineRowsException({code: 404, message: 'Candles not found for this pair'})
  		return false;
  	}

  	const db = await getDb()
  	let query = db.select(
			'updated_at_time',
			'mode',
			'block_num',
			'global_sequence',
			'high',
			'low',
			'open',
			'close',
			'volumeA',
			'volumeB',
			'trade_count',
			'accounts'
		).from(klinesTable.tableName).where({ 	
  		duration: duration
		});
		
		if(startAt !== undefined && null !== startAt)
   		query = query.where('updated_at_time', '>=', startAt);
		if(endAt !== undefined && null !== endAt)
   		query = query.where('updated_at_time', '<', endAt);
		
		query = query.orderBy(
			'updated_at_time', orderBy
		);

		if(limit !== undefined && null !== limit)
			query = query.limit(limit);

		return await query;
  }

  preloadRows(candles) {
  	for(const candle of candles) {
			const candleRow = new KlineRow({
				src: this.exchangeLocation.src,
				pair_id: this.exchangeLocation.id,
				mode: candle.mode,
				duration: this.ut,
				block_num: candle.block_num,
				global_sequence: candle.global_sequence,
				updated_at_time: candle.updated_at_time,
				// Candle
				high: candle.high,
				low: candle.low,
				open: candle.open,
				close: candle.close,
				// Volume & stats
				volumeA: candle.volumeA,
				volumeB: candle.volumeB,
				trade_count: candle.trade_count,
				accounts: candle.accounts,
				// system
				exists: true,
				updated: false
			});
			this.rows[this.tableName][this.ut].push(candleRow);	
  	}

  	return true
  }

  async syncFetchTrades(lastSync) {
  	const db = await getDb()

	  let tradeRows = [];
	  let startSeq = 0;

	  const rawSrc = this.exchangeLocation.src.replace('market', '')
	  while (true) {
	    const batchRows = await db.select(
	    	 'trx_id', 'mode', 
	    	 'asker', 'bidder', 'unit_price', 
	    	 'amount_bid', 'code_bid', 'amount_ask', 'code_ask',
	    	 'market_contract_base_token', 'market_code_base_token',
	    	 'market_contract_quote_token', 'market_code_quote_token',
	    	 'created_at_block', 'global_sequence', 'updated_at_time'
	      ).from(
	        'marketMatches'
	      ).whereIn(
	        'src', [rawSrc+'_buy', rawSrc+'_sell']
	      ).andWhere({
	        'market_id': this.exchangeLocation.id
	      }).andWhere(
	        'updated_at_time', '>=', lastSync
	      ).andWhere(
	        'global_sequence', '>', startSeq
	      ).orderBy(
	        'updated_at_time', 'asc'
	      ).limit(10000).catch((err) => {
	        logger.error(err);
	        throw err;
	      });

	    if (batchRows.length === 0)
	      break;

	    tradeRows = tradeRows.concat(batchRows);
	    startSeq = batchRows[batchRows.length - 1].global_sequence;

	    if(batchRows.length < 10000)
	    	break;
	  }

	  return tradeRows;
  }

  async syncFetchSwapsV3(lastSync) {
  	const db = await getDb()

	  let swapRows = [];
	  let startSeq = 0;

	  while (true) {
	    const batchRows = await db.select(
	        'trx_id', 'mode', 'sender',
	        'amountA', 'amountB',
	        'codeA', 'codeB',
	        'negativeA', 'negativeB',
	        'sqrtPriceX64', 'liquidity', 'tick',
	        'updated_at_time', 'created_at_block', 'global_sequence'
	      ).from(
	        'swapVThreeOrders'
	      ).where({
	        'src': this.exchangeLocation.src,
	        'pair_id': this.exchangeLocation.id
	      }).andWhere(
	        'updated_at_time', '>=', lastSync
	      ).andWhere(
	        'global_sequence', '>', startSeq
	      ).orderBy(
	        'updated_at_time', 'asc'
	      ).limit(10000).catch((err) => {
	        logger.error(err);
	        throw err;
	      });

	    if (batchRows.length === 0)
	      break;

	    swapRows = swapRows.concat(batchRows);
	    startSeq = batchRows[batchRows.length - 1].global_sequence;

	    if(batchRows.length < 10000)
	    	break;
	  }

	  return swapRows;
  }

  async syncFetchSwaps(lastSync) {
  	const db = await getDb()

	  let swapRows = [];
	  let startSeq = 0;

	  while (true) {
	    const batchRows = await db.select(
	        'trx_id', 'mode', 'maker',
	        'amount_in', 'amount_out',
	        'code_in', 'code_out',
	        'amount_reserveA', 'amount_reserveB',
	        'code_reserveA', 'code_reserveB',
	        'updated_at_time', 'created_at_block', 'global_sequence'
	      ).from(
	        'swapOrders'
	      ).where({
	        'src': this.exchangeLocation.src,
	        'pair_id': this.exchangeLocation.id
	      }).andWhere(
	        'updated_at_time', '>=', lastSync
	      ).andWhere(
	        'global_sequence', '>', startSeq
	      ).orderBy(
	        'updated_at_time', 'asc'
	      ).limit(10000).catch((err) => {
	        logger.error(err);
	        throw err;
	      });

	    if (batchRows.length === 0)
	      break;

	    swapRows = swapRows.concat(batchRows);
	    startSeq = batchRows[batchRows.length - 1].global_sequence;

	    if(batchRows.length < 10000)
	    	break;
	  }

	  return swapRows;
  }

	computeTradeVolume(trade) {
		let volumeA = 0
		let volumeB = 0
		if(trade.code_bid === this.exchangeLocation.token0.symbol.ticker) {
			volumeA = Number(trade.amount_bid)
			volumeB = Number(trade.amount_ask)
		}
		else {
			volumeA = Number(trade.amount_ask)
			volumeB = Number(trade.amount_bid)
		}

		return { volumeA, volumeB }
	}

  computeSwapVolume(swap) {
		let volumeA = 0
		let volumeB = 0
		if(swap.code_in === swap.code_reserveA) {
			volumeA = Number(swap.amount_in)
			volumeB = Number(swap.amount_out)
		}
		else {
			volumeA = Number(swap.amount_out)
			volumeB = Number(swap.amount_in)
		}

  	return { volumeA, volumeB }
  }

  computeSwapV3Volume(swap) {
  	return {
  		volumeA: Number(swap.amountA),
  		volumeB: Number(swap.amountB)
  	}
  }

  async syncWithDatabase(workerId = '') {
  	this.workerId = workerId
  	const table = new KlinesTable(this.exchangeLocation.src, this.exchangeLocation.id)
		//const lastHistoryCandleStart = await table.getLastSyncedUpdatedAtTime(this.ut)
		//const lastHeadCandleStart = await table.getLastSyncedUpdatedAtTime(this.ut, 'head')
		const db = await getDb()
		logger.info(this.workerId+': Processing candles for '+this.ut+' '+this.exchangeLocation.src+'_'+this.exchangeLocation.id+' '+this.exchangeLocation.token0.symbol.ticker+'/'+this.exchangeLocation.token1.symbol.ticker)


		//const syncTimeStart = (lastHeadCandleStart > 0) ? this.getPrevRowStart(lastHeadCandleStart) : lastHistoryCandleStart;

		/**
		logger.info({
			lastHistoryCandleStart,
			lastHeadCandleStart,
			'prevHeadCandleStart': ((lastHeadCandleStart > 0) ? this.getPrevRowStart(lastHeadCandleStart) : 0),
			'getRowStart': this.getRowStart(Date.now()),
			'getPrevRowStart': this.getPrevRowStart(this.getRowStart(Date.now()))
		});
		/**/

		//process.exit()

		if(this.ut === '1m') {
			// Fetch last two candles
			let lastCandles = await db.select(
        'updated_at_time',
        'mode',
        'block_num',
        'global_sequence',
        'high',
        'low',
        'open',
        'close',
				'volumeA',
				'volumeB',
				'trade_count',
				'accounts'
      ).from(
        this.tableName
      ).where({
        'duration': this.ut
      }).orderBy(
        'updated_at_time', 'desc'
      ).limit(2);

      // Reset volume & stats since trade of the candle will be rereaded, to avoid double computation
      // 2/ If doesn't work, another solution, check if the trade is already in the candle
      lastCandles = lastCandles.map(c => {
      	c.oldVolumeA = c.volumeA
      	c.oldVolumeB = c.volumeB
      	c.volumeA = 0
      	c.volumeB = 0
				c.accounts = []
				c.trade_count = 0

				return c
      })

			if(lastCandles.length) {
				logger.info(workerId+': Preload '+lastCandles.length+' candles from database')
				this.preloadRows(lastCandles)
			}

			// Fetch all history
			if(this.srcType === 'pool') {
				const swapRows = await this.syncFetchSwaps((this.rows[this.tableName][this.ut].length) ? this.rows[this.tableName][this.ut][this.rows[this.tableName][this.ut].length - 1].updated_at_time : 0)

				for(const trade of swapRows) {
					let price = Number(trade.amount_reserveA)/Number(trade.amount_reserveB)
			    // BASE is token0 or WAX ? 
			   	if(isPairReverted(this.exchangeLocation))
			    	price = 1/price
			    trade.price = price
			    const volume = this.computeSwapVolume(trade)
			    trade.volumeA = volume.volumeA
			    trade.volumeB = volume.volumeB
			    trade.accounts = [trade.maker]
					this.addTrade(trade)
				}
			}
			else if(this.srcType === 'poolV3') {
				const swapRows = await this.syncFetchSwapsV3((this.rows[this.tableName][this.ut].length) ? this.rows[this.tableName][this.ut][this.rows[this.tableName][this.ut].length - 1].updated_at_time : 0)

				const tokenA = new AlcorToken(
				  this.exchangeLocation.token0.contract,
				  this.exchangeLocation.token0.symbol.precision,
				  this.exchangeLocation.token0.symbol.ticker.toUpperCase(),
				  (this.exchangeLocation.token0.symbol.ticker + '-' + this.exchangeLocation.token0.contract).toLowerCase()
				);
				const tokenB = new AlcorToken(
				  this.exchangeLocation.token1.contract,
				  this.exchangeLocation.token1.symbol.precision,
				  this.exchangeLocation.token1.symbol.ticker.toUpperCase(),
				  (this.exchangeLocation.token1.symbol.ticker + '-' + this.exchangeLocation.token1.contract).toLowerCase()
				);
				for(const swap of swapRows) {
					swap.tick = Number(swap.tick)
					//console.log(tokenA, tokenB, this.exchangeLocation, swap, )
			    const alcorPool = new AlcorPool({
			      id: this.exchangeLocation.id,
			      tokenA,
			      tokenB,
			      fee: this.exchangeLocation.fee * 100,
			      sqrtPriceX64: swap.sqrtPriceX64,
			      liquidity: swap.liquidity,
			      tickCurrent: swap.tick,
			      feeGrowthGlobalAX64: 0,
			      feeGrowthGlobalBX64: 0
			    });

					let price = 1*alcorPool.tokenBPrice.toFixed(16)
			    // BASE is WAX ? 
			    if(isPairReverted(this.exchangeLocation))
			    	price = 1*alcorPool.tokenAPrice.toFixed(16)

			    swap.price = price
			    const volume = this.computeSwapV3Volume(swap)
			    swap.volumeA = volume.volumeA
			    swap.volumeB = volume.volumeB
			    swap.accounts = [swap.sender]
			    //console.log(swap)
			    //console.log(price, ((swap.codeB.toLowerCase() === 'wax') ? swap.codeA+'/'+swap.codeB : swap.codeB+'/'+swap.codeA))
					this.addTrade(swap)
				}
			}
			else if(this.srcType === 'market') {
				const swapRows = await this.syncFetchTrades((this.rows[this.tableName][this.ut].length) ? this.rows[this.tableName][this.ut][this.rows[this.tableName][this.ut].length - 1].updated_at_time : 0)

				for(const trade of swapRows) {
			    trade.price = Number(trade.unit_price)/Math.pow(10, 8)
			    const volume = this.computeTradeVolume(trade)
			    trade.volumeA = volume.volumeA
			    trade.volumeB = volume.volumeB
			    trade.accounts = [...new Set([trade.bidder, trade.asker])]
					this.addTrade(trade)
				}
			}
		}
		else {
			await this.computeCandlesFromLowerUT();//lastHistoryCandleStart, lastHeadCandleStart)
		}		

		// Update DB
		await this.saveRows()
  }

  async syncFetchCandles(ut, lastSync) {
  	const db = await getDb()

	  let candlesRows = [];
	  let startSeq = 0;

	  while (true) {
	    const batchRows = await db.select(
	        'updated_at_time',
	        'mode',
	        'block_num',
	        'global_sequence',
	        'high',
	        'low',
	        'open',
	        'close',
	        'volumeA',
					'volumeB',
					'trade_count',
					'accounts'
	      ).from(
	        this.tableName
	      ).where({
	        'duration': ut
	      }).andWhere(
	        'updated_at_time', '>=', lastSync // include last history candle too for sync open price in case there is blank candle right before first one
	      ).andWhere(
	        'global_sequence', '>', startSeq
	      ).orderBy(
	        'updated_at_time', 'asc'
	      ).limit(10000).catch((err) => {
	        logger.error(err);
	        throw err;
	      });

	    if (batchRows.length === 0)
	      break;

	    candlesRows = candlesRows.concat(batchRows);
	    startSeq = batchRows[batchRows.length - 1].global_sequence;

	    if(batchRows.length < 10000)
	    	break;
	  }

	  return candlesRows;
  }

  /** Computes candles from lower UT
   * '5m' = 5* '1m'
   * '15m' = 3* '5m'
   * '30m' = 2* '15m'
   * '1h' = 2* '30m'
   * '2h' = 2* '1h'
   * '4h' = 2* '2h'
   * '6h' = 3* '2h'
   * '12h' = 2* '6h'
   * '1d' = 2* '12h'
  **/
  async computeCandlesFromLowerUT() {
  	// Fetch last two candles
  	const db = await getDb()
		let lastCandles = await db.select(
      'updated_at_time',
      'mode',
      'block_num',
      'global_sequence',
      'high',
      'low',
      'open',
      'close',
			'volumeA',
			'volumeB',
			'trade_count',
			'accounts'
    ).from(
      this.tableName
    ).where({
      'duration': this.ut
    }).orderBy(
      'updated_at_time', 'desc'
    ).limit(2);

    const syncFetchStart = lastCandles.length ? Number(lastCandles[lastCandles.length - 1].updated_at_time) : 0;

  	const candleConvertMap = {
			'5m': '1m',
			'15m': '5m',
			'30m': '15m',
			'1h': '30m',
			'2h': '1h',
			'4h': '1h',
			'6h': '1h',
			'12h': '1h',
			'1d': '12h',
  	}
  	const lowerUT = candleConvertMap[this.ut]
  	const lowerCandles = await this.syncFetchCandles(lowerUT, syncFetchStart)

  	//console.log('lastHistoryCandleStart', lastHistoryCandleStart, 'lastHeadCandleStart', lastHeadCandleStart)
  	//console.log(lowerCandles.map(lc => {lc.transaction_ids = []; return lc}), 'lowerCandles')
  	let rows = {}

  	for(const lowerCandle of lowerCandles) {
  		const start = this.getRowStart(lowerCandle.updated_at_time)
  		const end = this.getNextRowStart(start)

  		let prevRow = Object.keys(rows).filter(
  			r => r.updated_at_time < lowerCandle.updated_at_time
  		).sort((a, b) => b.updated_at_time - a.updated_at_time)
 			prevRow = (prevRow.length) ? prevRow[0] : undefined

  		//console.log(start, end)
  		if(rows[start] === undefined) {
  			rows[start] = new KlineRow({
					src: this.exchangeLocation.src,
					pair_id: this.exchangeLocation.id,
					mode: (Date.now() < end) ? 'head' : lowerCandle.mode,
					duration: this.ut,
					block_num: Number(lowerCandle.block_num),
					global_sequence: Number(lowerCandle.global_sequence),
					updated_at_time: start,
					// Candle
					high: Number(lowerCandle.high),
					low: Number(lowerCandle.low),
					open: (prevRow !== undefined) ? Number(prevRow.close) : Number(lowerCandle.open),
					close: Number(lowerCandle.close),
					// volume
					volumeA: lowerCandle.volumeA,
					volumeB: lowerCandle.volumeB,
					trade_count: lowerCandle.trade_count,
					accounts: lowerCandle.accounts,
					// system
					exists: (lastCandles.find(lc => lc.updated_at_time == start) !== undefined) ? true : false,
					updated: true
				});
  		}
  		else {
  			rows[start].merge(lowerCandle)
  		}
  	}

  	this.rows[this.tableName][this.ut] = Object.values(rows)

  	return true
  }

  addTableNameUT() {
    if(this.rows[this.tableName] === undefined)
      this.rows[this.tableName] = {};

    if(this.rows[this.tableName][this.ut] === undefined)
      this.rows[this.tableName][this.ut] = [];
  } // addTableNameUT
  getPrevRowStart(tradeStart) {
	  const conversionFactor = TIME_UNITS[this.ut];
	  const prevRowStart = new Date(tradeStart - conversionFactor).getTime();
	  return prevRowStart;
  }
  findPrevRow(tradeStart) {
  	const rows = this.rows[this.tableName][this.ut].filter(r => r.updated_at_time < tradeStart)

  	if(!rows.length)
  		return null

  	return rows[0]
  }
  getNextRowStart(tradeStart) {
  	const conversionFactor = TIME_UNITS[this.ut];
	  const nextRowStart = new Date(tradeStart + conversionFactor).getTime();
	  return nextRowStart;
  }

  getRowStart(tradeStart) {
    const candleStart = new Date();
    candleStart.setTime(Number(tradeStart))

    candleStart.setMilliseconds(0);
    candleStart.setSeconds(0);

    if(this.ut == '5m')
      candleStart.setMinutes(candleStart.getMinutes() - candleStart.getMinutes()%5);
    else if(this.ut == '15m')
      candleStart.setMinutes(candleStart.getMinutes() - candleStart.getMinutes()%15);
    else if(this.ut == '30m')
      candleStart.setMinutes(candleStart.getMinutes() - candleStart.getMinutes()%30);
    else if(this.ut != '1m') {
      candleStart.setMinutes(0);

      if(this.ut == '2h') {
        candleStart.setHours(candleStart.getHours() - candleStart.getHours()%2);
      }
      else if(this.ut == '4h') {
        candleStart.setHours(candleStart.getHours() - candleStart.getHours()%4);
      }
      else if(this.ut == '6h') {
        candleStart.setHours(candleStart.getHours() - candleStart.getHours()%6);
      }
      else if(this.ut == '12h') {
        candleStart.setHours(candleStart.getHours() - candleStart.getHours()%12);
      }
      else if(this.ut != '1h') {
        candleStart.setHours(0);
      }
    } // else if

    return candleStart.getTime();
  } // getRowStart

  // Feed last candles with new trade
  addTrade(trade) {
   	//console.log(trade)
    const start = this.getRowStart(trade.updated_at_time);
    const candleIndex = this.rows[this.tableName][this.ut].findIndex(
    	c => c.updated_at_time == start
    );
    if(candleIndex != -1)
      this.rows[this.tableName][this.ut][candleIndex].update(trade);
    else {
    	let openPrice = trade.price
    	/* 
    		* Only for pools, markets will generate a trade / market match in the orderbook
    		* Pool uniswap v2 is equivalent to orderbook with infinite orderlines
    		* Pool uniswap v3 could be as market since there can be a gap between ticks but
    		  it generates only 1 log / trade and it's easier to treat it same way as a pool uniswap 2
    	*/
    	if(this.srcType !== 'market') {
	    	const prevRow = this.findPrevRow(start)
	    	if(prevRow !== null)
	    		openPrice = prevRow.close
    	}

      const candle = new KlineRow({
				src: this.exchangeLocation.src,
				pair_id: this.exchangeLocation.id,
				mode: trade.mode,
				duration: this.ut,
				block_num: Number(trade.created_at_block),
				global_sequence: Number(trade.global_sequence),
				updated_at_time: start,
				// Candle
				high: Math.max(trade.price, openPrice),
				low: Math.min(trade.price, openPrice),
				open: openPrice,
				close: trade.price,
				oldVolumeA: 0, // makes no sense in new candle
				oldVolumeB: 0, // makes no sense in new candle
				volumeA: trade.volumeA,
				volumeB: trade.volumeB,
				trade_count: 1,
				accounts: trade.accounts,
				// system
				exists: false,
				updated: true
			});
      this.rows[this.tableName][this.ut].unshift(candle);
    }

    return true
  } // addTrade

	async saveRows() {
		const db = await getDb()
		const redis = await getRedis()

		let dataToInsert = this.rows[this.tableName][this.ut].filter(r => r.exists === false && r.updated === true).map(row => ({
	    mode: row.mode,
	    duration: row.duration,
	    block_num: row.block_num,
	    global_sequence: row.global_sequence,
	    updated_at_time: row.updated_at_time,
	    high: row.high,
	    low: row.low,
	    open: row.open,
	    close: row.close,
			volumeA: row.volumeA,
			volumeB: row.volumeB,
			trade_count: row.trade_count,
			accounts: row.accounts,
			unique_accounts: row.accounts.length,
	  }))
	  let dataToUpdate = this.rows[this.tableName][this.ut].filter(r => r.exists === true && r.updated === true).map(row => ({
	    mode: row.mode,
	    duration: row.duration,
	    block_num: row.block_num,
	    global_sequence: row.global_sequence,
	    updated_at_time: row.updated_at_time,
	    high: row.high,
	    low: row.low,
	    open: row.open,
	    close: row.close,
			volumeA: row.volumeA,
			volumeB: row.volumeB,
			trade_count: row.trade_count,
			accounts: row.accounts,
			unique_accounts: row.accounts.length,
	  }))

	  let totalIns = 0
	  try {
	    await db.batchInsert(this.tableName, dataToInsert)
	    // console.log(dataToInsert, 'dataToInsert')
	    for (const row of dataToInsert) {
	    	const dataString = JSON.stringify({
					srcType: this.srcType,
					src: this.exchangeLocation.src,
					pair_id: this.exchangeLocation.id,
					...row
			 	});
    		// Publish the weather data to the 'weather' channel
    		await redis.publish('klines_insert_socketio', dataString);
	    }
	    totalIns = dataToInsert.length
	  } catch (e) {
	    logger.info(this.workerId+': Error inserting klines')
	    logger.info("---------------------------\n\n\n\n\n\n\n\n\n\n\n----------------------------")
	    logger.error(e)
	    //console.log(this.rows[this.tableName][this.ut])
	  	/**console.log(
	  		this.rows[this.tableName][this.ut].filter(r => r.exists === false && r.updated === true),
	  		this.rows[this.tableName][this.ut].filter(r => r.exists === true && r.updated === true)
	  	)**/
	  }
		let totalUpd = 0
	  try {
	    await db.transaction(async trx => {
	    	// console.log(dataToUpdate, 'dataToUpdate')
	      for (const row of dataToUpdate) {
	        const rowsUpdated = await trx(this.tableName)
	          .where({
	            duration: row.duration,
	            updated_at_time: row.updated_at_time,
	            mode: row.mode === 'history' ? 'history' : 'head',
	          })
	          .update(row)

					const dataString = JSON.stringify({
						srcType: this.srcType,
						src: this.exchangeLocation.src,
						pair_id: this.exchangeLocation.id,
						...row
					});
					// Publish the weather data to the 'weather' channel
					await redis.publish('klines_update_socketio', dataString);
	         /* if(rowsUpdated === 0)
	         	logger.info({ first: row, second: 'updated 0' }) */

	        totalUpd += rowsUpdated
	      }
	    })
	  } catch (e) {
	    logger.info(this.workerId+': Error updating klines')
	    logger.error(e)
	  }
    logger.info({ totalIns }, this.workerId+': Klines inserted')
    logger.info({ totalUpd }, this.workerId+': Klines updated')
  }
} // KlineRows