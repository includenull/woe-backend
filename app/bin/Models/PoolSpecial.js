import { Asset } from "@wharfkit/antelope"

export default class PoolSpecial {
  constructor({
    id,
    src,
    fee,
    token0,
    token1,
    type,
    data
  }) {
    this.id = id;
    this.src = src;
    this.fee = fee;
    this.token0 = token0;
    this.token1 = token1;
    this.type = type;
    this.data = data;

    this.computeFee()
  }

  computeFee() {
    if(this.src === 'waxfusion' && this.type === 'liquid_staking') {
      if(this.token1.contract === 'eosio.token')
        this.fee = Number(this.data.protocol_fee_1e6) / 10000
      else
        this.fee = 0
    }
  }

  static reversePool(pool) {
    return new PoolSpecial({
      id: pool.id,
      src: pool.src,
      fee: pool.fee,
      token0: pool.token1,
      token1: pool.token0,
      type: pool.type,
      data: pool.data
    })
  }

  getFeeMult() {
    return PoolSpecial.getFeeMult(this)
  }

  static getFeeMultStatic(pool) {
    return 1 - pool.fee / 10000
  }

  getHash() {
    return PoolSpecial.getHashStatic(this)
  }

  static getHashStatic(pool) {
    return pool.src+'_'+pool.id
  }

  getPrice() {
    return PoolSpecial.getPriceStatic(this)
  }

  static getPriceStatic(pool) {
    if(pool.src === 'waxfusion' && pool.type === 'liquid_staking') {
      const asset_liquified_swax = Asset.from(pool.data.liquified_swax);
      const asset_swax_currently_backing_lswax = Asset.from(pool.data.swax_currently_backing_lswax);
      return Number(asset_liquified_swax.quantity) / Number(asset_swax_currently_backing_lswax.quantity);
    }
  }

  getAmountOut(bid) {
    return PoolSpecial.getAmountOutStatic(this, bid)
  }

  static getAmountOutStatic(pool, bid) {
    if(pool.src === 'waxfusion' && pool.type === 'liquid_staking') {
      const asset_liquified_swax = Asset.from(pool.data.liquified_swax);
      const asset_swax_currently_backing_lswax = Asset.from(pool.data.swax_currently_backing_lswax);
      const rate = Number(asset_liquified_swax.quantity) / Number(asset_swax_currently_backing_lswax.quantity);
      const asset_minimum_unliquify_amount = Asset.from(pool.data.minimum_unliquify_amount);
      const minimum_unliquify_amount = Number(asset_minimum_unliquify_amount.quantity);
      const asset_minimum_stake_amount = Asset.from(pool.data.minimum_stake_amount);
      const minimum_stake_amount = Number(asset_minimum_stake_amount.quantity);
      const asset_wax_available_for_rentals = Asset.from(pool.data.wax_available_for_rentals);
      const wax_available_for_rentals = Number(asset_wax_available_for_rentals.quantity); 
      
      if(pool.token1.contract === 'eosio.token') { // from lswax to wax 
        return Math.min(
          wax_available_for_rentals,
          (minimum_unliquify_amount <= bid) ? (bid / rate) * PoolSpecial.getFeeMultStatic(pool) : 0
        );
      }
      else // from wax to lswax
        return (minimum_stake_amount <= bid) ? rate * bid * PoolSpecial.getFeeMultStatic(pool) : 0;
    }

    return 0;
  }
}