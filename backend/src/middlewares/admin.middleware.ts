// src/middlewares/admin.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';
import logger from '../utils/logger';

export const authenticateAdmin = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    // Get admin token from header OR query parameter
    const adminToken = req.header('X-Admin-Token') || req.query.adminToken as string;
    
    if (!adminToken) {
      return errorResponse(res, 'Admin authentication required', null, 401);
    }
    
    try {
      const decodedToken = Buffer.from(adminToken, 'base64').toString('utf-8');
      const tokenParts = decodedToken.split(':');
      
      const [username, timestamp, hasAccessKey] = tokenParts;
      
      // Validate admin username from environment variables
      const adminUsers = (process.env.ADMIN_USERNAMES || '').split(',');
      
      if (!adminUsers.some(u => u.trim() === username.trim())) {
        return errorResponse(res, 'Invalid admin credentials', null, 401);
      }
      
      // Add admin info to request
      req.adminUser = { 
        username,
        hasFullAccess: hasAccessKey === 'true'
      };
      
      next();
    } catch (error) {
      logger.error('Error decoding admin token.:', error);
      return errorResponse(res, 'Invalid admin token format', null, 401);
    }
  } catch (error) {
    logger.error('Admin authentication error:', error);
    return errorResponse(res, 'Admin authentication failed', null, 500);
  }
};

// Middleware to check for full access (for modification operations)
export const requireFullAccess = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  if (!req.adminUser || !req.adminUser.hasFullAccess) {
    return errorResponse(res, 'Access key required for this operation', null, 403);
  }
  next();
};

// Add to global Express namespace
declare global {
  namespace Express {
    interface Request {
      adminUser?: {
        username: string;
        hasFullAccess: boolean;
      };
    }
  }
}