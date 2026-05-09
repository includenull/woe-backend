import amqp from 'amqplib';
import AppConfig from '../../config.js'

import { delay } from '../../utils/utils.js'

class RabbitMQConnector {
  async init() {
    await this.connect()
  }

  async connect(connectTry = 0) {
    try {
      this.client = await amqp.connect(AppConfig.rabbitmq_endpoint);
      this.channel = await this.client.createChannel();
    }
    catch(err) {
      if(connectTry < 3) {
        ++connectTry
        await delay(5000)
        return await this.connect(connectTry)
      }
      else {
        throw new Error('Impossible to connect to RabbitMQ')
      }
    }
    
  }

  async sendMessage(queueName, data) {
    // Send a message to the queue
    const message = Buffer.from(JSON.stringify(data));
    await this.channel.assertQueue(queueName);
    await this.channel.sendToQueue(queueName, message);
  }

  async consumeMessage(queueName, callback) {
    // Consume messages from the queue
    await this.channel.assertQueue(queueName);
    this.channel.consume(queueName, async (msg) => {
      const data = JSON.parse(msg.content.toString());
      callback(data);
    }, { noAck: true });
  }

  async assertQueue(queueName) {
    await this.channel.assertQueue(queueName)
  }

  async createExchange(exchangeName, exchangeType) {
    // Create an exchange
    await this.channel.assertExchange(exchangeName, exchangeType);
  }

  async bindQueueToExchange(queueName, exchangeName, routingKey = '') {
    // Bind a queue to an exchange with a routing key
    await this.channel.bindQueue(queueName, exchangeName, routingKey);
  }

  async sendMessageToExchange(exchangeName, routingKey, data) {
    // Send a message to an exchange with a routing key
    const message = Buffer.from(JSON.stringify(data));
    await this.channel.publish(exchangeName, routingKey, message);
  }
}

const rabbitMQConnector = new RabbitMQConnector()

export default async() => {
  if(rabbitMQConnector.client === undefined)
    await rabbitMQConnector.init()

  return rabbitMQConnector
}