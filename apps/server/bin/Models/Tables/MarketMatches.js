import getDb from '../../Connectors/DbPGConnector.js'
import Table from './Table.js'

export default class MarketMatchesTable extends Table {
	constructor() {
		super('marketMatches')
	}

	async create() {
		const query = `
		    CREATE TABLE IF NOT EXISTS public."${this.tableName}"
				(
				    trx_id character varying(64) COLLATE pg_catalog."default",
				    src character varying(50) COLLATE pg_catalog."default",
				    mode character varying(20) COLLATE pg_catalog."default",
				    action_ordinal integer,
				    order_id integer,
				    asker character varying(12) COLLATE pg_catalog."default",
				    bidder character varying(12) COLLATE pg_catalog."default",
				    unit_price bigint,
				    amount_ask numeric(72,8),
				    code_ask character varying(50) COLLATE pg_catalog."default",
				    precision_ask integer,
				    amount_bid numeric(72,8),
				    code_bid character varying(50) COLLATE pg_catalog."default",
				    precision_bid integer,
				    amount_bidder_balance_before numeric(72,8),
				    code_bidder_balance_before character varying(50) COLLATE pg_catalog."default",
				    precision_bidder_balance_before integer,
				    market_id integer,
				    market_frozen boolean,
				    market_contract_base_token character varying(12) COLLATE pg_catalog."default",
				    market_precision_base_token integer,
				    market_code_base_token character varying(50) COLLATE pg_catalog."default",
				    market_contract_quote_token character varying(12) COLLATE pg_catalog."default",
				    market_precision_quote_token integer,
				    market_code_quote_token character varying(50) COLLATE pg_catalog."default",
				    market_amount_min_buy numeric(72,8),
				    market_code_min_buy character varying(50) COLLATE pg_catalog."default",
				    market_precision_min_buy integer,
				    market_amount_min_sell numeric(72,8),
				    market_code_min_sell character varying(50) COLLATE pg_catalog."default",
				    market_precision_min_sell integer,
				    created_at_block bigint,
				    global_sequence bigint,
				    updated_at_time bigint
				);

				CREATE INDEX ${this.tableName}_index ON public."${this.tableName}" ("global_sequence", "created_at_block", "updated_at_time", "src", "order_id", "asker", "bidder", "code_ask", "code_bid", "market_id", "market_contract_base_token", "market_code_base_token", "market_contract_quote_token", "market_code_quote_token");

				ALTER TABLE IF EXISTS public."${this.tableName}"
				ADD CONSTRAINT ${this.tableName}_pkey PRIMARY KEY (trx_id, action_ordinal);

				ALTER TABLE IF EXISTS public."${this.tableName}"
				    OWNER to swaplog;
		`;

		return await this.createQuery(query)
	}
}