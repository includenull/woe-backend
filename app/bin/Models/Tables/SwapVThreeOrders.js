import getDb from '../../Connectors/DbPGConnector.js'
import Table from './Table.js'

export default class SwapVThreeOrdersTable extends Table {
	constructor() {
		super('swapVThreeOrders')
	}

	async create() {
		const query = `
			CREATE TABLE IF NOT EXISTS public."${this.tableName}"
			(
			    trx_id character varying(64) COLLATE pg_catalog."default",
			    src character varying(50) COLLATE pg_catalog."default",
			    mode character varying(20) COLLATE pg_catalog."default",
			    action_ordinal integer,
			    pair_id character varying(100) COLLATE pg_catalog."default",
			    sender character varying(20) COLLATE pg_catalog."default",
			    recipient character varying(20) COLLATE pg_catalog."default",
			    "sqrtPriceX64" numeric,
			    liquidity numeric,
			    tick bigint,
			    "amountA" numeric(72,8),
			    "amountB" numeric(72,8),
			    "negativeA" boolean,
			    "negativeB" boolean,
			    "codeA" character varying(50) COLLATE pg_catalog."default",
			    "codeB" character varying(50) COLLATE pg_catalog."default",
			    "precisionA" smallint,
			    "precisionB" smallint,
			    "reserveA" numeric(72,8),
			    "reserveB" numeric(72,8),
			    created_at_block bigint,
			    global_sequence bigint,
			    updated_at_time bigint
			);

			CREATE INDEX ${this.tableName}_index ON public."${this.tableName}" (global_sequence, created_at_block, updated_at_time, sender, recipient, "codeA", "codeB", src, pair_id);

			ALTER TABLE IF EXISTS public."${this.tableName}"
			ADD CONSTRAINT ${this.tableName}_pkey PRIMARY KEY (trx_id, action_ordinal);

			ALTER TABLE IF EXISTS public."${this.tableName}"
	    OWNER to swaplog;
		`;

		return await this.createQuery(query)
	}
}