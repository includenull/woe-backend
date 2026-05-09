import getRedis from './Connectors/RedisConnector.js'
import StreamReaderrows from './Readers/Streamrows.js'

export default class Readerrows {
	constructor(tables_interest) {
		this.tables_interest = tables_interest
		this.reader = null
	}

	async onProcessedData(row) {
		const redis = await getRedis('readerrows_publisher')
		const qstream = this.getQStream(row.code, row.table)
		const src = this.getSrc(row.code, row.table)
		if(qstream !== null) {
			if(src !== null)
				row.src = src

			redis.publish(qstream, JSON.stringify(row));
		}
	}

	getQStream(code, table) {
		const ti = this.tables_interest.filter(e => (e.code === code || e.code === '*') && table === e.table)

		return (ti.length) ? ti[0].qstream : null;
	}

	getSrc(code, table) {
		const ti = this.tables_interest.filter(e => e.code === code && table === e.table)

		return (ti.length) ? ((ti[0].src !== undefined) ? ti[0].src : null) : null;
	}

	async start() {
		this.reader = new StreamReaderrows(
			this.tables_interest,
			(datas) => this.onProcessedData(datas)
		);

		this.reader.connect()
	}
}