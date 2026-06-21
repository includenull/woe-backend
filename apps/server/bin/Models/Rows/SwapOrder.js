import { getAssetAmount, getAssetCode, getAssetPrecision } from '../../../utils/wharfAssets.js'
import {parseDateFromSmartcontract} from '../../../utils/utils.js'
import getDb from '../../Connectors/DbPGConnector.js'
import getRedis from '../../Connectors/RedisConnector.js'

class SwapOrderRow {
	constructor({
		trx_id,
		src,
		mode, 
		action_ordinal,
		pair_id,
		maker,
		quantity_in,
		quantity_out,
		reserveA,
		reserveB,
		block_num,
		global_sequence,
		trx_time
	}) {
		this.trx_id = trx_id.toLowerCase()
		this.src = src
		this.mode = mode
		this.action_ordinal = action_ordinal
		this.pair_id = pair_id
		this.maker = maker
		this.amount_in = getAssetAmount(quantity_in)
		this.amount_out = getAssetAmount(quantity_out)
		this.code_in = getAssetCode(quantity_in)
		this.code_out = getAssetCode(quantity_out)
		this.precision_in = getAssetPrecision(quantity_in)
		this.precision_out = getAssetPrecision(quantity_out)
		this.amount_reserveA = getAssetAmount(reserveA)
		this.amount_reserveB = getAssetAmount(reserveB)
		this.code_reserveA = getAssetCode(reserveA)
		this.code_reserveB = getAssetCode(reserveB)
		this.precision_reserveA = getAssetPrecision(reserveA)
		this.precision_reserveB = getAssetPrecision(reserveB)
		this.created_at_block = block_num
		this.global_sequence = global_sequence
		this.updated_at_time = parseDateFromSmartcontract(trx_time).getTime()
		// computed datas 
		this.swapPriceA = (this.code_in === this.code_reserveA)
			? this.amount_in/this.amount_out
			: this.amount_out/this.amount_in
		this.swapPriceB = 1 / this.swapPriceA
		this.poolPriceA = this.amount_reserveA/this.amount_reserveB
		this.poolPriceB = 1 / this.poolPriceA
	}

	static parseActionData(src, data) {
    let ret = {}

    if(src === 'alcor' || 'taco' === src) {
      if(src=== 'alcor')
        data = data.record

      ret.pair_id = (src === 'alcor') ? data.pair_id : data.id
      ret.maker = data.maker
      ret.quantity_in = data.quantity_in
      ret.quantity_out = data.quantity_out
      ret.reserveA = data.pool1
      ret.reserveB = data.pool2
    }
    else if(src === 'defibox') {
      ret.pair_id = data.pair_id
      ret.maker = data.owner
      ret.quantity_in = data.quantity_in
      ret.quantity_out = data.quantity_out
      ret.reserveA = data.reserve0
      ret.reserveB = data.reserve1
    }
    else if(src === 'neftyblocks') {
    	ret.pair_id = data.code
      ret.maker = data.owner
      ret.quantity_in = data.quantity_in
      ret.quantity_out = data.quantity_out
      ret.reserveA = data.reserve0.quantity
      ret.reserveB = data.reserve1.quantity
    }

    return ret
  }

  static async removeHeadAboveBlocknum(block_num) {
  	const db = await getDb()

  	try {
  		await db('swapOrders').where('created_at_block', '>=', block_num).where(
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
	  	await db('swapOrders').where('created_at_block', '<=', block_num).where(
	  		'mode', 'head'
			).update({
	  		'mode': 'history'
	  	});
  	}
  	catch(err) {
  		console.log('failed to set rows to history', err)
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
				maker: swap.maker,
				amount_in: swap.amount_in,
				amount_out: swap.amount_out,
				code_in: swap.code_in,
				code_out: swap.code_out,
				precision_in: swap.precision_in,
				precision_out: swap.precision_out,
				amount_reserveA: swap.amount_reserveA,
				amount_reserveB: swap.amount_reserveB,
				code_reserveA: swap.code_reserveA,
				code_reserveB: swap.code_reserveB,
				precision_reserveA: swap.precision_reserveA,
				precision_reserveB: swap.precision_reserveB,
				created_at_block: swap.created_at_block,
				global_sequence: swap.global_sequence,
				updated_at_time: swap.updated_at_time
      }
			try {
				await db('swapOrders').insert(dataToInsert)
				redis.publish('swapOrders_insert_klinesIndexer', JSON.stringify(dataToInsert));
				//rabbitmq.sendMessageToExchange('swapOrdersInsertExchange', '', dataToInsert)
				++totalIns
			} catch (e) {
				if (e.code === '23505') {
					if(dataToInsert.mode === 'history') {
						try {
		          await db('swapOrders')
		            .where({
		            	'trx_id' : dataToInsert.trx_id,
		            	'action_ordinal': dataToInsert.action_ordinal
		            })
		            .update(dataToInsert);
		           ++totalUpd
						}
						catch(e) {
							console.log('HistoryReader updateSwap error')
							console.log(e)
						}
					}
		    } else {
					console.log('HistoryReader saveSwap error')
					console.log(e)
		    }
			}
		}
    console.log('New swaps saved', totalIns)
    console.log('Swaps archived', totalUpd)
    console.log('Already received', swaps.length-totalIns-totalUpd)
  }
  static async fetchRows({
  	src,
  	pair_id,
  	pairIdSrcArray, // An array of pairs representing pair_id and src
  	wallet,
  	wallets,
  	status, // not used yet 
  	side,
  	min_global_sequence,
  	max_global_sequence,
  	code1, // equal to code_in or code_out
  	code2,
  	startAt,
  	endAt,
  	limit,
  	offset // not used yet 
  }) {
  	if(limit === null || undefined === limit)
  		limit = 100;

  	const db = await getDb()
  	let query = db.select(
  		'src',
  		'mode',
  		'trx_id',
  		'action_ordinal',
  		'pair_id',
  		'maker',
  		'amount_in',
  		'amount_out',
  		'code_in',
  		'code_out',
  		'precision_in',
  		'precision_out',
			'amount_reserveA',
			'amount_reserveB',
			'code_reserveA',
			'code_reserveB',
			'precision_reserveA',
			'precision_reserveB',
  		'created_at_block',
  		'global_sequence',
  		'updated_at_time'
		).from('swapOrders');

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

		if(wallet !== undefined && null !== wallet) {
	    query = query.where({'maker': wallet})
		}
		else if(wallets !== undefined && null !== wallets) {
			if(wallets.white.length) {
				query = query.whereIn('maker', wallets.white);
			}
			else if(wallets.black.length) {
				query = query.whereNotIn('maker', wallets.black);
			}
		}

		if(min_global_sequence !== undefined && null !== min_global_sequence)
   		query = query.where('global_sequence', '>=', min_global_sequence);
   	if(max_global_sequence !== undefined && null !== max_global_sequence)
   		query = query.where('global_sequence', '<', max_global_sequence);
		if(startAt !== undefined && null !== startAt)
   		query = query.where('updated_at_time', '>=', startAt);
		if(endAt !== undefined && null !== endAt)
   		query = query.where('updated_at_time', '<', endAt);
   	if(code1 !== undefined && null !== code1)
   		query = query.where(function() {
		    this.where('code_in', code1).orWhere('code_out', code1);
		  });
   	if(code2 !== undefined && null !== code2)
   		query = query.where(function() {
		    this.where('code_in', code2).orWhere('code_out', code2);
		  });

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
}

export default SwapOrderRow
