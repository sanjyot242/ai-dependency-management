// server/src/middleware/auth.middleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  // Get token from cookies (preferred) or from the Authorization header as fallback
  const token = req.cookies.auth_token || 
    (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  
  try {
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const user = jwt.verify(token, jwtSecret);
    (req as any).user = user;
    next();
  } catch (error) {
    // Clear invalid cookies if they exist
    if (req.cookies.auth_token) {
      res.clearCookie('auth_token');
      res.clearCookie('is_authenticated');
    }
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export default authenticateToken;