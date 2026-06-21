import { asset, symbol, extended_asset, name, extended_symbol } from "eos-common"
import { parseDateFromSmartcontract } from '../../../utils/utils.js'
import getDb from '../../Connectors/DbPGConnector.js'

const getAmountFromAsset = (asset) => asset.amount/Math.pow(10, asset.symbol.precision())
const getCodeFromAsset = (asset) => asset.symbol.code().toString()
const getPrecisionFromAsset = (asset) => asset.symbol.precision()

export default class LogpoolRow {
	constructor({
		trx_id,
		src,
		mode,
		action_ordinal,
		poolId,
		fee,
		feeProtocol,
		sqrtPriceX64,
		tick,
		tickSpacing,
		tokenA,
		tokenB,
		block_num,
		global_sequence,
		trx_time,
	}) {
		this.trx_id = trx_id.toLowerCase()
		this.src = src
		this.mode = mode
		this.pair_id = poolId
		this.action_ordinal = action_ordinal
		this.created_at_block = block_num
		this.global_sequence = global_sequence
		this.updated_at_time = parseDateFromSmartcontract(trx_time).getTime()
		this.fee = fee
		this.feeProtocol = feeProtocol
		this.sqrtPriceX64 = sqrtPriceX64
		this.tick = tick
		this.tickSpacing = tickSpacing
		this.codeA = getCodeFromAsset(asset(tokenA.quantity))
		this.codeB = getCodeFromAsset(asset(tokenB.quantity))
		this.precisionA = getPrecisionFromAsset(asset(tokenA.quantity))
		this.precisionB = getPrecisionFromAsset(asset(tokenB.quantity))
		this.contractA = tokenA.contract
		this.contractB = tokenB.contract
	}

	static async fetchRows({
		trx_id,
		src,
		pair_id,
		mode,
		codeA,
		codeB,
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
			'mode',
			'action_ordinal',
			'pair_id',
			'fee',
			'feeProtocol',
			'sqrtPriceX64',
			'tick',
			'tickSpacing',
			'codeA',
			'codeB',
			'precisionA',
			'precisionB',
			'contractA',
			'contractB',
			'created_at_block',
			'global_sequence',
			'updated_at_time'
		).from('logpool');

		if(trx_id !== undefined && null !== trx_id)
			query = query.where({'trx_id': trx_id})
		if(src !== undefined && null !== src)
			query = query.where({'src': src})
		if(pair_id !== undefined && null !== pair_id)
			query = query.where({'pair_id': pair_id})
		if(mode !== undefined && null !== mode)
			query = query.where({'mode': mode})
		if(codeA !== undefined && null !== codeA)
			query = query.where({'codeA': codeA})
		if(codeB !== undefined && null !== codeB)
			query = query.where({'codeB': codeB})


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

	static async saveLogs(logpools) {
		const db = await getDb()
		//const redis = await getRedis()
		let totalUpd = 0
		let totalIns = 0
		for(const logpool of logpools) {
			const dataToInsert = {
      	trx_id: logpool.trx_id,
				src: logpool.src,
				mode: logpool.mode,
				action_ordinal: logpool.action_ordinal,
				pair_id: logpool.pair_id,
				fee: logpool.fee,
				feeProtocol: logpool.feeProtocol,
				'sqrtPriceX64': logpool.sqrtPriceX64,
				tick: logpool.tick,
				tickSpacing: logpool.tickSpacing,
				codeA: logpool.codeA,
				codeB: logpool.codeB,
				precisionA: logpool.precisionA,
				precisionB: logpool.precisionB,
				contractA: logpool.contractA,
				contractB: logpool.contractB,
				created_at_block: logpool.created_at_block,
				global_sequence: logpool.global_sequence,
				updated_at_time: logpool.updated_at_time
      }
			try {
				await db('logpool').insert(dataToInsert)
				//redis.publish('swapOrders_insert_klinesIndexer', JSON.stringify(dataToInsert));
				++totalIns
			} catch (e) {
				if (e.code === '23505') {
					if(dataToInsert.mode === 'history') {
						try {
		          await db('logpool')
		            .where({
		            	'trx_id' : dataToInsert.trx_id,
		            	'action_ordinal': dataToInsert.action_ordinal
		            })
		            .update(dataToInsert);
		           ++totalUpd
						}
						catch(e) {
							console.log('Logpool updateLogs error')
							console.log(e)
						}
					}
		    } else {
					console.log('Logpool saveLogs error')
					console.log(e)
		    }
			}
		}
    console.log('New liquidity changes saved', totalIns)
    console.log('Liquidity changes archived', totalUpd)
    console.log('Already received', logpools.length-totalIns-totalUpd)
  }
}