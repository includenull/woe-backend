import { RpcInterfaces } from 'eosjs'

import AppConfig from '../../config.js'

export const eosioApi = 'http://'+AppConfig.waxnode_endpoint+':'+AppConfig.waxnode_http_port

export const getInfo = () => fetch(`${eosioApi}/v1/chain/get_info`).then((res: any) => res.json())

export const fetchAbi = (account_name: string) =>
  fetch(`${eosioApi}/v1/chain/get_abi`, {
    method: 'POST',
    body: JSON.stringify({
      account_name,
    }),
  }).then(async (res: any) => {
    const response = await res.json()
    return {
      account_name,
      abi: response.abi as RpcInterfaces.Abi,
    }
  })