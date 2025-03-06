// server/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface UserPayload {
  githubToken: any;
  id: string;
  username: string;
  githubId?: string;
  iat: number;
  exp: number;
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from cookie or Authorization header
    const token =
      req.cookies.auth_token ||
      (req.headers.authorization && req.headers.authorization.split(' ')[1]);

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Verify token
    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
      if (err) {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
      }

      // Add user info to request

      req.user = decoded as UserPayload;
      console.log('User authenticated:', req.user);
      next();
    });
  } catch (error) {
    // Clear invalid cookies if they exist
    if (req.cookies.auth_token) {
      res.clearCookie('auth_token');
      res.clearCookie('is_authenticated');
    }
    console.error('Error in authentication middleware:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

export default authenticateToken;
