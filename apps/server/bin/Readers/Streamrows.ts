import {
  StateHistoryBlockReader,
  type ShipBlockResponse,
} from "@blocdraig/ship";

import AppConfig from "../../config.js";

import { getInfo } from "./utils.js";
import { leapNameToUint, ShipReaderAdapter } from "./shipAdapter.js";
import logger from "@utils/logger.js";

export default class StreamReaderrows {
  tables_interest: any[];
  eosioReader: any;
  onProcessedData: any;
  info: any;
  shipAdapter: ShipReaderAdapter;
  readerRequest: any;

  constructor(tables_interest, onProcessedData) {
    this.tables_interest = tables_interest;
    this.eosioReader = null;
    this.onProcessedData = onProcessedData;

    this.info = null;
    this.shipAdapter = new ShipReaderAdapter();
    this.readerRequest = null;
  }

  async loadReader() {
    this.info = await getInfo();

    this.eosioReader = new StateHistoryBlockReader(
      `ws://${AppConfig.waxnode_endpoint}:${AppConfig.waxnode_ws_port}`,
      {
        ds_threads: 6,
        logger,
      },
    );
    this.readerRequest = {
      // Reader rows are live-only; start ahead of the observed head to avoid replaying already-indexed deltas.
      start_block_num: this.info.head_block_num + 10,
      end_block_num: 0xffffffff,
      max_messages_in_flight: 500,
      have_positions: [],
      irreversible_only: false,
      fetch_block: true,
      fetch_traces: false,
      fetch_deltas: true,
    };

    return this.eosioReader;
  }

  async processShipBlock(shipBlock: ShipBlockResponse) {
    const rows = await this.shipAdapter.decodeMatchingTableRows(
      shipBlock,
      this.tables_interest,
    );

    for (const row of rows) {
      if (row.present) {
        logger.debug(
          "[" +
            row.block_num +
            "]Received row for " +
            row.code +
            " - " +
            row.table,
        );
      } else {
        logger.debug(
          "[" +
            row.block_num +
            "]Deleted row for " +
            row.code +
            " - " +
            row.table,
        );
      }

      row.scope = leapNameToUint(row.scope);
      this.onProcessedData(row);
    }
  }

  async connect() {
    logger.info("STREAM READER ROWS connecting");
    const reader = await this.loadReader();
    reader.consume(async (shipBlock: ShipBlockResponse) => {
      await this.processShipBlock(shipBlock);
    });
    reader.startProcessing(this.readerRequest);
  }
}
