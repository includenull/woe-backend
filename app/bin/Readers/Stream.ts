import {
  createEosioShipReader,
  EosioReaderAbisMap,
  EosioReaderActionFilter,
  EosioReaderConfig,
  EosioReaderTableRowFilter,
  ShipTableDeltaName,
} from '../../libs/antelope-ship-reader/dist/index.js';

import SwapOrderRow from '../Models/Rows/SwapOrder.js';
import MarketMatchRow from '../Models/Rows/MarketMatch.js';
import SwapVThreeOrderRow from '../Models/Rows/SwapVThreeOrder.js';
import LiquidityRow from '../Models/Rows/Liquidity.js';
import LogpoolRow from '../Models/Rows/Logpool.js';
import ListingEventRow from '../Models/Rows/ListingEvent.js';
import LimitLogOrderFillRow from '../Models/Rows/LimitLogOrderFill.js';
import LimitLogOrderCloseRow from '../Models/Rows/LimitLogOrderClose.js';

import getRedis from '../Connectors/RedisConnector.js'

import AppConfig from '../../config.js'

import { fetchAbi, getInfo, eosioApi } from './utils.js';

export default class StreamReader {
  actions_interest: any[];
  eosioReader: any;
	onProcessedData: any;
	setLastSyncedBlock: any;
	setLastSyncedGlobalSequence: any;
	getLastSyncedBlock: any;
	getLastSyncedGlobalSequence: any;
	initialStartBlock: any;
	lastProcessedBlock: any;
	info: any;

  constructor(
  	actions_interest, onProcessedData,
  	setLastSyncedBlock, setLastSyncedGlobalSequence,
  	getLastSyncedBlock, getLastSyncedGlobalSequence
	) {
    this.actions_interest = actions_interest;
    this.eosioReader = null;
		this.onProcessedData = onProcessedData;
		this.setLastSyncedBlock = setLastSyncedBlock;
		this.setLastSyncedGlobalSequence = setLastSyncedGlobalSequence;
		this.getLastSyncedBlock = getLastSyncedBlock;
		this.getLastSyncedGlobalSequence = getLastSyncedGlobalSequence;

		this.initialStartBlock = null;
		this.lastProcessedBlock = 0;
		this.info = null;
  }

  async loadReader() {
    const table_rows_whitelist: () => EosioReaderTableRowFilter[] = () =>
      this.actions_interest.map((ai: any) => ({
        code: ai.account,
        table: '*',
      }));

    const actions_whitelist: () => EosioReaderActionFilter[] = () =>
      this.actions_interest.map((ai: any) => ({
        code: ai.account,
        action: ai.actname,
      }));

		let lastSyncsBlock: any[] = []
		for(const ai of this.actions_interest)
			lastSyncsBlock.push(await this.getLastSyncedBlock(ai.table, ai.src, (ai.filterByActname ? ai.actname : '')))
		// Take max block num since from history we fetch all and if restart from stream max sync is already processed
		lastSyncsBlock.sort((a, b) => b - a)
		this.initialStartBlock = lastSyncsBlock[0]
		this.info = await getInfo()
  	
  	const unique_contract_names = [...new Set(table_rows_whitelist().map((row) => row.code))]
  	const abisArr = await Promise.all(unique_contract_names.map((account_name) => fetchAbi(account_name)))

	  const contract_abis: () => EosioReaderAbisMap = () => {
	    const numap = new Map()
	    abisArr.forEach(({ account_name, abi }) => numap.set(account_name, abi))
	    return numap
	  }

	  const delta_whitelist: () => ShipTableDeltaName[] = () => [
	    'account_metadata',
	    'contract_table',
	    'contract_row',
	    'contract_index64',
	    'resource_usage',
	    'resource_limits_state',
	  ]

	  const eosioReaderConfig: EosioReaderConfig = {
	    ws_url: 'ws://'+AppConfig.waxnode_endpoint+':'+AppConfig.waxnode_ws_port,
	    rpc_url: eosioApi,
	    ds_threads: 6,
	    ds_experimental: false,
	    delta_whitelist,
	    table_rows_whitelist,
	    actions_whitelist,
	    contract_abis,
	    request: {
	      start_block_num: this.initialStartBlock - 2,
	      end_block_num: 0xffffffff,
	      max_messages_in_flight: 500,
	      have_positions: [],
	      irreversible_only: false,
	      fetch_block: true,
	      fetch_traces: true,
	      fetch_deltas: false,
	    },
	    auto_start: true,
	  }

	  this.eosioReader = await createEosioShipReader(eosioReaderConfig)

	  return this.eosioReader
	}

	async connect() {
		console.log('STREAM READER connecting')
	  const { blocks$, log$, errors$ } = await this.loadReader()
	  console.log('Subscribing to blocks')
	  blocks$.subscribe((block: any) => {
    	setTimeout(async () => {
				const redis = await getRedis();
				redis.set('READER_BLOCK_NUM', ''+block.block_num);

		  	if(block.block_num >= this.initialStartBlock) {
		  		if(this.lastProcessedBlock > block.block_num) {
		  			console.log('FORK DETECTED fell from block '+this.lastProcessedBlock+' to '+block.block_num)
						await SwapOrderRow.removeHeadAboveBlocknum(block.block_num)
						await MarketMatchRow.removeHeadAboveBlocknum(block.block_num)
						await SwapVThreeOrderRow.removeHeadAboveBlocknum(block.block_num)
						await LiquidityRow.removeHeadAboveBlocknum(block.block_num)
						await ListingEventRow.removeHeadAboveBlocknum(block.block_num)
            await LimitLogOrderFillRow.removeHeadAboveBlocknum(block.block_num)
            await LimitLogOrderCloseRow.removeHeadAboveBlocknum(block.block_num)

						redis.publish('READER_FORK_DETECTED', ''+block.block_num);
		  		}
			    console.log('============================================================')
			    console.log('block '+block.block_num+': '+block.actions.length +' actions')
			    //const blockElapsed = block.block_num - this.initialStartBlock
					//console.log((this.info.last_irreversible_block_num-block.block_num)+' blocks left to fetch init irreversible')
					//console.log((blockElapsed+this.info.last_irreversible_block_num-block.block_num)+' blocks left to fetch current irreversible')

			    if(block.actions.length) {
	    			const dataRows = await this.processBlock(block)
		    		this.onProcessedData(dataRows)
			    }
		  	}
    	}, 0)
	  })

	  errors$.subscribe(console.log)
	  log$.subscribe(console.log)
	}

	getSourceActionInterest(action: any) {
		const match = this.actions_interest.filter(ai => ai.account === action.account && ai.actname === action.name)

		return (match.length) ? match[0] : null
	}

	async processBlock(block: any) {
		this.lastProcessedBlock = block.block_num;
		// const SwapOrderRow = (await import('../Models/Rows/SwapOrder.js')) as any;
		// const MarketMatchRow = (await import('../Models/Rows/MarketMatch.js')) as any;
		// const SwapVThreeOrderRow = (await import('../Models/Rows/SwapVThreeOrder.js')) as any;
		
		let dataRows: any = [];

		const mode = (block.block_num <= this.info.last_irreversible_block_num) ? 'history' : 'head'

		// Update previous entry to history
		if(mode === 'head') {
			const irr_block_num = block.block_num - 180*2;
			SwapOrderRow.setHeadToHistoryBeforeBlocknum(irr_block_num)
			MarketMatchRow.setHeadToHistoryBeforeBlocknum(irr_block_num)
			SwapVThreeOrderRow.setHeadToHistoryBeforeBlocknum(irr_block_num)
			LiquidityRow.setHeadToHistoryBeforeBlocknum(irr_block_num)
			ListingEventRow.setHeadToHistoryBeforeBlocknum(irr_block_num)
      LimitLogOrderFillRow.setHeadToHistoryBeforeBlocknum(irr_block_num)
      LimitLogOrderCloseRow.setHeadToHistoryBeforeBlocknum(irr_block_num)
		}

		//console.log(block)
		for(const action of block.actions) {
			//console.log(action)
			const actionInterest: any = this.getSourceActionInterest(action)
			if(actionInterest.classname === 'SwapOrderRow') {
				const parsedAction = SwapOrderRow.parseActionData(actionInterest.src, action.data)
				dataRows.push(new SwapOrderRow({
					trx_id: action.transaction_id,
					src: actionInterest.src,
					mode: mode,
					action_ordinal: action.action_ordinal,
		      pair_id: parsedAction.pair_id,
		      maker: parsedAction.maker,
		      quantity_in: parsedAction.quantity_in,
		      quantity_out: parsedAction.quantity_out,
		      reserveA: parsedAction.reserveA,
		      reserveB: parsedAction.reserveB,
					block_num: block.block_num,
					global_sequence: action.global_sequence,
					trx_time: block.timestamp
				}))
			}
			else if(actionInterest.classname === 'MarketMatchRow') {
				const parsedAction = MarketMatchRow.parseActionData(actionInterest.src, action.data)
				dataRows.push(new MarketMatchRow({
					trx_id: action.transaction_id,
					mode: mode,
					action_ordinal: action.action_ordinal,
					block_num: block.block_num,
					global_sequence: action.global_sequence,
					trx_time: block.timestamp,
					...parsedAction
				}))
			}
			else if(actionInterest.classname === 'SwapVThreeOrderRow') {
				const parsedAction = SwapVThreeOrderRow.parseActionData(actionInterest.src, action.data)
				dataRows.push(new SwapVThreeOrderRow({
					trx_id: action.transaction_id,
					src: actionInterest.src,
					mode: mode, 
					action_ordinal: action.action_ordinal,
					block_num: block.block_num,
					global_sequence: action.global_sequence,
					trx_time: block.timestamp,
					...parsedAction
				}));
			}
			else if(actionInterest.classname === 'LiquidityRow') {
				const parsedAction = LiquidityRow.parseActionData(actionInterest.src, actionInterest.actname, action.data)
				dataRows.push(new LiquidityRow({
					trx_id: action.transaction_id,
					src: actionInterest.src,
					actname: actionInterest.actname,
					mode: mode,
					action_ordinal: action.action_ordinal,
					block_num: block.block_num,
					global_sequence: action.global_sequence,
					trx_time: block.timestamp,
					...parsedAction
				}))
			}
			else if(actionInterest.classname === 'LogpoolRow') {
				dataRows.push(new LogpoolRow({
					trx_id: action.transaction_id,
					src: actionInterest.src,
					mode: mode, 
					action_ordinal: action.action_ordinal,
					block_num: block.block_num,
					global_sequence: action.global_sequence,
					trx_time: block.timestamp,
					...action.data
				}))
			}
			else if(actionInterest.classname === 'ListingEventRow') {
				const parsedAction = await ListingEventRow.parseActionData(actionInterest.src, action.data)
				dataRows.push(new ListingEventRow({
					trx_id: action.transaction_id,
					src: actionInterest.src,
					mode: mode,
					action: 'create',
					block_num: block.block_num,
					global_sequence: action.global_sequence,
					trx_time: block.timestamp,
					...parsedAction
				}))
			}
      else if(actionInterest.classname === 'LimitLogOrderFillRow') {
        const parsedAction = LimitLogOrderFillRow.parseActionData(action.data);
        dataRows.push(new LimitLogOrderFillRow({
          trx_id: action.transaction_id,
          src: actionInterest.src,
          mode: mode,
          action_ordinal: action.action_ordinal,
          block_num: block.block_num,
          global_sequence: action.global_sequence,
          trx_time: block.timestamp,
          ...parsedAction
        }));
      }
      else if(actionInterest.classname === 'LimitLogOrderCloseRow') {
        const parsedAction = LimitLogOrderCloseRow.parseActionData(action.data);
        dataRows.push(new LimitLogOrderCloseRow({
          trx_id: action.transaction_id,
          src: actionInterest.src,
          mode: mode,
          action_ordinal: action.action_ordinal,
          block_num: block.block_num,
          global_sequence: action.global_sequence,
          trx_time: block.timestamp,
          ...parsedAction
        }));
      }
		}
		return dataRows;
	}

}