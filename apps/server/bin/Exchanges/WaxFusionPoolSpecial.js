import { fetchFullTable } from '@connectors/RpcConnector.js'
import PoolSpecial from '@models/PoolSpecial.js'
import Token from '@models/Token.js'

import { Asset } from "@wharfkit/antelope"
import { precise } from '@utils/utils.js'

export default class WaxFusionPoolSpecial {
  static makeSwapActions({ bid, tokenA, tokenB, pool, receiver }) {
    const asset_liquified_swax = Asset.from(pool.data.liquified_swax);
    const asset_swax_currently_backing_lswax = Asset.from(pool.data.swax_currently_backing_lswax);
    const rate = Number(asset_liquified_swax.quantity) / Number(asset_swax_currently_backing_lswax.quantity);
    // Staking WAX to LSWAX
    if(tokenA.symbol.ticker === 'WAX' && tokenA.contract === 'eosio.token') {
      return [{
        action_account: 'dapp.fusion',
        action_name: 'stake',
        action_data: {
          user: receiver 
        }    
      },{
        action_account: 'eosio.token',
        action_name: 'transfer',
        action_data: {
          from: receiver,
          to: 'dapp.fusion',
          quantity: precise(bid, tokenA.symbol.precision)+' '+tokenA.symbol.ticker,
          memo: 'stake'
        }
      }, {
        action_account: 'dapp.fusion',
        action_name: 'liquifyexact',
        action_data: {
          user: receiver,
          minimum_output: precise(bid*rate, tokenB.symbol.precision)+' '+tokenB.symbol.ticker,
          quantity: precise(bid, tokenA.symbol.precision)+' SWAX',
        }
      }];
    }
    else {
      // unstaking LSWAX to WAX
      // Requested quantities are without fee so we use rate from pool directly

      return [{
        action_account: 'dapp.fusion',
        action_name: 'stake',
        action_data: {
          user: receiver 
        }    
      },{
        action_account: 'token.fusion',
        action_name: 'transfer',
        action_data: {
          from: receiver,
          memo: '|unliquify_exact|'+precise((bid/rate) * Math.pow(10, tokenB.symbol.precision), 0)+'|',
          quantity: precise(bid, tokenA.symbol.precision)+' '+tokenA.symbol.ticker,
          to: 'dapp.fusion'
        }    
      },{
        action_account: 'dapp.fusion',
        action_name: 'instaredeem',
        action_data: {
          user: receiver,
          swax_to_redeem: precise(bid/rate, tokenB.symbol.precision)+' SWAX'
        }    
      },];
    }
  }

  static async fetchGlobal() {
    const row = await fetchFullTable('dapp.fusion', 'dapp.fusion', 'global', true);

    const asset_wax_available_for_rentals = Asset.from(row[0].wax_available_for_rentals);
    const asset_liquified_swax = Asset.from(row[0].liquified_swax);

    return new PoolSpecial({
      id: 'dapp.fusion',
      src: 'waxfusion',
      fee: 0,
      token0: new Token({quantity: String(asset_wax_available_for_rentals), contract: 'eosio.token'}),
      token1: new Token({quantity: String(asset_liquified_swax), contract: 'token.fusion'}),
      type: 'liquid_staking',
      data: row[0]
    })
  }
}