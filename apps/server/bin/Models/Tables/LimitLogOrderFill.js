import getDb from '@connectors/DbPGConnector.js'
import Table from '@models/Tables/Table.js'

export default class LimitLogOrderFillTable extends Table {
  constructor() {
    super('limitLogOrderFill')
  }

  async create() {
    const query = `
        CREATE TABLE IF NOT EXISTS public."${this.tableName}"
        (
          "trx_id" character varying(64) COLLATE pg_catalog."default",
          "src" character varying(50) COLLATE pg_catalog."default",
          "mode" character varying(20) COLLATE pg_catalog."default",
          "action_ordinal" integer,

          "order_id" BIGINT,
          "ask_contract" character varying(13) COLLATE pg_catalog."default",
          "ask_code" character varying(50) COLLATE pg_catalog."default",
          "ask_precision" SMALLINT,
          "bid_contract" character varying(13) COLLATE pg_catalog."default",
          "bid_code" character varying(50) COLLATE pg_catalog."default",
          "bid_precision" SMALLINT,
          "fee_maker" INTEGER,
          "fee_taker" INTEGER,
          "initial_ask" BIGINT,
          "initial_bid" BIGINT,
          "maker" character varying(13) COLLATE pg_catalog."default",
          "taker" character varying(13) COLLATE pg_catalog."default",
          "prev_ask" BIGINT,
          "prev_bid" BIGINT,
          "new_ask" BIGINT,
          "new_bid" BIGINT,
          "scale_power" SMALLINT,
          "unit_price" NUMERIC(39,0),

          "created_at_block" BIGINT,
          "global_sequence" BIGINT,
          "updated_at_time" BIGINT
        );

        CREATE INDEX ${this.tableName}_index ON public."${this.tableName}" (
          "global_sequence",
          "created_at_block",
          "updated_at_time",
          "taker",
          "maker",
          "ask_contract",
          "ask_code",
          "bid_contract",
          "bid_code"
        );

        ALTER TABLE IF EXISTS public."${this.tableName}"
        ADD CONSTRAINT ${this.tableName}_pkey PRIMARY KEY (trx_id, action_ordinal);

        ALTER TABLE IF EXISTS public."${this.tableName}"
            OWNER to swaplog;
    `;

    return await this.createQuery(query)
  }
}