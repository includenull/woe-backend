import { fetchTable, fetchFullTable } from '../../Connectors/RpcConnector.js'
import getRedis from '../../Connectors/RedisConnector.js'
import AppConfig from '../../../config.js'
import { delay } from '../../../utils/utils.js'

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
			console.log('Error while listening to queue '+qstream, err)
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
						// console.log(i+1 + ' / ' + scopes.length + ' fetching scope '+scope+' table '+ti.table)
						ret[ti.code][ti.table][scope].rows = await this.fetchCodeTableScope(ti.code, ti.table, scope)
						resolve(true)
					}, i*AppConfig.rpc_delay);
				}));
			}

			const tasksResults = await Promise.allSettled(tasks);
			for (let i = 0; i < tasksResults.length; ++i) {
			  const result = tasksResults[i];

			  if (result.status === 'fulfilled') {
			    // Task was fulfilled, you can access the result using result.value
			    // console.log(`Task ${i + 1} was fulfilled:`, result.value);
			  } else {
			    // Task was rejected, you can access the reason using result.reason
			    console.error(`Task ${i + 1} was rejected:`, result.reason);
			  }
			}
		}

		return ret
	}
}