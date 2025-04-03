// services/websocket.service.ts
import { Server as HTTPServer } from 'http';
import { Server as WebSocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import path from 'path';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { ScanCompleteMessage } from '../types/queue';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

/**
 * Manages WebSocket connections for real-time updates
 */
export class WebSocketService {
  private io: WebSocketServer;
  private userSockets: Map<string, string[]> = new Map(); // userId -> socketIds[]
  private isInitialized: boolean = false;

  constructor(server: HTTPServer) {
    // Initialize Socket.io server
    this.io = new WebSocketServer(server, {
      cors: {
        origin: FRONTEND_URL,
        methods: ['GET', 'POST'],
        credentials: true, // Allow cookies
      },
    });

    this.setupSocketHandlers();
    this.isInitialized = true;
    logger.info('WebSocket service initialized successfully');
  }

  /**
   * Set up Socket.io event handlers
   */
  private setupSocketHandlers(): void {
    logger.info('Setting up WebSocket event handlers');
    this.io.on('connection', (socket) => {
      logger.info(`New socket connection: ${socket.id}`);

      try {
        // Get the cookie from the handshake
        const cookies = socket.handshake.headers.cookie;
        if (!cookies) {
          logger.warn(`No cookies found for socket ${socket.id}`);
          socket.disconnect();
          return;
        }

        // Parse the cookies manually since we can't use the Express middleware directly
        const cookieMap: { [key: string]: string } = {};
        cookies.split(';').forEach((cookie) => {
          const parts = cookie.split('=');
          const name = parts[0].trim();
          const value = parts.slice(1).join('=').trim();
          cookieMap[name] = value;
        });

        // Get the auth token from cookies
        const authToken = cookieMap['auth_token'];
        if (!authToken) {
          logger.warn(`No auth_token cookie found for socket ${socket.id}`);
          socket.disconnect();
          return;
        }

        // Verify the JWT token
        const decoded = jwt.verify(authToken, JWT_SECRET) as any;
        const userId = decoded.id;

        if (!userId) {
          logger.warn(`Invalid JWT token for socket ${socket.id}`);
          socket.disconnect();
          return;
        }

        // Store socket ID for this user
        if (!this.userSockets.has(userId)) {
          this.userSockets.set(userId, []);
        }
        this.userSockets.get(userId)!.push(socket.id);

        // Join user-specific room
        socket.join(`user:${userId}`);

        logger.info(`Socket ${socket.id} authenticated for user ${userId}`);

        // Handle disconnect
        socket.on('disconnect', () => {
          logger.info(`Socket ${socket.id} disconnected`);
          this.removeSocket(userId, socket.id);
        });
      } catch (error) {
        logger.error('Authentication error:', error);
        socket.disconnect();
      }
    });
  }

  /**
   * Check if the service is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Remove a socket from the user sockets map
   */
  private removeSocket(userId: string, socketId: string): void {
    if (this.userSockets.has(userId)) {
      const sockets = this.userSockets.get(userId)!;
      const updatedSockets = sockets.filter((id) => id !== socketId);

      if (updatedSockets.length > 0) {
        this.userSockets.set(userId, updatedSockets);
      } else {
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Notify user about a scan completion - safely handles errors
   */
  public notifyScanComplete(message: ScanCompleteMessage): boolean {
    try {
      if (!this.isInitialized || !this.io) {
        logger.warn('Cannot notify: WebSocket service not fully initialized');
        return false;
      }

      const { userId, scanId, repositoryId, status, scanType } = message;
      logger.info(`Notifying user ${userId} of scan completion: ${scanId}`);

      // Send to user-specific room
      this.io.to(`user:${userId}`).emit('scan_complete', {
        scanId,
        repositoryId,
        status,
        scanType,
        timestamp: new Date().toISOString(),
        message:
          status === 'completed'
            ? `${
                scanType.charAt(0).toUpperCase() + scanType.slice(1)
              } scan completed successfully`
            : `${
                scanType.charAt(0).toUpperCase() + scanType.slice(1)
              } scan failed: ${message.error || 'Unknown error'}`,
        data: {
          outdatedCount: message.outdatedCount,
          vulnerabilityCount: message.vulnerabilityCount,
          highSeverityCount: message.highSeverityCount,
        },
      });
      return true;
    } catch (error) {
      logger.error('Error sending WebSocket notification:', error);
      return false;
    }
  }

  /**
   * Notify user about a PR creation - safely handles errors
   */
  public notifyPRCreated(
    userId: string,
    scanId: string,
    prDetails: any
  ): boolean {
    try {
      if (!this.isInitialized || !this.io) {
        logger.warn('Cannot notify: WebSocket service not fully initialized');
        return false;
      }

      logger.info(`Notifying user ${userId} of PR creation for scan ${scanId}`);

      this.io.to(`user:${userId}`).emit('pr_created', {
        scanId,
        prDetails,
        timestamp: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      logger.error('Error sending PR creation notification:', error);
      return false;
    }
  }

  /**
   * Get the Socket.io server instance
   */
  public getIO(): WebSocketServer | null {
    if (!this.isInitialized) {
      logger.warn('WebSocket server not initialized');
      return null;
    }
    return this.io;
  }
}

// Singleton pattern with lazy initialization
let webSocketService: WebSocketService | null = null;
let isInitializing = false;
let initializationError: Error | null = null;

/**
 * Initialize the WebSocket service
 * @param server HTTP server instance
 * @returns WebSocket service instance
 */
export const initializeWebSocketService = (
  server: HTTPServer
): WebSocketService => {
  if (webSocketService) {
    return webSocketService;
  }

  if (isInitializing) {
    throw new Error('WebSocket service is currently initializing');
  }

  if (initializationError) {
    throw initializationError;
  }

  try {
    isInitializing = true;
    webSocketService = new WebSocketService(server);
    isInitializing = false;
    return webSocketService;
  } catch (error) {
    isInitializing = false;
    initializationError =
      error instanceof Error
        ? error
        : new Error('Failed to initialize WebSocket service');
    throw initializationError;
  }
};

/**
 * Get the WebSocket service instance
 * @param throwIfNotInitialized Whether to throw if the service is not initialized
 * @returns WebSocket service instance or null
 */
export const getWebSocketService = (
  throwIfNotInitialized: boolean = false
): WebSocketService | null => {
  if (!webSocketService) {
    if (throwIfNotInitialized) {
      throw new Error('WebSocket service not initialized');
    }
    logger.warn('Attempting to use WebSocket service before initialization');
    return null;
  }
  return webSocketService;
};
