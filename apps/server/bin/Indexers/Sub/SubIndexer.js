import { fetchTable, fetchFullTable } from '../../Connectors/RpcConnector.js'
import getRedis from '../../Connectors/RedisConnector.js'
import AppConfig from '../../../config.js'
import { delay } from '../../../utils/utils.js'
import logger from '@utils/logger.js';

export default class SubIndexer {
	constructor(getRpcIndexer, updateSync) {
		this.getRpcIndexer = getRpcIndexer
		this.updateSync = updateSync
		this.tables_interest = []
	}

	addTableInterest(ti) {
		this.tables_interest.push(ti)
	}

	getTableInterestForTable(table) {
		return this.tables_interest.find(ti => ti.table === table)
	}

	async readQstream(qstream, callback) {
		const redis = await getRedis('subindexer_consumer')
		try {	
			redis.subscribe(qstream, (jsonData) => {
				const row = JSON.parse(jsonData)
				callback(row)
			})
		} catch(err) {
			logger.error({ err: err }, 'Error while listening to queue '+qstream)
		}
	}

	async fetchCodeTableScope(code, table, scope) {
		this.updateSync(code, table, scope, true, false)
		return await fetchFullTable(code, (scope !== '*') ? scope : code, table, true)
		// return await fetchTable(code, scope, table)
	}

	async scopesFetchRows(scopes = ['*']) {
		let ret = {}

		for(const ti of this.tables_interest) {
			logger.info('fetch '+ti.code+' '+ti.table+' for '+scopes.length+' scopes')
			if(ret[ti.code] === undefined)
				ret[ti.code] = {}

			if(ret[ti.code][ti.table] === undefined)
				ret[ti.code][ti.table] = {}

			const tasks = []
			for(let i = 0; i < scopes.length; ++i) {
				tasks.push(new Promise(async (resolve) => {
					// Delay each first requests to avoid hammering the node
					setTimeout(async () => {
						const scope = scopes[i];
						ret[ti.code][ti.table][scope] = {}
						ret[ti.code][ti.table][scope].rows = await this.fetchCodeTableScope(ti.code, ti.table, scope)
						if((i + 1) % 50 === 0 || i + 1 === scopes.length)
							logger.info((i + 1)+' / '+scopes.length+' fetched '+ti.code+' '+ti.table)
						resolve(true)
					}, i*AppConfig.rpc_delay);
				}));
			}

			const tasksResults = await Promise.allSettled(tasks);
			for (let i = 0; i < tasksResults.length; ++i) {
			  const result = tasksResults[i];

			  if (result.status === 'fulfilled') {
			    // Task was fulfilled, you can access the result using result.value
			  } else {
			    // Task was rejected, you can access the reason using result.reason
			    logger.error({ err: result.reason }, `Task ${i + 1} was rejected:`);
			  }
			}
		}

		return ret
	}
}
