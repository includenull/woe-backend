/**
order_id: '30',
maker: 'etdaw.wam',
taker: 'etdaw.wam',
fee_maker: 10,
fee_taker: 10,
bid_token: { sym: '8,WAX', contract: 'eosio.token' },
ask_token: { sym: '8,NEFTY', contract: 'token.nefty' },
initial_bid: '26695017',
initial_ask: '426243896',
prev_bid: '26695017',
prev_ask: '426243896',
new_bid: '14169316',
new_ask: '226243896',
scale_power: 0,
unit_price: '1596717080'
**/
import { parseDateFromSmartcontract } from '@utils/utils.js';
import { Asset } from "@wharfkit/antelope";
import getDb from '@connectors/DbPGConnector.js';
import LimitLogOrderCloseRow from '@models/Rows/LimitLogOrderClose.js';
import logger from '@utils/logger.js';

export default class LimitLogOrderFillRow {
  constructor({
    trx_id,
    src,
    mode,
    action_ordinal,
    order_id,
    maker,
    taker,
    fee_maker,
    fee_taker,
    bid_token,
    ask_token,
    initial_bid,
    initial_ask,
    prev_bid,
    prev_ask,
    new_bid,
    new_ask,
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
    this.fee_maker = fee_maker;
    this.fee_taker = fee_taker;
    this.initial_ask = initial_ask;
    this.initial_bid = initial_bid;
    this.maker = maker;
    this.taker = taker;
    this.prev_ask = prev_ask;
    this.prev_bid = prev_bid;
    this.new_ask = new_ask;
    this.new_bid = new_bid;
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
      await db('limitLogOrderFill').where('created_at_block', '>=', block_num).where(
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
      await db('limitLogOrderFill').where('created_at_block', '<=', block_num).where(
        'mode', 'head'
      ).update({
        'mode': 'history'
      });
    }
    catch(err) {
      logger.error({ err: err }, 'failed to set rows to history')
    }
  }

  static async saveLogs(logOrderFills) {
    const db = await getDb()
    //const redis = await getRedis()
    let totalUpd = 0
    let totalIns = 0
    const logOrderFullFill = []
    for(const logOrderFill of logOrderFills) {
      const dataToInsert = {
        trx_id: logOrderFill.trx_id,
        src: logOrderFill.src,
        mode: logOrderFill.mode,
        action_ordinal: logOrderFill.action_ordinal,
        order_id: logOrderFill.order_id,
        ask_contract: logOrderFill.ask_contract,
        ask_code: logOrderFill.ask_code,
        ask_precision: logOrderFill.ask_precision,
        bid_contract: logOrderFill.bid_contract,
        bid_code: logOrderFill.bid_code,
        bid_precision: logOrderFill.bid_precision,
        fee_maker: logOrderFill.fee_maker,
        fee_taker: logOrderFill.fee_taker,
        initial_ask: logOrderFill.initial_ask,
        initial_bid: logOrderFill.initial_bid,
        maker: logOrderFill.maker,
        taker: logOrderFill.taker,
        prev_ask: logOrderFill.prev_ask,
        prev_bid: logOrderFill.prev_bid,
        new_ask: logOrderFill.new_ask,
        new_bid: logOrderFill.new_bid,
        scale_power: logOrderFill.scale_power,
        unit_price: logOrderFill.unit_price,
        created_at_block: logOrderFill.created_at_block,
        global_sequence: logOrderFill.global_sequence,
        updated_at_time: logOrderFill.updated_at_time
      }

      if(logOrderFill.new_ask == 0 || logOrderFill.new_bid == 0) {
        logOrderFullFill.push({
          trx_id: logOrderFill.trx_id,
          src: logOrderFill.src,
          mode: logOrderFill.mode,
          action_ordinal: logOrderFill.action_ordinal,
          order_id: logOrderFill.order_id,
          ask_contract: logOrderFill.ask_contract,
          ask_code: logOrderFill.ask_code,
          ask_precision: logOrderFill.ask_precision,
          bid_contract: logOrderFill.bid_contract,
          bid_code: logOrderFill.bid_code,
          bid_precision: logOrderFill.bid_precision,
          owner: logOrderFill.maker,
          initial_ask: logOrderFill.initial_ask,
          initial_bid: logOrderFill.initial_bid,
          ask: logOrderFill.new_ask,
          bid: logOrderFill.new_bid,
          fee: logOrderFill.fee_maker,
          scale_power: logOrderFill.scale_power,
          unit_price: logOrderFill.unit_price,
          created_at_block: logOrderFill.created_at_block,
          global_sequence: logOrderFill.global_sequence,
          updated_at_time: logOrderFill.updated_at_time
        });
      }

      try {
        await db('limitLogOrderFill').insert(dataToInsert)
        ++totalIns
      } catch (e) {
        if (e.code === '23505') {
          if(dataToInsert.mode === 'history') {
            try {
              await db('limitLogOrderFill')
                .where({
                  'trx_id' : dataToInsert.trx_id,
                  'action_ordinal': dataToInsert.action_ordinal
                })
                .update(dataToInsert);
               ++totalUpd
            }
            catch(e) {
              logger.error('HistoryReader updateLimitLogOrderFill error')
              logger.error(e)
            }
          }
        } else {
          logger.error('HistoryReader saveLimitLogOrderFill error')
          logger.error(e)
        }
      }
    }
    logger.info({ totalIns }, 'New LimitLogOrderFill saved')
    logger.info({ totalUpd }, 'LimitLogOrderFill archived')
    logger.info({ data: logOrderFills.length-totalIns-totalUpd }, 'Already received')

    await LimitLogOrderCloseRow.saveLogs(logOrderFullFill);
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
      'fee_maker',
      'fee_taker',
      'initial_ask',
      'initial_bid',
      'maker',
      'taker',
      'prev_ask',
      'prev_bid',
      'new_ask',
      'new_bid',
      'scale_power',
      'unit_price',
      'created_at_block',
      'global_sequence',
      'updated_at_time',
    ).from('limitLogOrderFill');

    if(owner !== undefined && null !== owner)
      query = query.where(function () {
        this.where('maker', owner).orWhere('taker', owner);
      });
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