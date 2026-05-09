import getDb from '../../Connectors/DbPGConnector.js'

export default class Table {
	constructor(tableName) {
		this.tableName = tableName
	}

	async doesExist() {
		const db = await getDb()
		return await db.schema.hasTable(this.tableName)
	}

	async createQuery(query) {
		const doesExist = await this.doesExist();

		if(doesExist)
			return;

		const db = await getDb()	
		return await db.raw(query)
	}
}