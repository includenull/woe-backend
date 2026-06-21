import getDb from '../../Connectors/DbPGConnector.js'
import Table from './Table.js'

class KlinesTable extends Table {
	constructor(src, pair_id) {
		super('klines_'+src+'_'+pair_id)
		this.src = src
		this.pair_id = pair_id
		this.lastSyncedUpdatedAtTime = {}
	}

	static async dropAllKlines() {
		const db = await getDb()

		const results = await db.raw(`
			SELECT table_name 
			FROM information_schema.tables 
			WHERE table_schema='public' AND table_type='BASE TABLE';
		`)

		const tableNames = results.rows.filter((row) => row.table_name.startsWith('klines_')).map(r => r = r.table_name)

		for(const tableName of tableNames)
			await KlinesTable.drop(tableName)

		await db.raw(`TRUNCATE public."klinesSync" RESTART IDENTITY;`);

		return true
	}

	static async drop(tableName) {
		const db = await getDb()	
		const query = `
			DROP TABLE IF EXISTS public."${tableName}";
		`;

		return await db.raw(query)
	}

	async create() {
		const query = `
		    CREATE TABLE IF NOT EXISTS public."${this.tableName}"
		    (
		        duration character varying(20) COLLATE pg_catalog."default" NOT NULL,
		        updated_at_time bigint NOT NULL,
		        mode character varying(20) COLLATE pg_catalog."default",
		        block_num bigint,
		        global_sequence bigint,
		        high numeric(72,16),
		        low numeric(72,16),
		        open numeric(72,16),
		        close numeric(72,16),
		        "volumeA" numeric(72,16),
		        "volumeB" numeric(72,16),
		        trade_count integer,
		        unique_accounts integer,
		        accounts character varying(12)[] COLLATE pg_catalog."default",
		        CONSTRAINT ${this.tableName}_pkey PRIMARY KEY (duration, updated_at_time)
		    );

		    DROP INDEX IF EXISTS ${this.tableName}_index;
		    CREATE INDEX ${this.tableName}_index ON public."${this.tableName}" (global_sequence, block_num);

		    ALTER TABLE IF EXISTS public."${this.tableName}"
		    OWNER to swaplog;
		`;

		return await this.createQuery(query)
	}

	async getLastSyncedUpdatedAtTime(duration, mode = 'history') {
		const db = await getDb()
		const results = await db.select(
				'updated_at_time'
			).from(
				this.tableName
			).where({
				'mode': mode,
				'duration': duration
			}).orderBy(
				'updated_at_time', 'desc'
			).limit(1);

		return (results.length) ? Number(results[0].updated_at_time) : 0
	}
}

export default KlinesTable;