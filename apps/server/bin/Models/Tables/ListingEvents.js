import getDb from '@connectors/DbPGConnector.js'
import Table from './Table.js'

export default class ListingEventsTable extends Table {
	constructor() {
		super('listingEvents')
	}

	async create() {
		const query = `
		    CREATE TABLE IF NOT EXISTS public."${this.tableName}"
				(
					trx_id character varying(64) COLLATE pg_catalog."default",
					mode character varying(20) COLLATE pg_catalog."default",
					listing_type character varying(50) COLLATE pg_catalog."default",
					src character varying(50) COLLATE pg_catalog."default",
					pair_id character varying(100) COLLATE pg_catalog."default",
					"fee" integer,
					action character varying(50) COLLATE pg_catalog."default",
					creator character varying(20) COLLATE pg_catalog."default",
					"contractA" character varying(50) COLLATE pg_catalog."default",
					"contractB" character varying(50) COLLATE pg_catalog."default",
					"codeA" character varying(50) COLLATE pg_catalog."default",
					"codeB" character varying(50) COLLATE pg_catalog."default",
			    created_at_block bigint,
			    global_sequence bigint,
			    updated_at_time bigint
				);

				CREATE INDEX ${this.tableName}_index ON public."${this.tableName}" (global_sequence, created_at_block, updated_at_time, src, creator, listing_type);

				ALTER TABLE IF EXISTS public."${this.tableName}"
				ADD CONSTRAINT ${this.tableName}_pkey PRIMARY KEY (global_sequence);

				ALTER TABLE IF EXISTS public."${this.tableName}"
	    	OWNER to swaplog;

				ALTER TABLE IF EXISTS public."${this.tableName}"
				    OWNER to swaplog;
		`;

		return await this.createQuery(query)
	}
}