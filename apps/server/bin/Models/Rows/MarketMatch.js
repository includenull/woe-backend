import { getAssetAmount, getAssetCode, getAssetPrecision } from '../../../utils/wharfAssets.js'
import {parseDateFromSmartcontract, littleEndianToDesimal} from '../../../utils/utils.js'
import getDb from '../../Connectors/DbPGConnector.js'
import getRedis from '../../Connectors/RedisConnector.js'

class MarketMatchRow {
	constructor({
		trx_id,
		src,
		mode,
		action_ordinal,
		order_id,
		asker,
		bidder,
		unit_price,
		amount_ask,
		code_ask,
		precision_ask,
		amount_bid,
		code_bid,
		precision_bid,
		amount_bidder_balance_before,
		code_bidder_balance_before,
		precision_bidder_balance_before,
		market_id,
		market_frozen,
		market_contract_base_token,
		market_precision_base_token,
		market_code_base_token,
		market_contract_quote_token,
		market_precision_quote_token,
		market_code_quote_token,
		market_amount_min_buy,
		market_code_min_buy,
		market_precision_min_buy,
		market_amount_min_sell,
		market_code_min_sell,
		market_precision_min_sell,
		block_num,
		global_sequence,
		trx_time
	}) {
		this.trx_id = trx_id.toLowerCase()
		this.src = src
		this.mode = mode
		this.action_ordinal = action_ordinal
		this.order_id = order_id
		this.asker = asker
		this.bidder = bidder
		this.unit_price = unit_price
		this.amount_ask = amount_ask
		this.code_ask = code_ask
		this.precision_ask = precision_ask
		this.amount_bid = amount_bid
		this.code_bid = code_bid
		this.precision_bid = precision_bid
		this.amount_bidder_balance_before = amount_bidder_balance_before
		this.code_bidder_balance_before = code_bidder_balance_before
		this.precision_bidder_balance_before = precision_bidder_balance_before
		this.market_id = market_id
		this.market_frozen = market_frozen
		this.market_contract_base_token = market_contract_base_token
		this.market_precision_base_token = market_precision_base_token
		this.market_code_base_token = market_code_base_token
		this.market_contract_quote_token = market_contract_quote_token
		this.market_precision_quote_token = market_precision_quote_token
		this.market_code_quote_token = market_code_quote_token
		this.market_amount_min_buy = market_amount_min_buy
		this.market_code_min_buy = market_code_min_buy
		this.market_precision_min_buy = market_precision_min_buy
		this.market_amount_min_sell = market_amount_min_sell
		this.market_code_min_sell = market_code_min_sell
		this.market_precision_min_sell = market_precision_min_sell
		this.created_at_block = block_num
		this.global_sequence = global_sequence
		this.updated_at_time = parseDateFromSmartcontract(trx_time).getTime()
	}

	static parseActionData(src, data) {
    let marketMatch = {}

    let act = data
    if(['alcor_buy', 'alcor_sell'].indexOf(src) !== -1) {
      act = act.record

      marketMatch.src = src
			marketMatch.order_id = Number(act.id)
			marketMatch.asker = act.asker,
			marketMatch.bidder = act.bidder,
			marketMatch.unit_price = Number(littleEndianToDesimal(act.unit_price))

      marketMatch.amount_ask = getAssetAmount(act.ask)
			marketMatch.code_ask = getAssetCode(act.ask)
			marketMatch.precision_ask = getAssetPrecision(act.ask)
			marketMatch.amount_bid = getAssetAmount(act.bid)
			marketMatch.code_bid = getAssetCode(act.bid)
			marketMatch.precision_bid = getAssetPrecision(act.bid)
			marketMatch.amount_bidder_balance_before = getAssetAmount(act.bidder_balance_before)
			marketMatch.code_bidder_balance_before = getAssetCode(act.bidder_balance_before)
			marketMatch.precision_bidder_balance_before = getAssetPrecision(act.bidder_balance_before)

			marketMatch.market_id = Number(act.market.id)
			marketMatch.market_frozen = act.market.frozen
			marketMatch.market_contract_base_token = act.market.base_token.contract
			marketMatch.market_precision_base_token = Number(act.market.base_token.sym.split(',')[0])
			marketMatch.market_code_base_token = act.market.base_token.sym.split(',')[1]
			marketMatch.market_contract_quote_token = act.market.quote_token.contract
			marketMatch.market_precision_quote_token = Number(act.market.quote_token.sym.split(',')[0])
			marketMatch.market_code_quote_token = act.market.quote_token.sym.split(',')[1]
			marketMatch.market_amount_min_buy = getAssetAmount(act.market.min_buy)
			marketMatch.market_code_min_buy = getAssetCode(act.market.min_buy)
			marketMatch.market_precision_min_buy = getAssetPrecision(act.market.min_buy)
			marketMatch.market_amount_min_sell = getAssetAmount(act.market.min_sell)
			marketMatch.market_code_min_sell = getAssetCode(act.market.min_sell)
			marketMatch.market_precision_min_sell = getAssetPrecision(act.market.min_sell)
    }

    return marketMatch
  }

  static async removeHeadAboveBlocknum(block_num) {
  	const db = await getDb()

  	try {
  		await db('marketMatches').where('created_at_block', '>=', block_num).where(
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
	  	await db('marketMatches').where('created_at_block', '<=', block_num).where(
	  		'mode', 'head'
			).update({
	  		'mode': 'history'
	  	});
  	}
  	catch(err) {
  		console.log('failed to set rows to history', err)
  	}
  }

  static async saveMatches(matches) {
		const db = await getDb()	
		const redis = await getRedis()
		let totalUpd = 0
		let totalIns = 0
		for(const match of matches) {
			try {
				await db('marketMatches').insert(match)
				redis.publish('marketMatches_insert_indexer', JSON.stringify(match));
				redis.publish('marketMatches_insert_klinesIndexer', JSON.stringify(match));
				redis.publish('marketMatches_insert_socketio', JSON.stringify(match));
				++totalIns
			} catch (e) {
				if (e.code === '23505') {
					if(match.mode === 'history') {
						try {
		          await db('marketMatches')
		            .where({
		            	'trx_id' : match.trx_id,
		            	'action_ordinal': match.action_ordinal
		            })
		            .update(match);
		           ++totalUpd
						}
						catch(e) {
							console.log('HistoryReader updateMatch error')
							console.log(e)
						}
					}
		    } else {
					console.log('HistoryReader saveMatch error')
					console.log(e)
		    }
			}
		}
    console.log('New matches saved', totalIns)
    console.log('Matches archived', totalUpd)
    console.log('Already received', matches.length-totalIns-totalUpd)
    
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
  	code1, // equal to code_ask or code_bid
  	code2,
  	startAt,
  	endAt,
  	limit,
  	offset // not used yet 
  }) {
  	if(limit === undefined || null === limit)
  		limit = 100;

  	const db = await getDb()
  	let query = db.select(
  		'src',
  		'mode',
  		'trx_id',
  		'action_ordinal',
  		'order_id',
  		'asker',
  		'bidder',
  		'unit_price',
  		'amount_ask',
  		'code_ask',
  		'precision_ask',
  		'amount_bid',
  		'code_bid',
  		'precision_bid',
  		'market_id',
  		'created_at_block',
  		'global_sequence',
  		'updated_at_time'
		).from('marketMatches');

		if(src !== undefined && null !== src)
			query = query.whereLike('src', src.replace('market', '')+'%')
		if(pair_id !== undefined && null !== pair_id)
			query = query.where({'market_id': pair_id})
	  if(pairIdSrcArray !== undefined && pairIdSrcArray !== null && pairIdSrcArray.length > 0) {
	    query = query.where((builder) => {
	      builder.where(function () {
	        pairIdSrcArray.forEach(v => {
	          this.orWhere(function () {
	            this.where('market_id', v.pair_id)
              .andWhere('src', 'like', `${v.src.replace('market', '')}%`);
	          });
	        });
	      });
	    });
	  }

		if(wallet !== undefined && null !== wallet) {
	    query = query.where(function () {
	      this.where('asker', wallet).orWhere('bidder', wallet);
	    });
	  }
	  else if(wallets !== undefined && null !== wallets) {
			if(wallets.white.length) {
				query = query.where(function () {
		      this.whereIn('asker', wallets.white).orWhereIn('bidder', wallets.white);
		    });
			}
			else if(wallets.black.length) {
				query = query.whereNot(function () {
		      this.whereIn('asker', wallets.black).orWhereIn('bidder', wallets.black);
		    });
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
		    this.where('code_ask', code1).orWhere('code_bid', code1);
		  });
   	if(code2 !== undefined && null !== code2)
   		query = query.where(function() {
		    this.where('code_ask', code2).orWhere('code_bid', code2);
		  });

		if(side !== undefined && null !== side)
			query = query.whereLike('src', '%_'+side)

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

export default MarketMatchRow
