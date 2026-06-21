import { Asset } from "@wharfkit/antelope"
import { parseDateFromSmartcontract } from '@root/utils/utils.js'
import getDb from '@connectors/DbPGConnector.js'
import logger from '@utils/logger.js';

export default class ListingEventRow {
	constructor({
		trx_id,
		mode,
		listing_type,
		src,
		pair_id,
		fee,
		action,
		creator,
		contractA,
		contractB,
		codeA,
		codeB,
		block_num,
		global_sequence,
		trx_time
	}) {
		this.trx_id = trx_id.toLowerCase();
		this.mode = mode
		this.listing_type = listing_type
		this.src = src
		this.pair_id = pair_id
		this.fee = fee
		this.action = action
		this.creator = creator
		this.contractA = contractA
		this.contractB = contractB
		this.codeA = codeA
		this.codeB = codeB
		this.created_at_block = block_num
		this.global_sequence = global_sequence
		this.updated_at_time = parseDateFromSmartcontract(trx_time).getTime()
	}

	static async removeHeadAboveBlocknum(block_num) {
  	const db = await getDb()

  	try {
  		await db('listingEvents').where('created_at_block', '>=', block_num).where(
  			'mode', 'head'
			).del()
  	}
  	catch(err) {
  		logger.error({ err: err }, 'Failed to remove listing event rows above block')
  	}
  }

	static async setHeadToHistoryBeforeBlocknum(block_num) {
  	const db = await getDb()

  	try {
	  	await db('listingEvents').where('created_at_block', '<=', block_num).where(
	  		'mode', 'head'
			).update({
	  		'mode': 'history'
	  	});
  	}
  	catch(err) {
  		logger.error({ err: err }, 'failed to set listing event rows to history')
  	}
  }

	static async saveEvents(events) {
		const db = await getDb()
		//const redis = await getRedis()
		let totalUpd = 0
		let totalIns = 0
		for(const event of events) {
			const dataToInsert = {
				trx_id: event.trx_id,
				listing_type: event.listing_type,
				mode: event.mode,
				src: event.src,
				pair_id: event.pair_id,
				fee: event.fee,
				action: event.action,
				creator: event.creator,
				contractA: event.contractA,
				contractB: event.contractB,
				codeA: event.codeA,
				codeB: event.codeB,
				created_at_block: event.created_at_block,
				global_sequence: event.global_sequence,
				updated_at_time: event.updated_at_time,
      }
			try {
				await db('listingEvents').insert(dataToInsert)
				//redis.publish('swapOrders_insert_klinesIndexer', JSON.stringify(dataToInsert));
				++totalIns
			} catch (e) {
				if (e.code === '23505') {
					if(dataToInsert.mode === 'history') {
						try {
		          await db('listingEvents')
		            .where({
		            	'trx_id' : dataToInsert.trx_id,
		            	'action_ordinal': dataToInsert.action_ordinal
		            })
		            .update(dataToInsert);
		           ++totalUpd
						}
						catch(e) {
							logger.error('listingEvents updateLogs error')
							logger.error(e)
						}
					}
		    } else {
					logger.error('listingEvents saveLogs error')
					logger.error(e)
		    }
			}
		}
    logger.info({ totalIns }, 'New listing events saved')
    logger.info({ totalUpd }, 'Listing events archived')
    logger.info({ data: events.length-totalIns-totalUpd }, 'Already received')
	}
	static async parseActionData(src, data) {
    let ret = {}

    if(src === 'taco') {
    	ret.listing_type = 'pools'
    	ret.contractA = data.initial_pool1.contract
    	ret.contractB = data.initial_pool2.contract
    	ret.creator = data.user;

    	const assetA = Asset.from(data.initial_pool1.quantity)
    	const assetB = Asset.from(data.initial_pool2.quantity)
    	ret.codeA = assetA.symbol.name
    	ret.codeB = assetB.symbol.name
    	ret.pair_id = null
    	ret.fee = null
    }
    else if(src === 'neftyblocks') {
    	ret.listing_type = 'pools';
    	ret.contractA = data.token0.contract
    	ret.contractB = data.token1.contract

    	const symbolA = Asset.Symbol.from(data.token0.sym)
    	const symbolB = Asset.Symbol.from(data.token1.sym)
    	ret.codeA = symbolA.name
    	ret.codeB = symbolB.name

    	ret.pair_id = data.code
    	ret.creator = data.creator
    	ret.fee = null
    }
    else if(src === 'defibox') {
    	ret.listing_type = 'pools'
    	ret.contractA = data.token0.contract
    	ret.contractB = data.token1.contract

    	const symbolA = Asset.Symbol.from(data.token0.symbol)
    	const symbolB = Asset.Symbol.from(data.token1.symbol)
    	ret.codeA = symbolA.name
    	ret.codeB = symbolB.name

    	ret.pair_id = data.pair_id
    	ret.creator = data.creator
    	ret.fee = null
    }
    else if(src === 'adex') {
    	ret.listing_type = 'pools'

    	ret.contractA = data.base_token.contract
    	ret.contractB = data.quote_token.contract

    	const symbolA = Asset.Symbol.from(data.base_token.sym)
    	const symbolB = Asset.Symbol.from(data.quote_token.sym)
			ret.codeA = symbolA.name
    	ret.codeB = symbolB.name

    	ret.pair_id = null
    	ret.creator = 'listing.adex'
    	ret.fee = null
    }
    else if(src === 'alcorv2') {
    	ret.listing_type = 'poolsv3'

    	ret.contractA = data.tokenA.contract
    	ret.contractB = data.tokenB.contract

    	const assetA = Asset.from(data.tokenA.quantity)
    	const assetB = Asset.from(data.tokenB.quantity)
    	ret.codeA = assetA.symbol.name
    	ret.codeB = assetB.symbol.name

    	ret.pair_id = null
    	ret.creator = data.account
    	ret.fee = data.fee
    }

    return ret
	}

	static async fetchRows({
  	min_global_sequence,
  	max_global_sequence,
  	limit,
  }) {
  	if(limit === null || undefined === limit)
  		limit = 100;

  	const db = await getDb()
  	let query = db.select(
  		'trx_id',
			'listing_type',
			'src',
			'pair_id',
			'fee',
			'creator',
			'contractA',
			'contractB',
			'codeA',
			'codeB',
			'created_at_block',
			'global_sequence',
			'updated_at_time'
		).from('listingEvents');

		if(min_global_sequence !== undefined && null !== min_global_sequence)
   		query = query.where('global_sequence', '>=', min_global_sequence);
   	if(max_global_sequence !== undefined && null !== max_global_sequence)
   		query = query.where('global_sequence', '<', max_global_sequence);

		query = query.orderBy(
			'global_sequence', 'desc'
		)

		if(limit !== false)
			query = query.limit(limit);

		try {
	    return await query;
	  } catch (error) {
	    // Handle any errors
	    logger.error(error);
	    //throw error;
	  }
  }
}