import { asset, symbol, extended_asset, name, extended_symbol } from "eos-common"
import {parseDateFromSmartcontract} from '../../../utils/utils.js'
import getDb from '../../Connectors/DbPGConnector.js'
import getRedis from '../../Connectors/RedisConnector.js'

const getAmountFromAsset = (asset) => asset.amount/Math.pow(10, asset.symbol.precision())
const getCodeFromAsset = (asset) => asset.symbol.code().toString()
const getPrecisionFromAsset = (asset) => asset.symbol.precision()

class SwapVThreeOrderRow {
	constructor({
		trx_id,
		src,
		mode,
		action_ordinal,
		pair_id,
		sender,
		recipient,
		tokenA,
		tokenB,
		sqrtPriceX64,
		liquidity,
		tick,
		reserveA,
		reserveB,
		block_num,
		global_sequence,
		trx_time
	}) {
		this.trx_id = trx_id.toLowerCase();
		this.src = src;
		this.mode = mode;
		this.action_ordinal = action_ordinal;
		this.pair_id = pair_id;
		this.sender = sender;
		this.recipient = recipient;
		this.sqrtPriceX64 = sqrtPriceX64;
		this.liquidity = liquidity;
		this.tick = tick;
		this.amountA = Math.abs(1*getAmountFromAsset(asset(tokenA)));
		this.amountB = Math.abs(1*getAmountFromAsset(asset(tokenB)));
		this.negativeA = (1*getAmountFromAsset(asset(tokenA)) < 0);
		this.negativeB = (1*getAmountFromAsset(asset(tokenB)) < 0);
		this.codeA = getCodeFromAsset(asset(reserveA));
		this.codeB = getCodeFromAsset(asset(reserveB));
		this.precisionA = getPrecisionFromAsset(asset(reserveA));
		this.precisionB = getPrecisionFromAsset(asset(reserveB));
		this.reserveA = getAmountFromAsset(asset(reserveA));
		this.reserveB = getAmountFromAsset(asset(reserveB));
		this.created_at_block = block_num,
		this.global_sequence = global_sequence,
		this.updated_at_time = parseDateFromSmartcontract(trx_time).getTime()
	}

	static parseActionData(src, data) {
		let ret = {}

		ret.pair_id = data.poolId;
		ret.sender = data.sender;
		ret.recipient = data.recipient;
		ret.tokenA = data.tokenA;
		ret.tokenB = data.tokenB;
		ret.sqrtPriceX64 = data.sqrtPriceX64;
		ret.liquidity = data.liquidity;
		ret.tick = data.tick;
		ret.reserveA = data.reserveA;
		ret.reserveB = data.reserveB;
		
		return ret;
	}

  static async removeHeadAboveBlocknum(block_num) {
  	const db = await getDb()

  	try {
  		await db('swapVThreeOrders').where('created_at_block', '>=', block_num).where(
  			'mode', 'head'
			).del()
  	}
  	catch(err) {
  		console.log('Failed to remove rows above block', err)
  	}
  }

  static async setHeadToHistoryBeforeBlocknum(block_num) {
  	const db = await getDb()

  	try {
	  	await db('swapVThreeOrders').where('created_at_block', '<=', block_num).where(
	  		'mode', 'head'
			).update({
	  		'mode': 'history'
	  	});
  	}
  	catch(err) {
  		console.log('failed to set rows to history', err)
  	}
  }

  static async fetchRows({
  	src,
  	pair_id,
  	pairIdSrcArray, // An array of pairs representing pair_id and src
  	sender,
  	senders,
  	recipient,
  	codeA,
  	codeB,
  	min_global_sequence,
  	max_global_sequence,
  	// difference between those and codeA/codeB is this one is equal to codeA or codeB
  	code1,
  	code2,
		startAt,
  	endAt,
  	limit,
  }) {
  	if(limit === null || undefined === limit)
  		limit = 100;

  	const db = await getDb()

  	let query = db.select(
			'trx_id',
			'src',
			'mode',
			'action_ordinal',
			'pair_id',
			'sender',
			'recipient',
			'sqrtPriceX64',
			'liquidity',
			'tick',
			'amountA',
			'amountB',
			'negativeA',
			'negativeB',
			'codeA',
			'codeB',
			'precisionA',
			'precisionB',
			'reserveA',
			'reserveB',
			'created_at_block',
			'global_sequence',
			'updated_at_time',
  	).from('swapVThreeOrders');

	 	if(src !== undefined && null !== src)
	    query = query.where({'src': src})
  	if(pair_id !== undefined && null !== pair_id)
	    query = query.where({'pair_id': pair_id})
	  if(pairIdSrcArray !== undefined && pairIdSrcArray !== null && pairIdSrcArray.length > 0) {
	    query = query.where((builder) => {
	      builder.where(function () {
	        pairIdSrcArray.forEach(v => {
	          this.orWhere(function () {
	            this.where({ 'pair_id': v.pair_id, 'src': v.src });
	          });
	        });
	      });
	    });
	  }
  	if(sender !== undefined && null !== sender) {
	    query = query.where({'sender': sender})
  	}
  	else if(senders !== undefined && null !== senders) {
			if(senders.white.length) {
				query = query.whereIn('sender', senders.white);
			}
			else if(senders.black.length) {
				query = query.whereNotIn('sender', senders.black);
			}
		}

  	if(recipient !== undefined && null !== recipient)
	    query = query.where({'recipient': recipient})
  	if(codeA !== undefined && null !== codeA)
	    query = query.where({'codeA': codeA})
  	if(codeB !== undefined && null !== codeB)
	    query = query.where({'codeB': codeB})
   	if(code1 !== undefined && null !== code1)
   		query = query.where(function() {
		    this.where('codeA', code1).orWhere('codeB', code1);
		  });
   	if(code2 !== undefined && null !== code2)
   		query = query.where(function() {
		    this.where('codeA', code2).orWhere('codeB', code2);
		  });

		if(min_global_sequence !== undefined && null !== min_global_sequence)
   		query = query.where('global_sequence', '>=', min_global_sequence);
   	if(max_global_sequence !== undefined && null !== max_global_sequence)
   		query = query.where('global_sequence', '<', max_global_sequence);
	  if(startAt !== undefined && null !== startAt)
   		query = query.where('updated_at_time', '>=', startAt);
		if(endAt !== undefined && null !== endAt)
   		query = query.where('updated_at_time', '<', endAt);

   	query = query.orderBy(
			'global_sequence', 'desc'
		)

		if(limit !== false)
			query = query.limit(limit);

		try {
	    return await query;
	  } catch (error) {
	    // Handle any errors
	    console.error(error);
	    //throw error;
	  }
  }

	static async saveSwaps(swaps) {
		const db = await getDb()
		const redis = await getRedis()
		let totalUpd = 0
		let totalIns = 0
		for(const swap of swaps) {
			const dataToInsert = {
      	trx_id: swap.trx_id,
				src: swap.src,
				mode: swap.mode,
				action_ordinal: swap.action_ordinal,
				pair_id: swap.pair_id,
				sender: swap.sender,
				recipient: swap.recipient,
				sqrtPriceX64: swap.sqrtPriceX64,
				liquidity: swap.liquidity,
				tick: swap.tick,
				amountA: swap.amountA,
				amountB: swap.amountB,
				negativeA: swap.negativeA,
				negativeB: swap.negativeB,
				codeA: swap.codeA,
				codeB: swap.codeB,
				precisionA: swap.precisionA,
				precisionB: swap.precisionB,
				reserveA: swap.reserveA,
				reserveB: swap.reserveB,
				created_at_block: swap.created_at_block,
				global_sequence: swap.global_sequence,
				updated_at_time: swap.updated_at_time
      }
			try {
				await db('swapVThreeOrders').insert(dataToInsert)
				redis.publish('swapVThreeOrders_insert', JSON.stringify(swap));
				// Send a message to the exchange without specifying a routing key
				//redis.publish('swapVThreeOrders_insert_indexer', JSON.stringify(match));
				//redis.publish('swapVThreeOrders_insert_socketio', JSON.stringify(match));
				//rabbitmq.sendMessageToExchange('swapOrdersInsertExchange', '', dataToInsert)
				++totalIns
			} catch (e) {
				if (e.code === '23505') {
					if(dataToInsert.mode === 'history') {
						try {
		          await db('swapVThreeOrders')
		            .where({
		            	'trx_id' : dataToInsert.trx_id,
		            	'action_ordinal': dataToInsert.action_ordinal
		            })
		            .update(dataToInsert);
		           ++totalUpd
						}
						catch(e) {
							console.log('HistoryReader updateSwapV3 error')
							console.log(e)
						}
					}
		    } else {
					console.log('HistoryReader saveSwapV3 error')
					console.log(e)
		    }
			}
		}
    console.log('New swapsV3 saved', totalIns)
    console.log('SwapsV3 archived', totalUpd)
    console.log('Already swapsV3 received', swaps.length-totalIns-totalUpd)
	} 
}

export default SwapVThreeOrderRow