import getDb from '../../Connectors/DbPGConnector.js'
import Table from './Table.js'

export default class SwapOrdersTable extends Table {
	constructor() {
		super('swapOrders')
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
			    maker character varying(20) COLLATE pg_catalog."default",
			    amount_in numeric(72,8),
			    amount_out numeric(72,8),
			    code_in character varying(50) COLLATE pg_catalog."default",
			    code_out character varying(50) COLLATE pg_catalog."default",
			    precision_in smallint,
			    precision_out smallint,
			    "amount_reserveA" numeric(72,8),
			    "amount_reserveB" numeric(72,8),
			    "code_reserveA" character varying(50) COLLATE pg_catalog."default",
			    "code_reserveB" character varying(50) COLLATE pg_catalog."default",
			    "precision_reserveA" smallint,
			    "precision_reserveB" smallint,
			    created_at_block bigint,
			    global_sequence bigint,
			    updated_at_time bigint
			);

			CREATE INDEX ${this.tableName}_index ON public."${this.tableName}" (global_sequence, created_at_block, updated_at_time, maker, code_in, code_out, src, pair_id);

			ALTER TABLE IF EXISTS public."${this.tableName}"
			ADD CONSTRAINT ${this.tableName}_pkey PRIMARY KEY (trx_id, action_ordinal);

			ALTER TABLE IF EXISTS public."${this.tableName}"
    	OWNER to swaplog;
		`;

		return await this.createQuery(query)
	}
}