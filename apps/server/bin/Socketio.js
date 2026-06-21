import http from 'http';
import { Server } from 'socket.io';
import { RateLimiterMemory } from "rate-limiter-flexible";

import { KlineRows } from './Models/Rows/Kline.js';

import getRedis from './Connectors/RedisConnector.js'

import {delay} from '../utils/utils.js';
import logger from '@utils/logger.js';

const SERVER_PORT = 8010;

export default class SocketioServer {
  constructor() {
    this.server = http.createServer();
    this.io = new Server(
      this.server, {
      cors: {origin: "*"},
      path: "/waxonedge-socket.io/"
    })
    this.redis = null
    this.redisGetter = null

    const ratelimits = {
      points: 600, // x points
      duration: 60, // Per x second
    };
    this.rateLimiter = new RateLimiterMemory(ratelimits);

    // Define a map to keep track of active connections per user
    this.activeConnections = new Map();
    // Maximum allowed concurrent connections per user
    this.maxConnectionsPerUser = 10;
  }

  async initRedis() {
    this.redis = await getRedis()
    this.redisGetter = await getRedis('socket-getter')
  }

  async startPushMarketMatches() {
    const marketQueueName = 'marketMatches_insert_socketio'
    try {
      this.redis.subscribe(marketQueueName, (data) => {
        data = JSON.parse(data)

        const fieldsToKeep = [
          'src',
          'mode',
          'trx_id',
          'action_ordinal',
          'order_id',
          'asker',
          'bidder',
          'unit_price',
          'amount_ask',
          'code_ask',
          'precision_ask',
          'amount_bid',
          'code_bid',
          'precision_bid',
          'market_id',
          'created_at_block',
          'global_sequence',
          'updated_at_time'
        ];

        for(const key of Object.keys(data))
          if (!fieldsToKeep.includes(key))
            delete data[key];

        let src = data.src.split('_')
        src = src[0]+'market'
        const roomName = 'marketMatches_'+src+'_'+data.market_id
        this.io.to(roomName).emit('marketMatch', { 
          src: src,
          market_id: data.market_id,
          row: data
        });
      });
    } catch (err) {
      // If an error occurs, log it and wait 5 seconds before trying again
      logger.error({ err: err }, `Error consuming messages from queue ${marketQueueName}:`);
    }
  }

  async startPushKlines() {
    const klinesInsQueueName = 'klines_insert_socketio'
    this.redis.subscribe(klinesInsQueueName, (data) => {
      this.pushKline('insert', JSON.parse(data))
    });
    const klinesUpdQueueName = 'klines_update_socketio'
    this.redis.subscribe(klinesUpdQueueName, (data) => {
      this.pushKline('update', JSON.parse(data))
    });
  }

  async pushKline(operation, data) {
    const src = data.src
    const pair_id = data.pair_id
    const duration = data.duration

    this.io.to('klines_'+src+'_'+pair_id+'_'+duration).emit('kline', {
      operation: operation,
      src: src,
      pair_id: pair_id,
      duration: duration,
      row: data
    });

    this.io.to('klines_'+src+'_'+pair_id+'_'+duration+'_reversed').emit('kline', {
      operation: operation,
      src: src,
      pair_id: pair_id,
      duration: duration,
      row: KlineRows.reverseCandles([data])[0]
    });
    
  }

  async startPushOrderbooksDelta() {
    const orderbooksDeltaQueueName = 'marketOrderbooks_rows_indexer'
    this.redis.subscribe(orderbooksDeltaQueueName, (data) => {
      const row = JSON.parse(data)
      const roomName = 'orderbooksDelta_'+row.code+'_'+row.scope
      this.io.to(roomName).emit('orderbookDelta', {
        code: row.code,
        scope: row.scope,
        table: row.table,
        present: row.present,
        value: row.value
      });
    })
  }

  async start() {
    await this.initRedis()

    this.io.use(async (socket, next) => {
      const remoteAddress = socket.handshake.headers['x-real-ip'] || socket.handshake.address;
      const token = socket.handshake.auth.token;
      const uuid = socket.handshake.auth.uuid;

      try {
        await this.rateLimiter.consume(remoteAddress, 5)
      }
      catch(rateLimiterRes) {
        logger.info('remoteAddress '+remoteAddress+' force disconnect RATE_LIMITED')
        await socket.disconnect();
        return;
      }

      if (!token || !uuid) {
        try {
          await this.rateLimiter.consume(remoteAddress, 500)
        }
        catch(rateLimiterRes) {
          await this.rateLimiter.penalty(remoteAddress, 601) // 1 minute
          //console.log('remoteAddress '+remoteAddress+' RATE_LIMITED')
          return next(new Error('429 - Too Many Requests'));
        }
        return next(new Error('SESSION_TOKEN&&SESSION_UUID:REQUIRED'));
      }

      const sessionToken = await this.redisGetter.get('socket-session-token_'+token);

      if (sessionToken === null || sessionToken !== uuid) {
        try {
          await this.rateLimiter.consume(remoteAddress, 500)
        }
        catch(rateLimiterRes) {
          await this.rateLimiter.penalty(remoteAddress, 601) // 1 minute
          //console.log('remoteAddress '+remoteAddress+' RATE_LIMITED')
          return next(new Error('429 - Too Many Requests'));
        }
        return next(new Error('SESSION_TOKEN&&SESSION_UUID:INVALID'));
      }

      next();
    });

    this.io.on('connection', socket => {
      // Handle user authentication and get the user's identifier (e.g., user ID or username)
      const userId = this.authenticateUser(socket);

      if (!userId) {
        // Handle unauthenticated connections
        socket.disconnect();
        return;
      }

      // Check if the user has reached the maximum allowed connections
      if(this.getUserConnectionCount(userId) >= this.maxConnectionsPerUser) {
        logger.info('user '+userId+' reached max number of connections')
        socket.disconnect();
        return;
      }

      // Increment the user's connection count
      this.incrementUserConnectionCount(userId);
      // console.log(userId, this.getUserConnectionCount(userId), this.activeConnections)

      socket.on('subscribe', ({roomType, params}) => {
        if(roomType === 'marketMatches') {
          const src = params.src
          const market_id = params.market_id
          socket.join('marketMatches_'+src+'_'+market_id)
        }
        else if(roomType === 'klines') {
          const src = params.src
          const pair_id = params.pair_id
          const duration = params.duration
          const isReversed = (params.is_reversed === true) ? '_reversed' : ''
          socket.join('klines_'+src+'_'+pair_id+'_'+duration+isReversed)
        }
        else if(roomType === 'orderbooksDelta') {
          const code = params.code
          const scope = params.scope
          socket.join('orderbooksDelta_'+code+'_'+scope)
        }
      });

      socket.on('unsubscribe', ({ roomType, params }) => {
        if (roomType === 'marketMatches') {
          const src = params.src
          const market_id = params.market_id
          socket.leave('marketMatches_'+src+'_'+market_id)
        }
        else if(roomType === 'klines') {
          const src = params.src
          const pair_id = params.pair_id
          const duration = params.duration
          const isReversed = (params.is_reversed === true) ? '_reversed' : ''
          socket.leave('klines_'+src+'_'+pair_id+'_'+duration+isReversed)
        }
        else if(roomType === 'orderbooksDelta') {
          const code = params.code
          const scope = params.scope
          socket.leave('orderbooksDelta_'+code+'_'+scope)
        }
      });

      socket.on('disconnect', () => {
        this.decrementUserConnectionCount(userId);

        // Leave the room when a client disconnects
        socket.rooms.forEach(room => {
          socket.leave(room);
        });
      });
    });

    this.server.listen(SERVER_PORT, async () => {
      logger.info('Socket.io server listening on port '+SERVER_PORT);
      this.startPushMarketMatches()
      this.startPushKlines()
      this.startPushOrderbooksDelta()
    });
  }

  authenticateUser(socket) {
    // Get the IP address of the connected client
    const clientIP = socket.handshake.headers['x-real-ip'] || socket.handshake.address;
    return clientIP;
  }

  getUserConnectionCount(userId) {
    return this.activeConnections.get(userId) || 0;
  }

  incrementUserConnectionCount(userId) {
    const count = this.getUserConnectionCount(userId) + 1;
    this.activeConnections.set(userId, count);
  }

  decrementUserConnectionCount(userId) {
    const count = this.getUserConnectionCount(userId) - 1;
    if (count <= 0) {
      this.activeConnections.delete(userId);
    } else {
      this.activeConnections.set(userId, count);
    }
  }
}