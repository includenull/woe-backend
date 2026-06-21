import getDb from '../../Connectors/DbPGConnector.js'
import logger from '@utils/logger.js';

export class KlinesSync {
	constructor({
		src,
		pair_id,
		updated_at_time,
		last_trade_time,
		last_trade_block
	}) {
		this.src = src
		this.pair_id = pair_id
		this.updated_at_time = Number(updated_at_time)
		this.last_trade_time = Number(last_trade_time)
		this.last_trade_block = Number(last_trade_block)
	}	
}

export class KlinesSyncRows {
	constructor(rows = []) {
		this.rows = []
	}

	async load() {
		const db = await getDb()

		const data = await db.select(
			'src',
			'pair_id',
			'updated_at_time',
			'last_trade_time',
			'last_trade_block'
		).from(
			'klinesSync'
		);

		this.rows = data.map(d => {
			const klinesSync = new KlinesSync(d)
			return d = klinesSync
		})
	}
	
	findRowIndex(src, pair_id) {
		return this.rows.findIndex(r => r.src === src && r.pair_id == pair_id)
	}

	findRow(src, pair_id) {
		const rowIndex = this.findRowIndex(src, pair_id)
		return (rowIndex !== -1) ? this.rows[rowIndex] : null
	}

	// Return oldest updated
	findRowsToCatchup() {
		let rows = this.rows.filter(r => 
			(r.updated_at_time < r.last_trade_time || r.updated_at_time === 0)
		)

		rows.sort((a, b) => a.updated_at_time - b.updated_at_time)
		return rows
	}

	findRowsAboveBlocknum(block_num) {
		return this.rows.filter(r => r.last_trade_block >= block_num)
	}

	async update({src, pair_id, updated_at_time, last_trade_time, last_trade_block}, force_update = false) {
		const db = await getDb()
		const rowIndex = this.findRowIndex(src, pair_id)
		//console.log({src, pair_id, updated_at_time, last_trade_time}, rowIndex)

		if(rowIndex !== -1) {
			const row = this.rows[rowIndex]
			updated_at_time = (force_update) ? updated_at_time : Math.max(updated_at_time, row.updated_at_time);
			last_trade_time = (force_update) ? last_trade_time : Math.max(last_trade_time, row.last_trade_time);

			if(force_update || row.updated_at_time !== updated_at_time || row.last_trade_time !== last_trade_time) {
				try {
					await db('klinesSync').update({
						updated_at_time: updated_at_time,
						last_trade_time: last_trade_time,
						last_trade_block: last_trade_block,
					}).where({
		      	'src': src,
		      	'pair_id': pair_id
		      })

		      this.rows[rowIndex].updated_at_time = updated_at_time
		      this.rows[rowIndex].last_trade_time = last_trade_time
		      this.rows[rowIndex].last_trade_block = last_trade_block
				}
				catch(e) {
					logger.error(e)
					process.exit(1)
				}
			} // else nothing to update
		}
		else {
			try {
				await db('klinesSync').insert({
					src: src,
					pair_id: pair_id,
					updated_at_time: updated_at_time,
					last_trade_time: last_trade_time,
					last_trade_block: last_trade_block
				})
	      this.rows.push(new KlinesSync({
					src: src,
					pair_id: pair_id,
					updated_at_time: updated_at_time,
					last_trade_time: last_trade_time,
					last_trade_block: last_trade_block
				}))
			}
			catch(e) {
				logger.error({ err: e }, "Error while inserting klinesSync")
			}
		}
	}
}