import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';
import logger from '../utils/logger';

// NotFoundError handler - must have next parameter for Express to recognize it correctly
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): Response => {
  return errorResponse(res, `Route not found - ${req.originalUrl}`, null, 404);
};

// Global error handler - must have all 4 parameters for Express to recognize it as an error handler
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): Response => {
  logger.error('Global error caught:', err);
  
  // Check for MongoDB duplicate key error
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    return errorResponse(res, `${field} already exists`, null, 400);
  }

  // Check for validation errors
  if ((err as any).name === 'ValidationError') {
    const errors = Object.values((err as any).errors).map((err: any) => err.message);
    return errorResponse(res, 'Validation error', errors, 400);
  }

  // Default error response
  return errorResponse(
    res,
    process.env.NODE_ENV === 'production' ? 'Server Error' : err.message,
    process.env.NODE_ENV === 'production' ? null : err,
    500
  );
};