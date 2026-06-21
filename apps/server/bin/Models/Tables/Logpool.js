import getDb from '../../Connectors/DbPGConnector.js'
import Table from './Table.js'

export default class LogpoolTable extends Table {
	constructor() {
		super('logpool')
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
			    	fee integer,
			    	"feeProtocol" integer,
						"sqrtPriceX64" numeric,
				    tick bigint,
				    "tickSpacing" bigint,
				    "codeA" character varying(50) COLLATE pg_catalog."default",
				    "codeB" character varying(50) COLLATE pg_catalog."default",
				    "precisionA" smallint,
				    "precisionB" smallint,
				    "contractA" character varying(12) COLLATE pg_catalog."default",
				    "contractB" character varying(12) COLLATE pg_catalog."default",
				    created_at_block bigint,
				    global_sequence bigint,
				    updated_at_time bigint
				);

				CREATE INDEX ${this.tableName}_index ON public."${this.tableName}" ("global_sequence", "created_at_block", "updated_at_time", "src", "pair_id", "codeA", "codeB");

				ALTER TABLE IF EXISTS public."${this.tableName}"
				ADD CONSTRAINT ${this.tableName}_pkey PRIMARY KEY (trx_id, action_ordinal);

				ALTER TABLE IF EXISTS public."${this.tableName}"
				    OWNER to swaplog;
		`;


		return await this.createQuery(query)
	}
}