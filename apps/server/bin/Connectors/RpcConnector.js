import { APIClient, Serializer } from '@wharfkit/antelope'
import { ContractKit } from '@wharfkit/contract'

import { delay } from '../../utils/utils.js'
import AppConfig from '../../config.js'

class RpcConnector {
	constructor() {
    this.endpoints = []
    this.makeEndpoints()
		this.changeRpc()
    this.selectedRpc = null
	}

  makeEndpoints() {
    for(let i = 0; i < AppConfig.rpc_endpoints.length; ++i)
      this.endpoints.push({
        url: AppConfig.rpc_endpoints[i],
        last_use: 0,
        last_fail: 0,
        fail_cpt: 0,
      })
  }

  updateLastUse(url) {
    const index = this.endpoints.findIndex(e => e.url === url)

    if(index === -1)
      return;

    this.endpoints[index].last_use = Date.now()
  }

  updateLastFail(url) {
    const index = this.endpoints.findIndex(e => e.url === url)

    if(index === -1)
      return;

    this.endpoints[index].last_fail = Date.now()
    ++this.endpoints[index].fail_cpt
  }

  selectRpc() {
    // filter out endpoints with more than 5 fail_cpt or a last_fail less than 10 minutes ago
    const availableEndpoints = this.endpoints.filter(endpoint => {
      return (AppConfig.rpc_hammer || (endpoint.fail_cpt < 5 && (Date.now() - endpoint.last_fail) > 600000));
    });

    // sort the remaining endpoints by last_use
    availableEndpoints.sort((a, b) => a.last_use - b.last_use);

    // return the first endpoint in the sorted list
    return availableEndpoints[0];
  }

  changeRpc() {
    const selectedRpc = this.selectRpc()
    this.selectedRpc = selectedRpc
    this.updateLastUse(selectedRpc.url)
    this.rpc = new APIClient({ url: selectedRpc.url })
  }

  getSelectedRpcUrl() {
    return this.selectedRpc.url
  }
}

const rpcConnector = new RpcConnector()

export const getInfo = async () => {
  rpcConnector.changeRpc()
  const rpcUrl = rpcConnector.getSelectedRpcUrl()
  try {
    const res = await rpcConnector.rpc.v1.chain.get_info()
    return res
  }
  catch(e) {
    rpcConnector.updateLastFail(rpcUrl)
    if(e.code !== undefined) {
      console.log('RPC '+rpcUrl+' failed with code '+e.code+' fail_cpt:'+rpcConnector.selectedRpc.fail_cpt)
    }
    else {
      console.log(e)
      console.log('RPC '+rpcUrl+' failed fail_cpt:'+rpcConnector.selectedRpc.fail_cpt)
    }
    // Add random possibility to multiply delay x2 so if there is many requests error they get delayed between them
    await delay(AppConfig.rpc_delay_error + Math.random() * AppConfig.rpc_delay_error)
    return await getInfo()
  }
}

// Fetch full table using eosjs query and a loop for pages
export const fetchTable = async(contract, scope, table, params = {}, prevRows = []) => {
  rpcConnector.changeRpc()
  const rpcUrl = rpcConnector.getSelectedRpcUrl()
  try {
    const res = await rpcConnector.rpc.v1.chain.get_table_rows({
      code: contract,
      scope,
      table,
      limit: params.limit || 1000,
      lower_bound: params.lower_bound || undefined,
      upper_bound: params.upper_bound || undefined,
      reverse: false,
      show_payer: false,
      json: true,
    })

    let rows = prevRows.concat(res.rows)
    if(res.more) {
      params.lower_bound = res.next_key
      rows = await fetchTable(contract, scope, table, params, rows)
      return rows
    }
    else {
      return rows
    }
  }
  catch(e) {
    rpcConnector.updateLastFail(rpcUrl)
    if(e.code !== undefined) {
      console.log('RPC '+rpcUrl+' failed with code '+e.code+' fail_cpt:'+rpcConnector.selectedRpc.fail_cpt)
    }
    else {
      console.log(e)
      console.log('RPC '+rpcUrl+' failed fail_cpt:'+rpcConnector.selectedRpc.fail_cpt)
    }
    // Add random possibility to multiply delay x2 so if there is many requests error they get delayed between them
    await delay(AppConfig.rpc_delay_error + Math.random() * AppConfig.rpc_delay_error)
    return await fetchTable(contract, scope, table, params, prevRows)
  }
}

/**
 *  Fetch full table using wharfkit method
 * @param contract: contract name
 * @param scope: scope name or same as contract if there is no scope
 * @param table: table name
 * @param objectify: Convert rows back to raw json to get a return like eosjs
**/
export const fetchFullTable = async(contract, scope, table, objectify = false) => {
  rpcConnector.changeRpc()
  const rpcUrl = rpcConnector.getSelectedRpcUrl()
  try {
    // Create Kit
    const contractKit = new ContractKit({ client: rpcConnector.rpc })
    // Load contract
    const contractQ = await contractKit.load(contract)
    // Access table and query for all rows
    const rows = (scope !== contract)
      ? await contractQ.table(table).query({ scope: '' + scope }).all() // force convert scope to str to avoid bug
      : await contractQ.table(table).all();

    if(objectify)
      return Serializer.objectify(rows)

    return rows
  }
  catch(e) {
    rpcConnector.updateLastFail(rpcUrl)
    if(e.code !== undefined) {
      console.log('RPC '+rpcUrl+' contract:'+contract+' scope:'+scope+' table:'+table+' failed with code '+e.code+' fail_cpt:'+rpcConnector.selectedRpc.fail_cpt)
    }
    else {
      console.log(e)
      console.log('RPC '+rpcUrl+' contract:'+contract+' scope:'+scope+' table:'+table+' failed fail_cpt:'+rpcConnector.selectedRpc.fail_cpt)
    }
    // Add random possibility to multiply delay x2 so if there is many requests error they get delayed between them
    await delay(AppConfig.rpc_delay_error + Math.random() * AppConfig.rpc_delay_error)
    return await fetchFullTable(contract, scope, table, objectify)
  }
}
