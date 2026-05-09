import getDb from '../../Connectors/DbPGConnector.js'
import Table from './Table.js'

export default class KlinesSyncTable extends Table {
	constructor() {
		super('klinesSync')
	}

	async create() {
		const query = `
			CREATE TABLE IF NOT EXISTS public."${this.tableName}"
			(
			    src character varying(50) COLLATE pg_catalog."default",
			    pair_id character varying(100) COLLATE pg_catalog."default",
			    "updated_at_time" bigint,
			    "last_trade_time" bigint,
			    "last_trade_block" bigint
			);

			CREATE INDEX ${this.tableName}_index ON public."${this.tableName}" ("updated_at_time", "last_trade_time", "last_trade_block");

			ALTER TABLE IF EXISTS public."${this.tableName}"
			ADD CONSTRAINT ${this.tableName}_pkey PRIMARY KEY (src, pair_id);

			ALTER TABLE IF EXISTS public."${this.tableName}"
			    OWNER to swaplog;
		`;

		return await this.createQuery(query)
	}
}