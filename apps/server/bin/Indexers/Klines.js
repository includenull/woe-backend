import AppConfig from '../../config.js'
import KlinesTable from '../Models/Tables/Klines.js'
import KlinesSyncTable from '../Models/Tables/KlinesSync.js'
import {KlineRows} from '../Models/Rows/Kline.js'
import {KlinesSyncRows} from '../Models/Rows/KlinesSync.js'

import Market from '../Models/Market.js'
import Pool from '../Models/Pool.js'
import PoolV3 from '../Models/PoolV3.js'

import getRedis from '../Connectors/RedisConnector.js'
import KlinesWorker from '../Models/KlinesWorker.js'
import {delay} from '../../utils/utils.js'
import { fetchIndexerApi } from '@class/apiFetcher.js';
import ApiKlines from '@indexers/Api/Klines.js'
import logger from '@utils/logger.js';

class KlinesIndexer {
	constructor() {
		this.pools = []
		this.poolsV3 = []
		this.markets = []
		this.klinesSync = new KlinesSyncRows()
		this.catchupWorkers = new KlinesWorker(
			'klines_catchup_worker_',
			AppConfig.klinesIndexer_worker_catchup
		)

		this.catchupRunning = true
    this.isTerminating = false

    // used to avoid trying to process unexisting pool on every captchup work. add increasing delay before retry
    this.excludedRows = {}

		this.apiKlines = new ApiKlines()
	}

	async start() {
		await this.apiKlines.start()

	  // await KlinesTable.dropAllKlines(); process.exit(); // DEBUG DEV
		await this.init()
		this.listenToFork()
		this.listenUpdatePool()
		this.listenUpdatePoolV3()
		this.listenUpdateMarket()
		this.doCatchupWork()

		logger.info('Set api status to ready')
		this.apiKlines.setReady(true)
	}

  async sigterm() {
    logger.info('STOP NEW CAPTCHING UP WORK....')
    this.isTerminating = true

    while(!this.catchupWorkers.areAllWorkersAvailable()) {
      logger.info('Wait for '+this.catchupWorkers.countAllWorkersOnWork() + '/' + this.catchupWorkers.max_workers+' busy workers');
      await delay(500);
    }

    logger.info('ALL WORKS DONE !! EXITING')
  }

	async waitForApiToBeReady() {
		const api_status = await fetchIndexerApi('/status')

		if(api_status === [] || api_status?.ready === false) {
			logger.info('Indexer api not ready, wait 30 seconds')
			await delay(30000)
			return await this.waitForApiToBeReady()
		}
		
		logger.info('Indexer api is ready')
		return;
	}

	async init() {
		logger.info('Check if indexer api is ready')
		await this.waitForApiToBeReady()

		const klinesSyncTable = new KlinesSyncTable();
		await klinesSyncTable.create() // create the table if not exists 

		await this.klinesSync.load()
		this.pools = await fetchIndexerApi('/pools')
		this.poolsV3 = await fetchIndexerApi('/poolsv3')
		this.markets = await fetchIndexerApi('/markets')
		// Debug
	
		/*this.pools = this.pools.filter(p => (
			p.token0.symbol.ticker === 'NEFTY' && p.token1.symbol.ticker === 'WAX') || (
			p.token1.symbol.ticker === 'NEFTY' && p.token0.symbol.ticker === 'WAX'))
		this.poolsV3 = this.poolsV3.filter(p => (
			p.token0.symbol.ticker === 'NEFTY' && p.token1.symbol.ticker === 'WAX') || (
			p.token1.symbol.ticker === 'NEFTY' && p.token0.symbol.ticker === 'WAX'))
		this.markets = this.markets.filter(m => (
			m.token0.symbol.ticker === 'NEFTY' && m.token1.symbol.ticker === 'WAX') || (
			m.token1.symbol.ticker === 'NEFTY' && m.token0.symbol.ticker === 'WAX')) /**/

		await this.initPools()
		await this.initPoolsV3()
		await this.initMarkets()
	}

	async initPools() {
		for(const pool of this.pools)
			await this.klinesSync.update({src: pool.src, pair_id: pool.pairid, updated_at_time: 0, last_trade_time: 0, last_trade_block: 0})
	}

	async initPoolsV3() {
		for(const poolV3 of this.poolsV3)
			await this.klinesSync.update({src: poolV3.src, pair_id: poolV3.id, updated_at_time: 0, last_trade_time: 0, last_trade_block: 0})
	}

	async initMarkets() {
		for(const market of this.markets)
			await this.klinesSync.update({src: market.src, pair_id: market.id, updated_at_time: 0, last_trade_time: 0, last_trade_block: 0})
	}

	async doCatchupWork() {
		while(true) {
			if(!this.catchupRunning) {
				logger.info('Catchup work is on pause')
				await delay(5000)
				continue;
			}

			const rows = this.klinesSync.findRowsToCatchup()
			logger.info(rows.length+' charts to compute'+((this.isTerminating) ? ' - TERMINATING': ''))

      if(!this.isTerminating) {
  			for(const row of rows) {
  				const work_id = row.src+row.pair_id

          if(this.excludedRows[work_id] !== undefined && this.excludedRows[work_id].excluded_until >= Date.now())
            continue;

  				if(!this.catchupWorkers.hasAvailableWorker()) {
  					logger.info('No available workers')
  					break;
  				}

  				if(this.catchupWorkers.areWorkersOnWork(work_id))
  					continue;

  				const source = await this.findSourceAndCreateTable(row)
  				if(source === null) {
            if(this.excludedRows[work_id] === undefined)
              this.excludedRows[work_id] = {exclude_time_increase: 1000/2}

            this.excludedRows[work_id].exclude_time_increase *= 2
            this.excludedRows[work_id].excluded_until = Date.now() + this.excludedRows[work_id].exclude_time_increase
  				  continue;
          }
          else if(this.excludedRows[work_id] !== undefined) {
            // Source has been found, reset excluded time
            delete this.excludedRows[work_id];
          }

  				// UPDATE SYNC TIME BEFORE so if a trade come in while it's updating it won't block another refresh
  				await this.klinesSync.update({
  					src: row.src,
  					pair_id: row.pair_id,
  					updated_at_time: Date.now(),
  					last_trade_time: row.last_trade_time,
  					last_trade_block: row.last_trade_block,
  				})
  				this.catchupWorkers.runWork(work_id, source)
  			}
      }

			if(!rows.length) {
				logger.info('Nothing to catchup')
				await delay(2000)
			}
			else
				await delay(500);
		}
	}

	async findSourceAndCreateTable(row) {
		const isTableCreated = (row.updated_at_time === 0) ? false : true;
		if(row.src === 'alcormarket') {
			let market = this.markets.filter(m => m.src === row.src && m.id == row.pair_id)
			if(!market.length) {

				const marketFetch = await fetchIndexerApi('/market/'+row.src+'/'+row.pair_id)
				if(!['', undefined].includes(marketFetch)) {
					logger.info('Market '+row.src+' '+row.pair_id+' downloaded from indexer')
					this.markets.push(marketFetch)
					market = [marketFetch]
				}
				else {
					logger.info('Market '+row.src+' '+row.pair_id+' not existing yet')
					return null;
				}
			}
			market = market[0]

			if(!isTableCreated) {
				const table = new KlinesTable(row.src, row.pair_id)
				// create the table if it doesn't exists
				await table.create()
			}

			return market
		}
		else if(row.src === 'alcorv2') {
			let poolV3 = this.poolsV3.filter(m => m.src === row.src && m.id == row.pair_id)
			if(!poolV3.length) {
				const poolv3Fetch = await fetchIndexerApi('/poolv3/'+row.src+'/'+row.pair_id)
				if(!['', undefined].includes(poolv3Fetch)) {
					logger.info('Poolv3 '+row.src+' '+row.pair_id+' downloaded from indexer')
					this.poolsV3.push(poolv3Fetch)
					poolV3 = [poolv3Fetch]
				}
				else {
					logger.info('Poolv3 '+row.src+' '+row.pair_id+' not existing yet')
					return null;
				}
			}
			poolV3 = poolV3[0]

			if(!isTableCreated) {
				const table = new KlinesTable(row.src, row.pair_id)
				// create the table if it doesn't exists
				await table.create()
			}

			return poolV3
		}
		else {
			let pool = this.pools.filter(p => p.src === row.src && p.pairid == row.pair_id)
			if(!pool.length) {

				const poolFetch = await fetchIndexerApi('/pool/'+row.src+'/'+row.pair_id)
				if(!['', undefined].includes(poolFetch)) {
					logger.info('Pool '+row.src+' '+row.pair_id+' downloaded from indexer')			
					this.pools.push(poolFetch)
					pool = [poolFetch]
				}
				else {
					logger.info('Pool '+row.src+' '+row.pair_id+' not existing yet')
					return null;
				}
			}
			pool = pool[0]

			if(!isTableCreated) {
				const table = new KlinesTable(row.src, row.pair_id)
				// create the table if it doesn't exists
				await table.create()
			}

			return pool
		}

		return null
	}

  static async fixUnexistingTable(source, pair_id) {
    // Reset entry from klines sync
    const klinesSync = new KlinesSyncRows();
    await klinesSync.load();
    await klinesSync.update({src: source, pair_id: pair_id, updated_at_time: 0, last_trade_time: 0, last_trade_block: 0}, true);

    const table = new KlinesTable(source, pair_id);
    await table.create();
    logger.info('TABLE CREATED FOR '+source+'@'+pair_id);

    // klinesSync has been reseted and table will be processed again inside catchupWork
  }

	static async doSyncWork(workerId, source) {
		if(source.src === 'alcormarket') {
			await KlinesIndexer.syncMarketWithDatabase(workerId, source)
		}
		else if(source.src === 'alcorv2') {
			await KlinesIndexer.syncPoolV3WithDatabase(workerId, source)
		}
		else {
			await KlinesIndexer.syncPoolWithDatabase(workerId, source)
		}

		logger.info(workerId+': completed!!!')
		// wait for console.log to print before worker is terminated
		await delay(100)

		return true
	}

	static async syncPoolWithDatabase(workerId, pool) {
		logger.info(workerId+': Sync klines for '+pool.src+'_'+pool.pairid)
		const supportedDurations = KlineRows.getSupportedDurations()//.filter(d => d === '1m')

		for(const duration of supportedDurations) {
      try {
  			let klineRows = new KlineRows(pool, duration)
  			await klineRows.syncWithDatabase(workerId)
      }
      catch(e) {
        logger.error('error syncPoolWithDatabase')
        if(e?.code === '42P01') {
          logger.info('Candle table for this pair doesn\'t exist fixing');
          await KlinesIndexer.fixUnexistingTable(pool.src, pool.pairid);
        }
        else {
          logger.error(e);
        }
        logger.info('ABORTING processing candle !!!')
        await delay(1000);
        return true;
      }
		}

		return true
	}

	static async syncMarketWithDatabase(workerId, market) {
		logger.info(workerId+': Sync klines for '+market.src+'_'+market.id)
		const supportedDurations = KlineRows.getSupportedDurations()//.filter(d => d === '1m')

		for(const duration of supportedDurations) {
      try {
  			let klineRows = new KlineRows(market, duration)
  			await klineRows.syncWithDatabase(workerId)
      }
      catch(e) {
        logger.error('error syncMarketWithDatabase')
        if(e?.code === '42P01') {
          logger.info('Candle table for this pair doesn\'t exist fixing');
          await KlinesIndexer.fixUnexistingTable(market.src, market.id);
        }
        else {
          logger.error(e);
        }
        logger.info('ABORTING processing candle !!!')
        await delay(1000);
        return true;
      }
		}

		return true
	}

	static async syncPoolV3WithDatabase(workerId, poolV3) {
		logger.info(workerId+': Sync klines for '+poolV3.src+'_'+poolV3.id)
		const supportedDurations = KlineRows.getSupportedDurations()//.filter(d => d === '1m')

		for(const duration of supportedDurations) {
      try {
  			let klineRows = new KlineRows(poolV3, duration)
  			await klineRows.syncWithDatabase(workerId)
      }
      catch(e) {
        logger.error('error syncPoolV3WithDatabase')
        if(e?.code === '42P01') {
          logger.info('Candle table for this pair doesn\'t exist fixing');
          await KlinesIndexer.fixUnexistingTable(poolV3.src, poolV3.id);
        }
        else {
          logger.error(e);
        }
        logger.info('ABORTING processing candle !!!')
        await delay(1000);
        return true;
      }
		}

		return true
	}

	async listenToFork() {
		const redis = await getRedis('klinesindexer_subscriber');

		try {
			redis.subscribe('READER_FORK_DETECTED', async (block_num) => {
				block_num = Number(block_num)
				logger.info('Fork detected at block_num '+block_num)
				this.catchupRunning = false

				while(!this.catchupWorkers.areAllWorkersAvailable()) {
					logger.info('Not all workers are available, wait 1 more second...')
					await delay(1000)
				}

				// Remove all candles above block num
				const rows = this.klinesSync.findRowsAboveBlocknum(block_num)
				for(const row of rows) {
					logger.info('Remove candles above block_num '+block_num+' for '+row.src+' '+row.pair_id)
					await KlineRows.removeAboveBlocknum(row.src, row.pair_id, block_num)
					await this.klinesSync.update({
						src: row.src,
						pair_id: row.pair_id,
						updated_at_time: row.updated_at_time,
						last_trade_time: row.last_trade_time,
						last_trade_block: block_num - 1
					})
				}

				this.catchupRunning = true
			});
		} catch (err) {
			logger.error({ err: err.code }, `Error consuming messages from queue ${queueName}:`);
		}
	}

	async listenUpdatePool() {
		const redis = await getRedis('klinesindexer_subscriber')

		const queueName = 'swapOrders_insert_klinesIndexer'
		logger.info('Connect to updatePool')
	  try {
	  	redis.subscribe(queueName, async (data) => {
	      data = JSON.parse(data)
				const row = this.klinesSync.findRow(data.src, data.pair_id)

				if(row === null)
					logger.info('listenUpdatePool: pool '+data.src+':'+data.pair_id+' not existing yet. updated_at_time = 0')

				//console.log('listenUpdatePool: update '+data.src+' '+data.pair_id)
				await this.klinesSync.update({
					src: data.src,
					pair_id: data.pair_id,
					updated_at_time: (row !== null) ? row.updated_at_time : 0,
					last_trade_time: Date.now(),
					last_trade_block: data.created_at_block
				})
				
				return true
			})
    } catch (err) {
      logger.error({ err: err.code }, `Error consuming messages from queue ${queueName}:`);
    }
	}

	async listenUpdatePoolV3() {
		const redis = await getRedis('klinesindexer_subscriber')

		const queueName = 'swapVThreeOrders_insert'
		logger.info('Connect to updatePoolV3')
	  try {
	  	redis.subscribe(queueName, async (data) => {
	      data = JSON.parse(data)
				const row = this.klinesSync.findRow(data.src, data.pair_id)

				if(row === null)
					logger.info('listenUpdatePoolV3: pool '+data.src+':'+data.pair_id+' not existing yet. updated_at_time = 0')

				//console.log('listenUpdatePoolV3: update '+data.src+' '+data.pair_id)
				await this.klinesSync.update({
					src: data.src,
					pair_id: data.pair_id,
					updated_at_time: (row !== null) ? row.updated_at_time : 0,
					last_trade_time: Date.now(),
					last_trade_block: data.created_at_block
				})
				
				return true
			})
    } catch (err) {
      logger.error({ err: err.code }, `Error consuming messages from queue ${queueName}:`);
    }
	}

	async listenUpdateMarket() {
		const redis = await getRedis('klinesindexer_subscriber')

		const queueName = 'marketMatches_insert_klinesIndexer'
		logger.info('Connect to updateMarket')
	  try {
			redis.subscribe(queueName, async (data) => {
				data = JSON.parse(data)
				let src = data.src.split('_')
				src = src[0]+'market'
				const row = this.klinesSync.findRow(src, data.market_id)

				if(row === null)
					logger.info('listenUpdateMarket: market '+data.src+':'+data.market_id+' not existing yet. updated_at_time = 0')

				//console.log('listenUpdateMarket: update '+market.src+' '+market.id)
				await this.klinesSync.update({
					src: src,
					pair_id: data.market_id,
					updated_at_time: (row !== null) ? row.updated_at_time : 0,
					last_trade_time: Date.now(),
					last_trade_block: data.created_at_block
				})
				
				return true
			})
    } catch (err) {
      logger.error({ err: err.code }, `Error consuming messages from queue ${queueName}:`);
    }
	}
}

export default KlinesIndexer