"""
RabbitMQ consumer for AI vulnerability analysis jobs
"""
import json
import logging
import pika
import time
from typing import Callable, Optional
from pika.exceptions import AMQPConnectionError, AMQPChannelError

from .config import settings
from .ai_service import AIVulnerabilityAnalyzer
from .database import mongo_client

logger = logging.getLogger(__name__)


class AIWorker:
    """
    RabbitMQ consumer that processes AI vulnerability analysis jobs
    """

    def __init__(self):
        """Initialize the AI worker"""
        self.connection = None
        self.channel = None
        self.ai_analyzer = AIVulnerabilityAnalyzer()
        self.is_running = False
        self.reconnect_delay = 5  # seconds

    def connect(self):
        """Establish RabbitMQ connection"""
        try:
            logger.info(f"Connecting to RabbitMQ: {settings.rabbitmq_url}")

            # Create connection parameters
            parameters = pika.URLParameters(settings.rabbitmq_url)
            parameters.heartbeat = 600
            parameters.blocked_connection_timeout = 300

            # Establish connection
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()

            # Declare queue (in case it doesn't exist)
            self.channel.queue_declare(
                queue=settings.ai_queue_name,
                durable=True
            )

            # Set QoS - process one message at a time
            self.channel.basic_qos(prefetch_count=1)

            logger.info(f"Successfully connected to RabbitMQ, queue: {settings.ai_queue_name}")

        except AMQPConnectionError as e:
            logger.error(f"Failed to connect to RabbitMQ: {str(e)}", exc_info=True)
            raise

    def start(self):
        """Start consuming messages from the queue"""
        try:
            self.is_running = True

            while self.is_running:
                try:
                    # Connect if not already connected
                    if not self.connection or self.connection.is_closed:
                        self.connect()

                    logger.info(f"Starting to consume from queue: {settings.ai_queue_name}")

                    # Start consuming
                    self.channel.basic_consume(
                        queue=settings.ai_queue_name,
                        on_message_callback=self._process_message,
                        auto_ack=False  # Manual acknowledgment
                    )

                    logger.info("AI Worker is running and waiting for messages...")
                    self.channel.start_consuming()

                except (AMQPConnectionError, AMQPChannelError) as e:
                    logger.error(f"RabbitMQ connection error: {str(e)}")

                    # Close existing connection
                    self._close_connection()

                    if self.is_running:
                        logger.info(f"Reconnecting in {self.reconnect_delay} seconds...")
                        time.sleep(self.reconnect_delay)
                    else:
                        break

                except KeyboardInterrupt:
                    logger.info("Keyboard interrupt received, stopping worker...")
                    self.stop()
                    break

                except Exception as e:
                    logger.error(f"Unexpected error in consumer loop: {str(e)}", exc_info=True)

                    if self.is_running:
                        logger.info(f"Restarting in {self.reconnect_delay} seconds...")
                        time.sleep(self.reconnect_delay)
                    else:
                        break

        finally:
            self._close_connection()

    def stop(self):
        """Stop consuming messages"""
        logger.info("Stopping AI Worker...")
        self.is_running = False

        if self.channel and not self.channel.is_closed:
            try:
                self.channel.stop_consuming()
            except Exception as e:
                logger.warning(f"Error stopping consumer: {str(e)}")

        self._close_connection()

    def _close_connection(self):
        """Close RabbitMQ connection"""
        if self.channel and not self.channel.is_closed:
            try:
                self.channel.close()
            except Exception as e:
                logger.warning(f"Error closing channel: {str(e)}")

        if self.connection and not self.connection.is_closed:
            try:
                self.connection.close()
            except Exception as e:
                logger.warning(f"Error closing connection: {str(e)}")

    def _process_message(self, channel, method, properties, body):
        """
        Process a single AI analysis job message

        Args:
            channel: RabbitMQ channel
            method: Delivery method
            properties: Message properties
            body: Message body
        """
        try:
            # Parse message
            message_data = json.loads(body.decode('utf-8'))

            scan_id = message_data.get('scanId')
            package_name = message_data.get('packageName')
            vulnerability_id = message_data.get('vulnerabilityId')

            logger.info(
                f"Processing AI job: scan={scan_id}, "
                f"package={package_name}, vuln={vulnerability_id}"
            )

            # Perform AI analysis
            ai_result = self.ai_analyzer.analyze_vulnerability(message_data)

            # Update MongoDB with results
            if ai_result.get('success'):
                success = mongo_client.update_vulnerability_ai_analysis(
                    scan_id=scan_id,
                    package_name=package_name,
                    vulnerability_id=vulnerability_id,
                    ai_data=ai_result
                )

                if success:
                    logger.info(
                        f"Successfully processed and saved AI analysis for "
                        f"{package_name}:{vulnerability_id}"
                    )
                    # Acknowledge the message
                    channel.basic_ack(delivery_tag=method.delivery_tag)
                else:
                    logger.error(
                        f"Failed to save AI analysis to database for "
                        f"{package_name}:{vulnerability_id}"
                    )
                    # Reject and requeue the message for retry
                    channel.basic_nack(
                        delivery_tag=method.delivery_tag,
                        requeue=True
                    )
            else:
                # AI analysis failed, but save the error
                logger.warning(
                    f"AI analysis failed for {package_name}:{vulnerability_id}, "
                    f"saving error: {ai_result.get('aiAnalysisError')}"
                )

                mongo_client.update_vulnerability_ai_analysis(
                    scan_id=scan_id,
                    package_name=package_name,
                    vulnerability_id=vulnerability_id,
                    ai_data=ai_result
                )

                # Acknowledge the message (don't retry failed AI analysis)
                channel.basic_ack(delivery_tag=method.delivery_tag)

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in message: {str(e)}")
            # Reject without requeue - malformed message
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)

        except Exception as e:
            logger.error(f"Error processing message: {str(e)}", exc_info=True)
            # Reject and requeue for retry
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)


# Global worker instance
ai_worker = AIWorker()
