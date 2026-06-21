import axios from 'axios'

import AppConfig from '../../config.js'

import { delay, getBlockTimestamp, getBlockNumFromTimestamp, makeDateForSmartcontract} from '@utils/utils.js'
import SwapOrderRow from '@models/Rows/SwapOrder.js'
import MarketMatchRow from '@models/Rows/MarketMatch.js'
import SwapVThreeOrderRow from '@models/Rows/SwapVThreeOrder.js'
import LiquidityRow from '@models/Rows/Liquidity.js'
import LogpoolRow from '@models/Rows/Logpool.js'
import ListingEventRow from '@models/Rows/ListingEvent.js';
import LimitLogOrderFillRow from '@models/Rows/LimitLogOrderFill.js';
import LimitLogOrderCloseRow from '@models/Rows/LimitLogOrderClose.js';
import logger from '@utils/logger.js';

class TraceAction {
	constructor(block_num, trx_id, act) {
		this.block_num = block_num
		this.trx_id = trx_id
		this.act = act
	}
}

class HistoryReader {
	constructor(
		actions_interest,
		onProcessedData,
		setLastSyncedBlock,
		setLastSyncedGlobalSequence,
		getLastSyncedBlock,
		getLastSyncedGlobalSequence,
		restartReader
	) {
		this.actions_interest = actions_interest;
		this.onProcessedData = onProcessedData;
		this.setLastSyncedBlock = setLastSyncedBlock;
		this.setLastSyncedGlobalSequence = setLastSyncedGlobalSequence;
		this.getLastSyncedBlock = getLastSyncedBlock;
		this.getLastSyncedGlobalSequence = getLastSyncedGlobalSequence;
		this.restartReader = restartReader;
		this.syncs = []
		this.errorTriggered = false
	}

	async connect() {
	  for(let i = 0; i < this.actions_interest.length; ++i) {
	  	if(this.syncs.length <= i)
	  		this.syncs.push(false)

	  	// reset to false
	  	this.syncs[i] = false

	  	const data = await this.fetchActionsHistory(this.actions_interest[i])
	  	if(data.length) {
      	this.onProcessedData(data)

      	if(data.length < 10000)
      		this.syncs[i] = true
	  	}
	  	else
  			this.syncs[i] = true

  		await delay(AppConfig.hyperion_delay)
	  }

	  if(this.syncs.includes(false) || this.errorTriggered)
    	setTimeout(() => {this.errorTriggered = false; this.connect()}, AppConfig.history_loop_delay)
    else {
    	logger.info({ syncs: this.syncs, errorTriggered: this.errorTriggered })
    	this.restartReader()
    }
	}

	async fetchActionsHistory(act_interest) {
		// speculative block nums
		const head_block_num = getBlockNumFromTimestamp(Date.now())
		const last_irreversible_block_num = head_block_num - 325 

    const last_synced_block_num = await this.getLastSyncedBlock(act_interest.table, act_interest.src, (act_interest.filterByActname ? act_interest.actname : '') )
    const last_synced_global_sequence = await this.getLastSyncedGlobalSequence(act_interest.table, act_interest.src, (act_interest.filterByActname ? act_interest.actname : '') )
    logger.info(
    	'Source '+act_interest.src+
    	' - Actname '+act_interest.actname+
    	' - last sync utc time: '+makeDateForSmartcontract(getBlockTimestamp(last_synced_block_num))+
    	' - last sync block: ' + last_synced_block_num +
  		' - global sequence: ' + last_synced_global_sequence
  	)
    const configured_start_block = AppConfig.start_block ?? head_block_num - 10000
    const start_block_num = Math.max(configured_start_block, act_interest.firstblock, last_synced_block_num)
    const dataRows = await this.getHistory({
			account: act_interest.account,
			actname: act_interest.actname,
			filterByActname: act_interest.filterByActname,
			table: act_interest.table,
			classname: act_interest.classname,
			src: act_interest.src,
			start_block_num: start_block_num,
			end_block_num: head_block_num+10,
			irreversible_block_num: last_irreversible_block_num,
			start_global_sequence: last_synced_global_sequence + 1
    })

    return dataRows
	}

	async getHistory(params) {
		let traceActionsAll = []
		return await this.getActionsHistory(
			params.account,
			params.actname,
			params.filterByActname,
			params.table,
			params.classname,
			params.src,
			params.start_block_num,
			params.end_block_num,
			params.irreversible_block_num,
			params.start_global_sequence
		)
	}

	async getActionsHistory(account, actname, filterByActname, table, classname, src, start_block, end_block, irreversible_block_num, start_global_sequence, skip = 0, limit = 100, prevFetch = []) {
		const extraParam = '?account='+account+
			'&act.name='+actname+
			'&skip='+skip+
			'&limit='+limit+
			'&block_num='+start_block+'-'+end_block+
			'&global_sequence='+start_global_sequence+'-10000000000000'+
			'&sort=asc'

		let fetchActions = []

		try {
			let history = await axios.get(AppConfig.hyperion_endpoint + 'history/get_actions' + extraParam)
			logger.info(AppConfig.hyperion_endpoint + 'history/get_actions' + extraParam)
			history = history.data

			for(let i = 0; i < history.actions.length; ++i) {
				let dataRow = []

				const mode = (history.actions[i].block_num > irreversible_block_num) ? 'head' : 'history';

				const lastSyncedBlock = await this.getLastSyncedBlock(table, src, (filterByActname ? actname : ''))
				if(mode === 'history' && history.actions[i].block_num > lastSyncedBlock)
					this.setLastSyncedBlock(table, src, (filterByActname ? actname : ''), history.actions[i].block_num)
				const lastSyncedGlobalSequence = await this.getLastSyncedGlobalSequence(table, src, (filterByActname ? actname : ''))
				if(mode === 'history' && history.actions[i].global_sequence > lastSyncedGlobalSequence)
					this.setLastSyncedGlobalSequence(table, src, (filterByActname ? actname : ''), history.actions[i].global_sequence)

				if(classname === 'SwapOrderRow') {
					const parsedAction = SwapOrderRow.parseActionData(src, history.actions[i].act.data)
					dataRow = new SwapOrderRow({
						trx_id: history.actions[i].trx_id,
						src: src,
						mode: mode,
						action_ordinal: history.actions[i].action_ordinal,
			      pair_id: parsedAction.pair_id,
			      maker: parsedAction.maker,
			      quantity_in: parsedAction.quantity_in,
			      quantity_out: parsedAction.quantity_out,
			      reserveA: parsedAction.reserveA,
			      reserveB: parsedAction.reserveB,
						block_num: history.actions[i].block_num,
						global_sequence: history.actions[i].global_sequence,
						trx_time: history.actions[i]['@timestamp']
					})
				}
				else if(classname === 'MarketMatchRow') {
					const parsedAction = MarketMatchRow.parseActionData(src, history.actions[i].act.data)
					dataRow = new MarketMatchRow({
						trx_id: history.actions[i].trx_id,
						mode: mode,
						action_ordinal: history.actions[i].action_ordinal,
						block_num: history.actions[i].block_num,
						global_sequence: history.actions[i].global_sequence,
						trx_time: history.actions[i]['@timestamp'],
						...parsedAction
					})
				}
				else if(classname === 'SwapVThreeOrderRow') {
					const parsedAction = SwapVThreeOrderRow.parseActionData(src, history.actions[i].act.data)
					dataRow = new SwapVThreeOrderRow({
						trx_id: history.actions[i].trx_id,
						src: src,
						mode: mode, 
						action_ordinal: history.actions[i].action_ordinal,
						block_num: history.actions[i].block_num,
						global_sequence: history.actions[i].global_sequence,
						trx_time: history.actions[i]['@timestamp'],
						...parsedAction
					});
				}
				else if(classname === 'LiquidityRow') {
					const parsedAction = LiquidityRow.parseActionData(src, actname, history.actions[i].act.data)
					dataRow = new LiquidityRow({
						trx_id: history.actions[i].trx_id,
						src: src,
						actname: actname,
						mode: mode, 
						action_ordinal: history.actions[i].action_ordinal,
						block_num: history.actions[i].block_num,
						global_sequence: history.actions[i].global_sequence,
						trx_time: history.actions[i]['@timestamp'],
						...parsedAction
					})
				}
				else if(classname === 'LogpoolRow') {
					dataRow = new LogpoolRow({
						trx_id: history.actions[i].trx_id,
						src: src,
						mode: mode, 
						action_ordinal: history.actions[i].action_ordinal,
						block_num: history.actions[i].block_num,
						global_sequence: history.actions[i].global_sequence,
						trx_time: history.actions[i]['@timestamp'],
						...history.actions[i].act.data
					})
				}
				else if(classname === 'ListingEventRow') {
					const parsedAction = await ListingEventRow.parseActionData(src, history.actions[i].act.data)
					dataRow = new ListingEventRow({
						trx_id: history.actions[i].trx_id,
						src: src,
						mode: mode,
						action: 'create',
						block_num: history.actions[i].block_num,
						global_sequence: history.actions[i].global_sequence,
						trx_time: history.actions[i]['@timestamp'],
						...parsedAction
					})
				}
        else if(classname === 'LimitLogOrderFillRow') {
          const parsedAction = LimitLogOrderFillRow.parseActionData(history.actions[i].act.data)
          dataRow = new LimitLogOrderFillRow({
            trx_id: history.actions[i].trx_id,
            src: src,
            mode: mode,
            action_ordinal: history.actions[i].action_ordinal,
            block_num: history.actions[i].block_num,
            global_sequence: history.actions[i].global_sequence,
            trx_time: history.actions[i]['@timestamp'],
            ...parsedAction
          });
        }
        else if(classname === 'LimitLogOrderCloseRow') {
          const parsedAction = LimitLogOrderCloseRow.parseActionData(history.actions[i].act.data)
          dataRow = new LimitLogOrderCloseRow({
            trx_id: history.actions[i].trx_id,
            src: src,
            mode: mode,
            action_ordinal: history.actions[i].action_ordinal,
            block_num: history.actions[i].block_num,
            global_sequence: history.actions[i].global_sequence,
            trx_time: history.actions[i]['@timestamp'],
            ...parsedAction
          });
        }

				fetchActions.push(dataRow)
			}

			if(fetchActions.length < limit || (skip + limit) >= 10000 )
				return prevFetch.concat(fetchActions)
			else {
				await delay(AppConfig.hyperion_delay)
				return await this.getActionsHistory(account, actname, filterByActname, table, classname, src, start_block, end_block, irreversible_block_num, start_global_sequence, (skip + fetchActions.length), limit, prevFetch.concat(fetchActions))
			}
		}
		catch(e) {
			logger.error('error catch')
			this.errorTriggered = true
			logger.info(AppConfig.hyperion_endpoint + 'history/get_actions' + extraParam)
			if(e.code !== undefined)
				logger.info(e.code)
			else
				logger.error(e)

			return fetchActions
		}
	}
}

export default HistoryReader
