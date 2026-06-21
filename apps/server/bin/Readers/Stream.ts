import {
  StateHistoryBlockReader,
  type ShipBlockResponse,
} from "@blocdraig/ship";

import SwapOrderRow from "../Models/Rows/SwapOrder.js";
import MarketMatchRow from "../Models/Rows/MarketMatch.js";
import SwapVThreeOrderRow from "../Models/Rows/SwapVThreeOrder.js";
import LiquidityRow from "../Models/Rows/Liquidity.js";
import LogpoolRow from "../Models/Rows/Logpool.js";
import ListingEventRow from "../Models/Rows/ListingEvent.js";
import LimitLogOrderFillRow from "../Models/Rows/LimitLogOrderFill.js";
import LimitLogOrderCloseRow from "../Models/Rows/LimitLogOrderClose.js";

import getRedis from "../Connectors/RedisConnector.js";

import AppConfig from "../../config.js";

import { getInfo } from "./utils.js";
import { ShipReaderAdapter } from "./shipAdapter.js";
import logger from "@utils/logger.js";

export default class StreamReader {
  actions_interest: any[];
  eosioReader: any;
  onProcessedData: any;
  setLastSyncedBlock: any;
  setLastSyncedGlobalSequence: any;
  getLastSyncedBlock: any;
  getLastSyncedGlobalSequence: any;
  initialStartBlock: any;
  lastProcessedBlock: any;
  info: any;
  shipAdapter: ShipReaderAdapter;
  readerRequest: any;

  constructor(
    actions_interest,
    onProcessedData,
    setLastSyncedBlock,
    setLastSyncedGlobalSequence,
    getLastSyncedBlock,
    getLastSyncedGlobalSequence,
  ) {
    this.actions_interest = actions_interest;
    this.eosioReader = null;
    this.onProcessedData = onProcessedData;
    this.setLastSyncedBlock = setLastSyncedBlock;
    this.setLastSyncedGlobalSequence = setLastSyncedGlobalSequence;
    this.getLastSyncedBlock = getLastSyncedBlock;
    this.getLastSyncedGlobalSequence = getLastSyncedGlobalSequence;

    this.initialStartBlock = null;
    this.lastProcessedBlock = 0;
    this.info = null;
    this.shipAdapter = new ShipReaderAdapter();
    this.readerRequest = null;
  }

  async loadReader() {
    const lastSyncsBlock: any[] = [];
    for (const ai of this.actions_interest)
      lastSyncsBlock.push(
        await this.getLastSyncedBlock(
          ai.table,
          ai.src,
          ai.filterByActname ? ai.actname : "",
        ),
      );
    // Take max block num since from history we fetch all and if restart from stream max sync is already processed
    lastSyncsBlock.sort((a, b) => b - a);
    this.info = await getInfo();

    const maxSyncedBlock = lastSyncsBlock[0] ?? 0;
    this.initialStartBlock =
      maxSyncedBlock > 0
        ? maxSyncedBlock
        : (AppConfig.start_block ??
          this.info.last_irreversible_block_num - 10000);

    const start_block_num = Math.max(0, this.initialStartBlock - 2);

    this.eosioReader = new StateHistoryBlockReader(
      `ws://${AppConfig.waxnode_endpoint}:${AppConfig.waxnode_ws_port}`,
      {
        ds_threads: 6,
        logger,
      },
    );
    this.readerRequest = {
      start_block_num,
      end_block_num: 0xffffffff,
      max_messages_in_flight: 500,
      have_positions: [],
      irreversible_only: false,
      fetch_block: true,
      fetch_traces: true,
      fetch_deltas: false,
    };

    return this.eosioReader;
  }

  async toReaderBlock(shipBlock: ShipBlockResponse) {
    const block = shipBlock.block;
    const transactions = shipBlock.traces.map((trace) => ({
      transaction_id: trace[1].id,
      cpu_usage_us: trace[1].cpu_usage_us,
      net_usage_words: trace[1].net_usage_words,
      net_usage: trace[1].net_usage,
    }));
    const actions = await this.shipAdapter.decodeMatchingActions(
      shipBlock,
      this.actions_interest,
    );

    return {
      chain_id: "",
      block_num: shipBlock.this_block.block_num,
      block_id: shipBlock.this_block.block_id,
      timestamp: block.timestamp,
      producer: block.producer,
      actions,
      transactions,
      table_rows: [],
      abis: [],
    };
  }

  async handleShipBlock(shipBlock: ShipBlockResponse) {
    const block = await this.toReaderBlock(shipBlock);
    const redis = await getRedis();
    await redis.set("READER_BLOCK_NUM", "" + block.block_num);

    if (block.block_num >= this.initialStartBlock) {
      if (this.lastProcessedBlock > block.block_num) {
        logger.info(
          "FORK DETECTED fell from block " +
            this.lastProcessedBlock +
            " to " +
            block.block_num,
        );
        await SwapOrderRow.removeHeadAboveBlocknum(block.block_num);
        await MarketMatchRow.removeHeadAboveBlocknum(block.block_num);
        await SwapVThreeOrderRow.removeHeadAboveBlocknum(block.block_num);
        await LiquidityRow.removeHeadAboveBlocknum(block.block_num);
        await ListingEventRow.removeHeadAboveBlocknum(block.block_num);
        await LimitLogOrderFillRow.removeHeadAboveBlocknum(block.block_num);
        await LimitLogOrderCloseRow.removeHeadAboveBlocknum(block.block_num);

        await redis.publish("READER_FORK_DETECTED", "" + block.block_num);
      }
      logger.info(
        "============================================================",
      );
      logger.info(
        "block " + block.block_num + ": " + block.actions.length + " actions",
      );

      if (block.actions.length) {
        const dataRows = await this.processBlock(block);
        this.onProcessedData(dataRows);
      }
    }
  }

  async connect() {
    logger.info("STREAM READER connecting");
    const reader = await this.loadReader();
    logger.info("Consuming SHIP blocks");
    reader.consume(async (shipBlock: ShipBlockResponse) => {
      await this.handleShipBlock(shipBlock);
    });
    reader.startProcessing(this.readerRequest);
  }

  getSourceActionInterest(action: any) {
    const exactMatch = this.actions_interest.find(
      (ai) => ai.account === action.account && ai.actname === action.name,
    );

    if (exactMatch) {
      return exactMatch;
    }

    const wildcardMatch = this.actions_interest.find(
      (ai) => ai.account === action.account && ai.actname === "*",
    );

    return wildcardMatch ? { ...wildcardMatch, actname: action.name } : null;
  }

  async processBlock(block: any) {
    this.lastProcessedBlock = block.block_num;
    // const SwapOrderRow = (await import('../Models/Rows/SwapOrder.js')) as any;
    // const MarketMatchRow = (await import('../Models/Rows/MarketMatch.js')) as any;
    // const SwapVThreeOrderRow = (await import('../Models/Rows/SwapVThreeOrder.js')) as any;

    const dataRows: any = [];

    const mode =
      block.block_num <= this.info.last_irreversible_block_num
        ? "history"
        : "head";

    // Update previous entry to history
    if (mode === "head") {
      const irr_block_num = block.block_num - 180 * 2;
      SwapOrderRow.setHeadToHistoryBeforeBlocknum(irr_block_num);
      MarketMatchRow.setHeadToHistoryBeforeBlocknum(irr_block_num);
      SwapVThreeOrderRow.setHeadToHistoryBeforeBlocknum(irr_block_num);
      LiquidityRow.setHeadToHistoryBeforeBlocknum(irr_block_num);
      ListingEventRow.setHeadToHistoryBeforeBlocknum(irr_block_num);
      LimitLogOrderFillRow.setHeadToHistoryBeforeBlocknum(irr_block_num);
      LimitLogOrderCloseRow.setHeadToHistoryBeforeBlocknum(irr_block_num);
    }

    for (const action of block.actions) {
      const actionInterest: any = this.getSourceActionInterest(action);
      if (actionInterest.classname === "SwapOrderRow") {
        const parsedAction = SwapOrderRow.parseActionData(
          actionInterest.src,
          action.data,
        );
        dataRows.push(
          new SwapOrderRow({
            trx_id: action.transaction_id,
            src: actionInterest.src,
            mode: mode,
            action_ordinal: action.action_ordinal,
            pair_id: parsedAction.pair_id,
            maker: parsedAction.maker,
            quantity_in: parsedAction.quantity_in,
            quantity_out: parsedAction.quantity_out,
            reserveA: parsedAction.reserveA,
            reserveB: parsedAction.reserveB,
            block_num: block.block_num,
            global_sequence: action.global_sequence,
            trx_time: block.timestamp,
          }),
        );
      } else if (actionInterest.classname === "MarketMatchRow") {
        const parsedAction = MarketMatchRow.parseActionData(
          actionInterest.src,
          action.data,
        );
        dataRows.push(
          new MarketMatchRow({
            trx_id: action.transaction_id,
            mode: mode,
            action_ordinal: action.action_ordinal,
            block_num: block.block_num,
            global_sequence: action.global_sequence,
            trx_time: block.timestamp,
            ...parsedAction,
          }),
        );
      } else if (actionInterest.classname === "SwapVThreeOrderRow") {
        const parsedAction = SwapVThreeOrderRow.parseActionData(
          actionInterest.src,
          action.data,
        );
        dataRows.push(
          new SwapVThreeOrderRow({
            trx_id: action.transaction_id,
            src: actionInterest.src,
            mode: mode,
            action_ordinal: action.action_ordinal,
            block_num: block.block_num,
            global_sequence: action.global_sequence,
            trx_time: block.timestamp,
            ...parsedAction,
          }),
        );
      } else if (actionInterest.classname === "LiquidityRow") {
        const parsedAction = LiquidityRow.parseActionData(
          actionInterest.src,
          actionInterest.actname,
          action.data,
        );
        dataRows.push(
          new LiquidityRow({
            trx_id: action.transaction_id,
            src: actionInterest.src,
            actname: actionInterest.actname,
            mode: mode,
            action_ordinal: action.action_ordinal,
            block_num: block.block_num,
            global_sequence: action.global_sequence,
            trx_time: block.timestamp,
            ...parsedAction,
          }),
        );
      } else if (actionInterest.classname === "LogpoolRow") {
        dataRows.push(
          new LogpoolRow({
            trx_id: action.transaction_id,
            src: actionInterest.src,
            mode: mode,
            action_ordinal: action.action_ordinal,
            block_num: block.block_num,
            global_sequence: action.global_sequence,
            trx_time: block.timestamp,
            ...action.data,
          }),
        );
      } else if (actionInterest.classname === "ListingEventRow") {
        const parsedAction = await ListingEventRow.parseActionData(
          actionInterest.src,
          action.data,
        );
        dataRows.push(
          new ListingEventRow({
            trx_id: action.transaction_id,
            src: actionInterest.src,
            mode: mode,
            action: "create",
            block_num: block.block_num,
            global_sequence: action.global_sequence,
            trx_time: block.timestamp,
            ...parsedAction,
          }),
        );
      } else if (actionInterest.classname === "LimitLogOrderFillRow") {
        const parsedAction = LimitLogOrderFillRow.parseActionData(action.data);
        dataRows.push(
          new LimitLogOrderFillRow({
            trx_id: action.transaction_id,
            src: actionInterest.src,
            mode: mode,
            action_ordinal: action.action_ordinal,
            block_num: block.block_num,
            global_sequence: action.global_sequence,
            trx_time: block.timestamp,
            ...parsedAction,
          }),
        );
      } else if (actionInterest.classname === "LimitLogOrderCloseRow") {
        const parsedAction = LimitLogOrderCloseRow.parseActionData(action.data);
        dataRows.push(
          new LimitLogOrderCloseRow({
            trx_id: action.transaction_id,
            src: actionInterest.src,
            mode: mode,
            action_ordinal: action.action_ordinal,
            block_num: block.block_num,
            global_sequence: action.global_sequence,
            trx_time: block.timestamp,
            ...parsedAction,
          }),
        );
      }
    }
    return dataRows;
  }
}
