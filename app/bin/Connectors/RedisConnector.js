import { createClient } from 'redis'

import AppConfig from '../../config.js'

class RedisConnector {
  constructor() {
    this.clients = {}
  }

  async init(connectionName) {
    this.clients[connectionName] = createClient({
      url: AppConfig.redis_endpoint
    });

    await this.clients[connectionName].connect()
    this.clients[connectionName].on('connect', function() {
      console.log('Redis connected!');
      //this.clients[connectionName].FLUSHALL()
    });

    this.clients[connectionName].on('error', (err) => console.log('Redis Client Error', err));
  }

}

const redisConnector = new RedisConnector()

export default async(connectionName) => {
  if(connectionName === undefined)
    connectionName = '__default__';

  if(redisConnector.clients[connectionName] === undefined)
    await redisConnector.init(connectionName)

  return redisConnector.clients[connectionName]
}
