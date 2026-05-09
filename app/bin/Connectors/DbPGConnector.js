import Knex from 'knex'

import AppConfig from '../../config.js'

class DbConnector {
	constructor() {
		this.db = null
	}
	async init() {
		// Initialize knex.
		this.db = Knex(AppConfig.knexConfig)
	}
}

const dbConnector = new DbConnector()

export default async() => {
	if(dbConnector.db === null)
		await dbConnector.init()

	return dbConnector.db
}