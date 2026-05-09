import { asset, symbol, extended_asset, name, extended_symbol } from "eos-common"
import { parseDateFromSmartcontract } from '../../../utils/utils.js'
import getDb from '../../Connectors/DbPGConnector.js'

const getAmountFromAsset = (asset) => asset.amount/Math.pow(10, asset.symbol.precision())
const getCodeFromAsset = (asset) => asset.symbol.code().toString()
const getPrecisionFromAsset = (asset) => asset.symbol.precision()

export default class LiquidityRow {
	constructor({
		trx_id,
		src,
		actname,
		mode, 
		action_ordinal,
		block_num,
		global_sequence,
		trx_time,
		pair_id,
		extAssetA,
		extAssetB
	}) {
		this.trx_id = trx_id.toLowerCase()
		this.src = src
		this.actname = actname
		this.mode = mode
		this.action_ordinal = action_ordinal
		this.created_at_block = block_num
		this.global_sequence = global_sequence
		this.updated_at_time = parseDateFromSmartcontract(trx_time).getTime()
		this.pair_id = pair_id
		this.amount_reserveA = getAmountFromAsset(asset(extAssetA))
		this.amount_reserveB = getAmountFromAsset(asset(extAssetB))
		this.code_reserveA = getCodeFromAsset(asset(extAssetA))
		this.code_reserveB = getCodeFromAsset(asset(extAssetB))
		this.precision_reserveA = getPrecisionFromAsset(asset(extAssetA))
		this.precision_reserveB = getPrecisionFromAsset(asset(extAssetB))
		this.tokenA_price = null	
	}

	static parseActionData(src, actname, actdata) {
		let ret = {
			pair_id: null,
			extAssetA: null,
			extAssetB: null
		}
		if(src === 'taco' && actname === 'liquiditylog') {
			ret.pair_id = getCodeFromAsset(asset(actdata.lp_token))
			ret.extAssetA = actdata.pool1
			ret.extAssetB = actdata.pool2
		}
		else if(src === 'alcorv2' && ['logmint', 'logburn', 'logcollect'].includes(actname) ) {
			ret.pair_id = actdata.poolId
			ret.extAssetA = actdata.reserveA
			ret.extAssetB = actdata.reserveB
		}
		else if(src === 'defibox' && actname === 'liquiditylog') {
			ret.pair_id = actdata.pair_id
			ret.extAssetA = actdata.reserve0
			ret.extAssetB = actdata.reserve1	
		}
		else {
			console.log('Action not defined into LiquidityRow:parseAction')
			console.log(src, actname, actdata)
			process.exit()
		}

		return ret
	}

	static async updateTokenAPrice(trx_id, action_ordinal, tokenA_price) {
		const db = await getDb()
		try {
			await db('liquidity')
			.where({
				'trx_id' : trx_id,
				'action_ordinal': action_ordinal,
			})
			.update({
				'tokenA_price': tokenA_price
			});
		} catch (e) {
			console.log('Liquidity updateTokenAPrice error')
			console.log(e)
		}
	}

	static async fetchRows({
		src,
		actname,
		pair_id,
		mode,
		code_reserveA,
		code_reserveB,
		tokenA_price,
		startAt,
		endAt,
		limit,
		orderBySort = 'desc'
	}) {
		if(limit === null || undefined === limit)
  		limit = 100;

  	const db = await getDb()
  	let query = db.select(
			'trx_id',
			'src',
			'actname',
			'mode',
			'action_ordinal',
			'pair_id',
			'amount_reserveA',
			'amount_reserveB',
			'code_reserveA',
			'code_reserveB',
			'precision_reserveA',
			'precision_reserveB',
			'tokenA_price',
			'created_at_block',
			'global_sequence',
			'updated_at_time'
		).from('liquidity');

		if(src !== undefined && null !== src)
			query = query.where({'src': src})
		if(actname !== undefined && null !== actname)
			query = query.where({'actname': actname})
		if(pair_id !== undefined && null !== pair_id)
			query = query.where({'pair_id': pair_id})
		if(mode !== undefined && null !== mode)
			query = query.where({'mode': mode})
		if(code_reserveA !== undefined && null !== code_reserveA)
			query = query.where({'code_reserveA': code_reserveA})
		if(code_reserveB !== undefined && null !== code_reserveB)
			query = query.where({'code_reserveB': code_reserveB})
		// tokenA_price can be null, we might look for this specific value
		if(tokenA_price === null)
			query = query.whereNull('tokenA_price')
		else if(tokenA_price !== undefined)
			query = query.where({'tokenA_price': tokenA_price})

		if(startAt !== undefined && null !== startAt)
   		query = query.where('updated_at_time', '>=', startAt);
		if(endAt !== undefined && null !== endAt)
   		query = query.where('updated_at_time', '<', endAt);

		query = query.orderBy(
			'global_sequence', orderBySort
		).limit(limit);

		try {
	    return await query;
	  } catch (error) {
	    // Handle any errors
	    console.error(error);
	    //throw error;
	  }
	}

	static async removeHeadAboveBlocknum(block_num) {
  	const db = await getDb()

  	try {
  		await db('liquidity').where('created_at_block', '>=', block_num).where(
  			'mode', 'head'
			).del()
  	}
  	catch(err) {
  		console.log('Failed to remove liquidity rows above block', err)
  	}
  }

	static async setHeadToHistoryBeforeBlocknum(block_num) {
  	const db = await getDb()

  	try {
	  	await db('liquidity').where('created_at_block', '<=', block_num).where(
	  		'mode', 'head'
			).update({
	  		'mode': 'history'
	  	});
  	}
  	catch(err) {
  		console.log('failed to set liquidity rows to history', err)
  	}
  }

  static async saveChanges(liquidityChanges) {
		const db = await getDb()
		//const redis = await getRedis()
		let totalUpd = 0
		let totalIns = 0
		for(const liquidityChange of liquidityChanges) {
			const dataToInsert = {
      	trx_id: liquidityChange.trx_id,
				src: liquidityChange.src,
				actname: liquidityChange.actname,
				mode: liquidityChange.mode,
				action_ordinal: liquidityChange.action_ordinal,
				pair_id: liquidityChange.pair_id,
				amount_reserveA: liquidityChange.amount_reserveA,
				amount_reserveB: liquidityChange.amount_reserveB,
				code_reserveA: liquidityChange.code_reserveA,
				code_reserveB: liquidityChange.code_reserveB,
				precision_reserveA: liquidityChange.precision_reserveA,
				precision_reserveB: liquidityChange.precision_reserveB,
				tokenA_price: liquidityChange.tokenA_price,
				created_at_block: liquidityChange.created_at_block,
				global_sequence: liquidityChange.global_sequence,
				updated_at_time: liquidityChange.updated_at_time
      }
			try {
				await db('liquidity').insert(dataToInsert)
				//redis.publish('swapOrders_insert_klinesIndexer', JSON.stringify(dataToInsert));
				++totalIns
			} catch (e) {
				if (e.code === '23505') {
					if(dataToInsert.mode === 'history') {
						try {
		          await db('liquidity')
		            .where({
		            	'trx_id' : dataToInsert.trx_id,
		            	'action_ordinal': dataToInsert.action_ordinal
		            })
		            .update(dataToInsert);
		           ++totalUpd
						}
						catch(e) {
							console.log('HistoryReader updateLiquidity error')
							console.log(e)
						}
					}
		    } else {
					console.log('HistoryReader saveLiquidity error')
					console.log(e)
		    }
			}
		}
    console.log('New liquidity changes saved', totalIns)
    console.log('Liquidity changes archived', totalUpd)
    console.log('Already received', liquidityChanges.length-totalIns-totalUpd)
  }
}