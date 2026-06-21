import HistoryReader from './Readers/History.js';
import StreamReader from './Readers/Stream.js';
import getDb from './Connectors/DbPGConnector.js'

import SwapOrdersTable from './Models/Tables/SwapOrders.js'
import MarketMatchesTable from './Models/Tables/MarketMatches.js'
import SwapVThreeOrdersTable from './Models/Tables/SwapVThreeOrders.js'
import LiquidityTable from './Models/Tables/Liquidity.js'
import LogpoolTable from './Models/Tables/Logpool.js'
import ListingEventsTable from '@models/Tables/ListingEvents.js';
import LimitLogOrderFillTable from '@models/Tables/LimitLogOrderFill.js';
import LimitLogOrderCloseTable from '@models/Tables/LimitLogOrderClose.js';

import SwapOrderRow from './Models/Rows/SwapOrder.js'
import MarketMatchRow from './Models/Rows/MarketMatch.js'
import SwapVThreeOrderRow from './Models/Rows/SwapVThreeOrder.js'
import LiquidityRow from './Models/Rows/Liquidity.js'
import LogpoolRow from './Models/Rows/Logpool.js'
import ListingEventRow from '@models/Rows/ListingEvent.js';
import LimitLogOrderFillRow from '@models/Rows/LimitLogOrderFill.js';
import LimitLogOrderCloseRow from '@models/Rows/LimitLogOrderClose.js';

import { delay } from '../utils/utils.js'

class Reader {
	constructor(actions_interest) {
		this.actions_interest = actions_interest

		this.lastSyncedBlocks = {}
		this.lastSyncedGlobalSequences = {}

		this.historyReader = null;
		this.streamReader = null;
	}

	async onProcessedData(datas) {
    const dataSwapOrderRow = datas.filter(d => d instanceof SwapOrderRow)
    if(dataSwapOrderRow.length) {
      console.log(dataSwapOrderRow.length + ' swaps to process')
      SwapOrderRow.saveSwaps(dataSwapOrderRow)
    }
    const dataMarketMatchRow = datas.filter(d => d instanceof MarketMatchRow)
    if(dataMarketMatchRow.length) {
      console.log(dataMarketMatchRow.length + ' market matches to process')
      MarketMatchRow.saveMatches(dataMarketMatchRow)
    }
    const dataSwapVThreeOrderRow = datas.filter(d => d instanceof SwapVThreeOrderRow)
    if(dataSwapVThreeOrderRow.length) {
    	console.log(dataSwapVThreeOrderRow.length + ' swaps v3 to process')
    	SwapVThreeOrderRow.saveSwaps(dataSwapVThreeOrderRow)
    }
    const dataLiquidityRow = datas.filter(d => d instanceof LiquidityRow)
    if(dataLiquidityRow.length) {
    	console.log(dataLiquidityRow.length + ' liquidity changes to process')
    	LiquidityRow.saveChanges(dataLiquidityRow)
    }
    const dataLogpoolRow = datas.filter(d => d instanceof LogpoolRow)
    if(dataLogpoolRow.length) {
    	console.log(dataLogpoolRow.length + ' logpool to process')
    	LogpoolRow.saveLogs(dataLogpoolRow)
    }
    const dataListingEventRow = datas.filter(d => d instanceof ListingEventRow)
    if(dataListingEventRow.length) {
    	console.log(dataListingEventRow.length + ' listing events to process')
    	ListingEventRow.saveEvents(dataListingEventRow)
    }
    const dataLimitLogOrderFillRow = datas.filter(d => d instanceof LimitLogOrderFillRow);
    if(dataLimitLogOrderFillRow.length) {
      console.log(dataLimitLogOrderFillRow.length + ' limit log order fill to process');
      LimitLogOrderFillRow.saveLogs(dataLimitLogOrderFillRow);
    }
    const dataLimitLogOrderCloseRow = datas.filter(d => d instanceof LimitLogOrderCloseRow);
    if(dataLimitLogOrderCloseRow.length) {
      console.log(dataLimitLogOrderCloseRow.length + ' limit log order close to process');
      LimitLogOrderCloseRow.saveLogs(dataLimitLogOrderCloseRow);
    }
	}

	setLastSyncedBlock(table, src, actname, block_num) {
		this.lastSyncedBlocks[table+src+actname] = block_num
	}

	setLastSyncedGlobalSequence(table, src, actname, block_num) {
		this.lastSyncedGlobalSequences[table+src+actname] = block_num
	}

	async getLastSyncedBlock(table, src, actname = '') {
		const cacheKey = table + src + actname

		if(this.lastSyncedBlocks[cacheKey] !== undefined)
			return this.lastSyncedBlocks[cacheKey]

		const whereObj = {
			'src': src,
			'mode': 'history'
		}

		if(actname !== '')
			whereObj.actname = actname

		const db = await getDb()
		const results = await db.select(
				'created_at_block'
			).from(
				table
			).where(whereObj).orderBy(
				'created_at_block', 'desc'
			).limit(1);
		this.lastSyncedBlocks[cacheKey] = (results.length) ? Number(results[0].created_at_block) : 0
		
		return this.lastSyncedBlocks[cacheKey]
	}

	async getLastSyncedGlobalSequence(table, src, actname) {
		if(this.lastSyncedGlobalSequences[table+src+actname] !== undefined)
			return this.lastSyncedGlobalSequences[table+src+actname]

		const whereObj = {
			'src': src,
			'mode': 'history'
		}

		if(actname !== '')
			whereObj.actname = actname

		const db = await getDb()
		const results = await db.select(
				'global_sequence'
			).from(
				table
			).where(whereObj).orderBy(
				'global_sequence', 'desc'
			).limit(1);
		this.lastSyncedGlobalSequences[table+src+actname] = (results.length) ? Number(results[0].global_sequence) : 0
		
		return this.lastSyncedGlobalSequences[table+src+actname]
	}

	// This function is not cached cause only called at start
	async getLastSyncedUpdatedAtTime(table, src, actname = '') {
		const whereObj = {
			'src': src,
			'mode': 'history'
		}

		if(actname !== '')
			whereObj.actname = actname

		const db = await getDb()
		const results = await db.select(
				'updated_at_time'
			).from(
				table
			).where(whereObj).orderBy(
				'global_sequence', 'desc'
			).limit(1)

		return (results.length) ? Number(results[0].updated_at_time) : 0;
	}

	async start(forceStream = false) {
		// Create tables if not exists 
		const swapOrdersTable = new SwapOrdersTable()
		await swapOrdersTable.create()
		const marketMatchesTable = new MarketMatchesTable()
		await marketMatchesTable.create()
		const swapVThreeOrdersTable = new SwapVThreeOrdersTable()
		await swapVThreeOrdersTable.create()
		const liquidityTable = new LiquidityTable()
		await liquidityTable.create()
		const logpoolTable = new LogpoolTable()
		await logpoolTable.create()
		const listingEventsTable = new ListingEventsTable()
		await listingEventsTable.create()
    const limitLogOrderFillTable = new LimitLogOrderFillTable();
    await limitLogOrderFillTable.create();
    const limitLogOrderCloseTable = new LimitLogOrderCloseTable();
    await limitLogOrderCloseTable.create();

		let lastSyncsUpdatedAtTime = [];
		for(const ai of this.actions_interest)
			lastSyncsUpdatedAtTime.push(await this.getLastSyncedUpdatedAtTime(ai.table, ai.src, (ai.filterByActname) ? ai.actname : ''))

		lastSyncsUpdatedAtTime.sort((a, b) => a - b)

		// Max sync time for stream reader = 150k blocks => 150k * 0.5s = 20.833h let's say 20 hours max ()
		//if(Date.now() - lastSyncsUpdatedAtTime[0] <= 72000000)
		// Since stream takes time to sync, only start it when there is not much to sync (2 minutes to catchup max)
		if(forceStream || Date.now() - lastSyncsUpdatedAtTime[0] <= 120000) {
			// await 5 seconds to let previous db insert finalize
			if(forceStream)
				await delay(5000)

			this.startStreamReader()
		}
		else
			this.startHistoryReader()
	}

	async startHistoryReader() {
		this.historyReader = new HistoryReader(
			this.actions_interest,
			(datas) => this.onProcessedData(datas),
			(table, src, actname, block_num) => this.setLastSyncedBlock(table, src, actname, block_num),
			(table, src, actname, block_num) => this.setLastSyncedGlobalSequence(table, src, actname, block_num),
			(table, src, actname) => this.getLastSyncedBlock(table, src, actname),
			(table, src, actname) => this.getLastSyncedGlobalSequence(table, src, actname),
			() => this.start(true)
		)
		this.historyReader.connect()
	}

	async startStreamReader() {
		this.streamReader = new StreamReader(
			this.actions_interest,
			(datas) => this.onProcessedData(datas),
			(table, src, actname, block_num) => this.setLastSyncedBlock(table, src, actname, block_num),
			(table, src, actname, block_num) => this.setLastSyncedGlobalSequence(table, src, actname, block_num),
			(table, src, actname) => this.getLastSyncedBlock(table, src, actname),
			(table, src, actname) => this.getLastSyncedGlobalSequence(table, src, actname),
		)
		this.streamReader.connect()
	}
}

export default Reader;