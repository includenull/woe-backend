import WaxFusionPoolSpecial from '@exchanges/WaxFusionPoolSpecial.js';
import PoolSpecial from '@models/PoolSpecial.js';

import { Asset } from "@wharfkit/antelope"
import Token from '@models/Token.js'

export default class PoolSpecialMap {
  constructor() {
    this.map = {}
  }

  async init() {
    const pool = await WaxFusionPoolSpecial.fetchGlobal()
    this.savePool(pool)
  }

  savePool(pool) {
    this.map[PoolSpecial.getHashStatic(pool)] = pool
  }

  getPool(src, id) {
    return this.getPoolByHash(src+'_'+id)
  }

  getPoolByHash(poolHash) {
    if(this.map[poolHash] !== undefined)
      return this.map[poolHash]

    return null
  }

  updatePool(pool) {
    this.map[PoolSpecial.getHashStatic(pool)] = pool
  }

  updatePoolWithRow(row) {
    const pool = this.getPool(row.src, row.code);
    pool.data = row.value;

    if(row.src === 'waxfusion') {
      const asset_wax_available_for_rentals = Asset.from(pool.data.wax_available_for_rentals);
      const asset_liquified_swax = Asset.from(pool.data.liquified_swax);

      pool.token0 = new Token({quantity: String(asset_wax_available_for_rentals), contract: 'eosio.token'});
      pool.token1 = new Token({quantity: String(asset_liquified_swax), contract: 'token.fusion'});
    }

    this.updatePool(pool)
  }

  getAllPools() {
    return Object.values(this.map)
  }
}