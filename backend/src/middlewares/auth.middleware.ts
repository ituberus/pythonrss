// backend/src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/default';
import { errorResponse } from '../utils/response';
import UserModel from '../models/user.model';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // Check if token exists
  if (!token) {
    return errorResponse(res, 'No token provided, authorization denied', null, 401);
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    
    // Find user by id
    const user = await UserModel.findById(decoded.id).select('-password');
    
    if (!user) {
      return errorResponse(res, 'User not found', null, 401);
    }
    
    // Check if user is suspended or blocked
    if (user.status === 'suspended') {
      // Check if suspension period has ended
      if (user.suspendedUntil && new Date() > user.suspendedUntil) {
        // Automatically reactivate user
        user.status = 'active';
        user.suspendedUntil = undefined;
        await user.save();
      } else {
        return errorResponse(res, 'Your account is temporarily suspended', {
          suspendedUntil: user.suspendedUntil
        }, 403);
      }
    }
    
    if (user.status === 'blocked') {
      return errorResponse(res, 'Your account has been blocked. Please contact support for assistance.', null, 403);
    }
    
    // Add user to request
    req.user = user;
    
    next();
  } catch (error) {
    return errorResponse(res, 'Token is invalid', null, 401);
  }
};

export const requireMerchantRole = (req: Request, res: Response, next: NextFunction): Response | void => {
  if (req.user && req.user.role === 'merchant') {
    return next();
  }
  
  return errorResponse(res, 'Access denied, merchant role required', null, 403);
};

export const requireAdminRole = (req: Request, res: Response, next: NextFunction): Response | void => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  return errorResponse(res, 'Access denied, admin role required', null, 403);
};

export const requireOnboardingComplete = (req: Request, res: Response, next: NextFunction): Response | void => {
  if (req.user && req.user.onboardingComplete) {
    return next();
  }
  
  return errorResponse(res, 'Onboarding process not completed', {
    redirectUrl: '/onboarding',
    currentStage: req.user.onboardingStage
  }, 403);
};

// New middleware to require email verification
export const requireEmailVerified = (req: Request, res: Response, next: NextFunction): Response | void => {
  if (req.user && req.user.emailVerifiedAt) {
    return next();
  }
  
  return errorResponse(res, 'Email verification required', {
    redirectUrl: '/verify-email'
  }, 403);
};

// New middleware to require ID verification
export const requireIdVerification = (req: Request, res: Response, next: NextFunction): Response | void => {
  if (req.user && req.user.idCheckStatus === 'verified') {
    return next();
  }
  
  return errorResponse(res, 'ID verification required', {
    redirectUrl: '/merchant/verify-identity',
    status: req.user.idCheckStatus
  }, 403);
};