/**
order_id: '29',
owner: 'etdaw.wam',
fee: 10,
bid_token: { sym: '8,NEFTY', contract: 'token.nefty' },
ask_token: { sym: '8,WAX', contract: 'eosio.token' },
initial_bid: '487247459',
initial_ask: '31415553',
bid: '487247459',
ask: '31415553',
scale_power: 0,
unit_price: '6447555'
**/
import { parseDateFromSmartcontract } from '@utils/utils.js';
import { Asset } from "@wharfkit/antelope";
import getDb from '@connectors/DbPGConnector.js';
import logger from '@utils/logger.js';

export default class LimitLogOrderCloseRow {
  constructor({
    trx_id,
    src,
    mode,
    action_ordinal,
    order_id,
    owner,
    fee,
    bid_token,
    ask_token,
    initial_bid,
    initial_ask,
    bid,
    ask,
    scale_power,
    unit_price,
    block_num,
    global_sequence,
    trx_time
  }) {
    const ask_symbol = Asset.Symbol.from(ask_token.sym);
    const bid_symbol = Asset.Symbol.from(bid_token.sym);

    this.trx_id = trx_id.toLowerCase()
    this.src = src
    this.mode = mode
    this.action_ordinal = action_ordinal
    this.order_id = order_id
    this.ask_contract = ask_token.contract;
    this.ask_code = ask_symbol.name;
    this.ask_precision = ask_symbol.precision;
    this.bid_contract = bid_token.contract;
    this.bid_code = bid_symbol.name;
    this.bid_precision = bid_symbol.precision;
    this.fee = fee;
    this.initial_ask = initial_ask;
    this.initial_bid = initial_bid;
    this.bid = bid;
    this.ask = ask;
    this.owner = owner;
    this.scale_power = scale_power;
    this.unit_price = unit_price;
    this.created_at_block = block_num;
    this.global_sequence = global_sequence;
    this.updated_at_time = parseDateFromSmartcontract(trx_time).getTime();
  }

  static parseActionData(data) {
    return data;
  }

  static async removeHeadAboveBlocknum(block_num) {
    const db = await getDb()

    try {
      await db('limitLogOrderClose').where('created_at_block', '>=', block_num).where(
        'mode', 'head'
      ).del()
    }
    catch(err) {
      logger.error({ err: err }, 'Failed to remove rows above block')
    }
  }

  static async setHeadToHistoryBeforeBlocknum(block_num) {
    const db = await getDb()

    try {
      await db('limitLogOrderClose').where('created_at_block', '<=', block_num).where(
        'mode', 'head'
      ).update({
        'mode': 'history'
      });
    }
    catch(err) {
      logger.error({ err: err }, 'failed to set rows to history')
    }
  }

  static async saveLogs(logOrderCloses) {
    const db = await getDb()
    //const redis = await getRedis()
    let totalUpd = 0
    let totalIns = 0
    for(const logOrderClose of logOrderCloses) {
      const dataToInsert = {
        trx_id: logOrderClose.trx_id,
        src: logOrderClose.src,
        mode: logOrderClose.mode,
        action_ordinal: logOrderClose.action_ordinal,
        order_id: logOrderClose.order_id,
        ask_contract: logOrderClose.ask_contract,
        ask_code: logOrderClose.ask_code,
        ask_precision: logOrderClose.ask_precision,
        bid_contract: logOrderClose.bid_contract,
        bid_code: logOrderClose.bid_code,
        bid_precision: logOrderClose.bid_precision,
        owner: logOrderClose.owner,
        initial_ask: logOrderClose.initial_ask,
        initial_bid: logOrderClose.initial_bid,
        ask: logOrderClose.ask,
        bid: logOrderClose.bid,
        fee: logOrderClose.fee,
        scale_power: logOrderClose.scale_power,
        unit_price: logOrderClose.unit_price,
        created_at_block: logOrderClose.created_at_block,
        global_sequence: logOrderClose.global_sequence,
        updated_at_time: logOrderClose.updated_at_time
      }
      try {
        await db('limitLogOrderClose').insert(dataToInsert)
        ++totalIns
      } catch (e) {
        if (e.code === '23505') {
          if(dataToInsert.mode === 'history') {
            try {
              await db('limitLogOrderClose')
                .where({
                  'trx_id' : dataToInsert.trx_id,
                  'action_ordinal': dataToInsert.action_ordinal
                })
                .update(dataToInsert);
               ++totalUpd
            }
            catch(e) {
              logger.error('HistoryReader updateLimitLogOrderClose error')
              logger.error(e)
            }
          }
        } else {
          logger.error('HistoryReader saveLimitLogOrderClose error')
          logger.error(e)
        }
      }
    }
    logger.info({ totalIns }, 'New LimitLogOrderClose saved')
    logger.info({ totalUpd }, 'LimitLogOrderClose archived')
    logger.info({ data: logOrderCloses.length-totalIns-totalUpd }, 'Already received')
  }

  static async fetchRows({
    owner,
    ask_contract,
    ask_code,
    bid_contract,
    bid_code,
    limit,
    min_global_sequence,
    max_global_sequence,
    orderBySort = 'desc'
  }) {
    if(limit === null || undefined === limit)
      limit = 100;

    limit = Math.min(1000, limit);

    const db = await getDb()
    let query = db.select(
      'trx_id',
      'order_id',
      'ask_contract',
      'ask_code',
      'ask_precision',
      'bid_contract',
      'bid_code',
      'bid_precision',
      'owner',
      'initial_ask',
      'initial_bid',
      'ask',
      'bid',
      'fee',
      'scale_power',
      'unit_price',
      'created_at_block',
      'global_sequence',
      'updated_at_time',
    ).from('limitLogOrderClose');

    if(owner !== undefined && null !== owner)
      query = query.where({'owner': owner});
    if(ask_contract !== undefined && null !== ask_contract)
      query = query.where({'ask_contract': ask_contract});
    if(ask_code !== undefined && null !== ask_code)
      query = query.where({'ask_code': ask_code});
    if(bid_contract !== undefined && null !== bid_contract)
      query = query.where({'bid_contract': bid_contract});
    if(bid_code !== undefined && null !== bid_code)
      query = query.where({'bid_code': bid_code});

    if(min_global_sequence !== undefined && null !== min_global_sequence)
      query = query.where('global_sequence', '>=', min_global_sequence);
    if(max_global_sequence !== undefined && null !== max_global_sequence)
      query = query.where('global_sequence', '<', max_global_sequence);

    query = query.orderBy(
      'global_sequence', orderBySort
    ).limit(limit);

    try {
      return await query;
    } catch (error) {
      // Handle any errors
      logger.error(error);
      //throw error;
    }
  }
}