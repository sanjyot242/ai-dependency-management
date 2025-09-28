// Create a new file: workers/websocket-notification.worker.ts
import logger from '../../utils/logger';
import rabbitMQService, {
  QUEUE_WEBSOCKET_NOTIFICATION,
} from '../../services/rabbitmq.service';
import { getWebSocketService } from '../../services/websocket.service';

class WebsocketNotificationWorker {
  /**
   * Initialize the worker to consume jobs from the websocket notification queue
   */
  public async start(): Promise<void> {
    try {
      logger.info('Starting WebSocket Notification Worker');

      // Start consuming from websocket notification queue
      await rabbitMQService.consumeQueue<any>(
        QUEUE_WEBSOCKET_NOTIFICATION,
        this.processNotification.bind(this)
      );

      logger.info('WebSocket Notification Worker is running');
    } catch (error) {
      logger.error('Error starting WebSocket Notification Worker:', error);
      throw error;
    }
  }

  /**
   * Process a notification message
   */
  private async processNotification(message: any): Promise<void> {
    logger.info('Processing WebSocket notification:', message.type);

    try {
      // Get the WebSocket service (which should be initialized in the web container)
      const wsService = getWebSocketService(true);

      if (!wsService) {
        throw new Error('WebSocket service not initialized');
      }

      // Handle different types of notifications
      if (message.type === 'scan_complete') {
        const success = wsService.notifyScanComplete(message.data);
        logger.info(`Notification ${success ? 'sent' : 'failed'}`);
      } else if (message.type === 'pr_created') {
        const { userId, scanId, prDetails } = message.data;
        const success = wsService.notifyPRCreated(userId, scanId, prDetails);
        logger.info(`PR notification ${success ? 'sent' : 'failed'}`);
      } else if (message.type === 'test_message') {
        // Handle test message
        const { userId, message: testMessage } = message.data;
        const io = wsService.getIO();
        if (io) {
          io.to(`user:${userId}`).emit('test', {
            message: testMessage,
            timestamp: message.data.timestamp,
          });
          logger.info(`Test message sent to user ${userId}`);
        } else {
          logger.warn('WebSocket IO not available for test message');
        }
      } else {
        logger.warn(`Unknown notification type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error processing notification:', error);
      // We don't rethrow here to avoid requeuing the message
    }
  }
}

export const websocketNotificationWorker = new WebsocketNotificationWorker();

// Start worker if executed directly
if (require.main === module) {
  websocketNotificationWorker.start().catch((err) => {
    logger.error('Failed to start websocket notification worker:', err);
    process.exit(1);
  });
}

export default websocketNotificationWorker;
