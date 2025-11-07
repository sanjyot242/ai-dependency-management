// services/rabbitmq.service.ts
import * as amqplib from 'amqplib';
import { ChannelModel, Channel, ConsumeMessage } from 'amqplib';
import dotenv from 'dotenv';
import path from 'path';
import logger from '../utils/logger';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

// Queue names
export const QUEUE_SCAN_REPOSITORY = 'dependency_scan_repository';
export const QUEUE_VULNERABILITY_SCAN = 'vulnerability_scan';
export const QUEUE_SCAN_COMPLETE = 'scan_complete_notification';
export const QUEUE_PR_CREATION = 'dependency_pr_creation';
export const QUEUE_WEBSOCKET_NOTIFICATION = 'websocket_notification';
export const QUEUE_AI_VULNERABILITY_ANALYSIS = 'ai_vulnerability_analysis';

class RabbitMQService {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private isInitialized = false;

  constructor() {
    // Initialize connection on service creation
    this.init().catch((err) => {
      logger.error('Failed to initialize RabbitMQ connection:', err);
    });
  }

  /**
   * Initialize RabbitMQ connection and channel
   */
  public async init(): Promise<void> {
    try {
      logger.info('Initializing RabbitMQ connection to:', RABBITMQ_URL);

      // Create connection
      this.connection = await amqplib.connect(RABBITMQ_URL);

      // Handle connection errors and reconnection
      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error:', err);
        this.reconnect();
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting to reconnect...');
        this.reconnect();
      });

      // Create channel
      this.channel = await this.connection.createChannel();

      // Assert queues to ensure they exist
      await this.channel.assertQueue(QUEUE_SCAN_REPOSITORY, { durable: true });
      await this.channel.assertQueue(QUEUE_VULNERABILITY_SCAN, {
        durable: true,
      });
      await this.channel.assertQueue(QUEUE_SCAN_COMPLETE, { durable: true });
      await this.channel.assertQueue(QUEUE_PR_CREATION, { durable: true });
      await this.channel.assertQueue(QUEUE_WEBSOCKET_NOTIFICATION, {
        durable: true,
      });
      await this.channel.assertQueue(QUEUE_AI_VULNERABILITY_ANALYSIS, {
        durable: true,
      });

      logger.info('RabbitMQ connection and queues initialized successfully');
      this.isInitialized = true;
    } catch (error) {
      logger.error('Error initializing RabbitMQ:', error);

      // Attempt reconnection after delay
      setTimeout(() => this.reconnect(), 5000);
      throw error;
    }
  }

  /**
   * Reconnect to RabbitMQ after connection failure
   */
  private reconnect(): void {
    this.isInitialized = false;

    if (this.channel) {
      try {
        this.channel.close().catch(() => {});
      } catch (error) {
        // Ignore error if channel is already closed
      }
      this.channel = null;
    }

    if (this.connection) {
      try {
        this.connection.close().catch(() => {});
      } catch (error) {
        // Ignore error if connection is already closed
      }
    }

    this.connection = null;

    // Attempt to reconnect
    logger.info('Attempting to reconnect to RabbitMQ...');
    setTimeout(() => {
      this.init().catch((err) => {
        logger.error('Failed to reconnect to RabbitMQ:', err);
      });
    }, 5000); // Wait 5 seconds before reconnecting
  }

  /**
   * Send a message to a queue
   */
  public async sendToQueue<T>(queueName: string, data: T): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.channel) {
        await this.init();
      }

      if (!this.channel) {
        throw new Error('Channel is not initialized');
      }

      const buffer = Buffer.from(JSON.stringify(data));
      return this.channel.sendToQueue(queueName, buffer, {
        persistent: true, // Message should be saved to disk
      });
    } catch (error) {
      logger.error(`Error sending message to queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Consume messages from a queue
   */
  public async consumeQueue<T>(
    queueName: string,
    callback: (data: T) => Promise<void>
  ): Promise<void> {
    try {
      if (!this.isInitialized || !this.channel) {
        await this.init();
      }

      if (!this.channel) {
        throw new Error('Channel is not initialized');
      }

      await this.channel.prefetch(1); // Process one message at a time

      await this.channel.consume(
        queueName,
        async (msg: ConsumeMessage | null) => {
          if (msg && this.channel) {
            try {
              const data = JSON.parse(msg.content.toString()) as T;
              await callback(data);
              this.channel.ack(msg); // Acknowledge successful processing
            } catch (error) {
              logger.error(
                `Error processing message from queue ${queueName}:`,
                error
              );

              // Reject and requeue message if processing fails
              if (this.channel) {
                this.channel.nack(msg, false, true);
              }
            }
          }
        }
      );

      logger.info(`Consumer registered for queue: ${queueName}`);
    } catch (error) {
      logger.error(`Error consuming from queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Close connection and channel
   */
  public async close(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }

      if (this.connection) {
        await this.connection.close();
      }

      this.isInitialized = false;
      this.channel = null;
      this.connection = null;

      logger.info('RabbitMQ connection closed');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const rabbitMQService = new RabbitMQService();

export default rabbitMQService;
