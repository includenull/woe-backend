import getRedis from './Connectors/RedisConnector.js'
import RpcIndexer from './Indexers/Rpc.js'
import ApiIndexer from '@indexers/Api/Indexer.js'
import RowsIndexer from './Indexers/Rows.js'

import Token from './Models/Token.js'
import DefiboxPool from './Exchanges/DefiboxPool.js'

import AppConfig from '../config.js';
import logger from '@utils/logger.js';

class Indexer {
	constructor() {
		this.rpcIndexer = new RpcIndexer(() => this.rowsIndexer);
		this.rowsIndexer = new RowsIndexer(() => this.rpcIndexer);
		this.apiIndexer = new ApiIndexer(() => this.rpcIndexer, () => this.rowsIndexer);
	}

	async start() {
		await this.init()
		this.connect()
	}

	async init() {
  	logger.info('Start internal api')
  	await this.apiIndexer.start()
		
    logger.info('Init pools special')
    await this.rpcIndexer.initPoolsSpecial()
		logger.info('Init pools')
  	await this.rpcIndexer.initPools()
  	logger.info('Init markets')
  	await this.rpcIndexer.initMarkets()
  	logger.info('Init pools v3')
  	await this.rpcIndexer.initPoolsV3()
  	logger.info('Init tokens')
  	await this.rpcIndexer.initTokens()

  	this.rpcIndexer.startRefreshTokens()

  	logger.info('Sub to orderbooks and pools v3 positions')
  	await this.rowsIndexer.initRows(AppConfig.tables_interest.filter(ti => ti.rowsSubIndexer !== undefined))

  	logger.info('Set internal api status to ready')
  	this.apiIndexer.setReady(true)
	}

	async connect() {
		const redis = await getRedis('indexer_subscriber')
		const redis_setter = await getRedis('indexer_setter')

		const swapQueueName = 'swapOrders_rows_indexer'
		try {	
			redis.subscribe(swapQueueName, async (jsonData) => {
				const row = JSON.parse(jsonData)
				let rowId = row.value.id
				if(row.src === 'neftyblocks')
					rowId = row.value.code

				const pool = this.rpcIndexer.poolMap.getPool(row.src, rowId)

				if(pool === null){
					this.rpcIndexer.poolMap.insertPoolWithRow(row)
					redis_setter.set('lastAddedOrDeletedSwapSource', Date.now(), { NX: false });
				}
				else if(row.present){
					// If a pool is disabled/enabled it's the same as removing / adding for routing
					if(row.value.active !== undefined && row.value.active !== pool.active)
						redis_setter.set('lastAddedOrDeletedSwapSource', Date.now(), { NX: false });

					this.rpcIndexer.poolMap.updatePoolWithRow(pool, row)
				}
				else{
					this.rpcIndexer.poolMap.deletePoolWithRow(row)
					redis_setter.set('lastAddedOrDeletedSwapSource', Date.now(), { NX: false });
				}
			})
		} catch(err) {
			logger.error({ err: err }, 'Error while listening to queue '+swapQueueName)
		}

		const poolV3QueueName = 'swapVThreeOrders_rows_indexer'
		try {
    	// This stream is delta of market table, only use to add/edit/remove markets
			redis.subscribe(poolV3QueueName, async (jsonData) => {
				const row = JSON.parse(jsonData)
				const pool = this.rpcIndexer.poolV3Map.getPool('alcorv2', row.value.id)

				if(pool === null) {
					this.rpcIndexer.poolV3Map.insertPoolWithRow(row)
					redis_setter.set('lastAddedOrDeletedSwapSource', Date.now(), { NX: false });
				}
				else if(row.present) {
					// If a pool is disabled/enabled it's the same as removing / adding for routing
					if(row.value.active !== undefined && row.value.active !== pool.active)
						redis_setter.set('lastAddedOrDeletedSwapSource', Date.now(), { NX: false });

					this.rpcIndexer.poolV3Map.updatePoolWithRow(row)
				}
				else {
					this.rpcIndexer.poolV3Map.deletePoolWithRow(row)
					redis_setter.set('lastAddedOrDeletedSwapSource', Date.now(), { NX: false });
				}
			})
    } catch(err) {
    	logger.error({ err: err }, 'Error while listening to queue '+poolV3QueueName)
    }

    const marketQueueName = 'marketMatches_rows_indexer'
    try {
    	// This stream is delta of market table, only use to add/edit/remove markets
			redis.subscribe(marketQueueName, (jsonData) => {
				const row = JSON.parse(jsonData)
				const market = this.rpcIndexer.marketMap.getMarket('alcormarket', row.value.market_id)

				if(market === null)
					this.rpcIndexer.marketMap.insertMarketWithRow(row)
				else if(row.present)
					this.rpcIndexer.marketMap.updateMarketWithRow(market, row)
				else
					this.rpcIndexer.marketMap.deleteMarketWithRow(row)
			})
    } catch(err) {
    	logger.error({ err: err }, 'Error while listening to queue '+marketQueueName)
    }

    const poolsSpecialQueueName = 'poolsSpecial_rows_indexer';
    try {
      redis.subscribe(poolsSpecialQueueName, (jsonData) => {
        const row = JSON.parse(jsonData);

        if(row.src === 'waxfusion') {
          this.rpcIndexer.poolSpecialMap.updatePoolWithRow(row)
        }
      });
    } catch(err) {
      logger.error({ err: err }, 'Error while listening to queue '+poolsSpecialQueueName)
    }

    const marketMatchesQueueName = 'marketMatches_insert_indexer'
    try {
    	// This stream is used to update lastSide & lastPrice of markets, whenever there is a match
			redis.subscribe(marketMatchesQueueName, (jsonData) => {
				const data = JSON.parse(jsonData)
				const market = this.rpcIndexer.marketMap.getMarket('alcormarket', data.market_id)

				if(market === null)
					return;

				this.rpcIndexer.marketMap.updateMarketWithMatch(market, data)
			})
    } catch(err) {
    	logger.error({ err: err }, 'Error while listening to queue '+marketMatchesQueueName)
    }
	}
}

export default Indexer