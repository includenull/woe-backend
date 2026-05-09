import { MongoClient } from 'mongodb'

import AppConfig from '../../config.js'

class DbConnector {
	async init() {
		const dbClient = new MongoClient(AppConfig.mongodb_endpoint);
		await dbClient.connect();
    	console.log('Connected successfully to mongo server');
    	this.db = dbClient.db(AppConfig.mongodb_db);
	}

}

const dbConnector = new DbConnector()

export default async() => {
	if(dbConnector.db === undefined)
		await dbConnector.init()

	return dbConnector.db
}