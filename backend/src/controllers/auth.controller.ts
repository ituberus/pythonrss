// src/controllers/auth.controller.ts
// Controller for user authentication, signup, and onboarding with proper currency handling

import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import UserModel from '../models/user.model';
import MerchantModel from '../models/merchant.model';
import BalanceModel from '../models/balance.model';
import NotificationService from '../services/notification.service';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt'; // Using bcrypt instead of bcryptjs
import { Types } from 'mongoose';
import config from '../config/default';
import logger from '../utils/logger';

// @desc    Register a new merchant
// @route   POST /api/auth/register
// @access  Public
export const register = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password, country, businessName } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', null, 400);
    }
    
    // Check if email already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return errorResponse(res, 'Email already in use', null, 400);
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Determine country (default to US if not provided)
    const userCountry = country || 'US';
    
    // Create a merchant profile first
    const merchant = await MerchantModel.create({
      businessName: businessName || email.split('@')[0], // Use email username as default
      country: userCountry,
      // Currency settings will be auto-populated by the Merchant model pre-save hook
      // Brazilian merchants will get dashboardCurrency=BRL, others will get USD
      status: 'pending_verification',
    });
    
    // Create user
    const user = await UserModel.create({
      email,
      password: hashedPassword,
      role: 'merchant',
      merchantId: merchant._id,
      onboardingStage: 'email',
      onboardingComplete: false,
    });
    
    // Initialize balance for the merchant
    await BalanceModel.create({
      merchantId: merchant._id,
      // By default, Brazilian merchants will see balances in BRL, others in USD
      dashboardCurrency: userCountry === 'BR' ? 'BRL' : 'USD',
      reserve: 0,
      available: 0,
      pending: 0,
    });
    
    // Create welcome notification
    await NotificationService.createNotification(
      (user._id as Types.ObjectId).toHexString(),
      'system',
      'Welcome to RiskPay',
      `Thanks for joining RiskPay! To start accepting payments, please complete your onboarding.`,
      {
        onboardingStage: 'email',
      }
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id },
      config.jwtSecret,
      { expiresIn: '24h' }
    );
    
    // Return success with token and user data (filtered)
    return successResponse(res, 'Registration successful', {
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        merchantId: merchant._id,
        onboardingStage: user.onboardingStage,
        onboardingComplete: user.onboardingComplete,
        emailVerifiedAt: user.emailVerifiedAt,
        country: merchant.country,
        dashboardCurrency: merchant.dashboardCurrency,
      },
    }, 201);
  } catch (error) {
    logger.error('Registration error:', error);
    return errorResponse(res, 'Registration failed', (error as Error).message, 500);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return errorResponse(res, 'Email and password are required', null, 400);
    }
    
    // Find user
    const user = await UserModel.findOne({ email }).select('+password');
    
    if (!user) {
      return errorResponse(res, 'Invalid credentials', null, 401);
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return errorResponse(res, 'Invalid credentials', null, 401);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id },
      config.jwtSecret,
      { expiresIn: '24h' }
    );
    
    // Get merchant data if applicable
    let merchantData = null;
    if (user.merchantId) {
      merchantData = await MerchantModel.findById(user.merchantId);
    }
    
    // Return success with token and user data (filtered)
    return successResponse(res, 'Login successful', {
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        merchantId: user.merchantId,
        onboardingStage: user.onboardingStage,
        onboardingComplete: user.onboardingComplete,
        emailVerifiedAt: user.emailVerifiedAt,
        country: merchantData?.country,
        dashboardCurrency: merchantData?.dashboardCurrency,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    return errorResponse(res, 'Login failed', (error as Error).message, 500);
  }
};

// @desc    Update onboarding information
// @route   POST /api/auth/onboarding/:stage
// @access  Private
export const updateOnboarding = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { stage } = req.params;
    const userId = (req.user as any)._id.toString()
    
    // Get current user with merchant data
    const user = await UserModel.findById(userId);
    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }
    
    // Get merchant
    const merchant = await MerchantModel.findById(user.merchantId);
    if (!merchant) {
      return errorResponse(res, 'Merchant profile not found', null, 404);
    }
    
    // Process based on stage
    switch (stage) {
      case 'email':
        // Verify email
        // In a real implementation, we would send an email with verification link
        // For now, just mark as verified
        await UserModel.findByIdAndUpdate(userId, {
          emailVerifiedAt: new Date(),
          onboardingStage: 'business',
        });
        
        // Create notification
        await NotificationService.createNotification(
          userId.toString(),
          'system',
          'Email Verified',
          'Your email has been verified. Please continue with business information.',
          {
            onboardingStage: 'business',
          }
        );
        
        break;
        
      case 'business':
        // Update merchant business data
        const { businessName, country, sellingMethod } = req.body;
        
        // Validate required fields
        if (!businessName || !country) {
          return errorResponse(res, 'Business name and country are required', null, 400);
        }
        
        // Check if changing country (which affects currency settings)
        const isChangingCountry = merchant.country !== country;
        
        // Update merchant
        const updatedMerchant = await MerchantModel.findByIdAndUpdate(
          merchant._id,
          {
            businessName,
            country,
            sellingMethod: sellingMethod || 'hosted_store',
          },
          { new: true }
        );
        
        // If country changed, update balance currency
        if (isChangingCountry) {
          // Currency is set based on country in the Merchant pre-save hook
          // For Brazilian merchants: BRL, for others: USD
          const newDashboardCurrency = country === 'BR' ? 'BRL' : 'USD';
          
          await BalanceModel.findOneAndUpdate(
            { merchantId: merchant._id },
            { dashboardCurrency: newDashboardCurrency }
          );
          
          logger.info(`Updated merchant ${merchant._id} country to ${country} and dashboard currency to ${newDashboardCurrency}`);
        }
        
        // Update user
        await UserModel.findByIdAndUpdate(userId, {
          onboardingStage: 'verification',
        });
        
        // Create notification
        await NotificationService.createNotification(
          userId.toString(),
          'system',
          'Business Information Updated',
          'Your business information has been updated. Please continue with identity verification.',
          {
            onboardingStage: 'verification',
          }
        );
        
        break;
        
      case 'verification':
        // This would handle ID verification document uploads
        // For simplicity, we're just updating the stage
        await UserModel.findByIdAndUpdate(userId, {
          onboardingStage: 'banking',
          idCheckStatus: 'pending' // In real implementation, would be set when docs are uploaded
        });
        
        // Create notification
        await NotificationService.createNotification(
          userId.toString(),
          'system',
          'Verification Documents Submitted',
          'Your verification documents have been submitted for review. This process may take 1-3 business days.',
          {
            onboardingStage: 'banking',
          }
        );
        
        break;
        
      case 'banking':
        // Handle banking details
        const { accountName, accountNumber, bankName, routingNumber } = req.body;
        
        // Validate required fields
        if (!accountName || !accountNumber || !bankName) {
          return errorResponse(res, 'Banking details are required', null, 400);
        }
        
        // In a real implementation, we would store these in a secure way
        // and validate them with the bank
        
        // Update onboarding status
        await UserModel.findByIdAndUpdate(userId, {
          onboardingStage: 'complete',
          onboardingComplete: true,
        });
        
        // Create notification
        await NotificationService.createNotification(
          userId.toString(),
          'system',
          'Onboarding Complete',
          'Congratulations! Your onboarding is complete. You can now create products and start accepting payments.',
          {
            onboardingStage: 'complete',
          }
        );
        
        break;
        
      case 'international':
        // Handle international selling preferences
        const { sellsInternationally } = req.body;
        
        // Update merchant
        await MerchantModel.findByIdAndUpdate(
          merchant._id,
          { sellsInternationally: Boolean(sellsInternationally) },
          { new: true }
        );
        
        // Create notification
        await NotificationService.createNotification(
          userId.toString(),
          'system',
          'International Selling Settings Updated',
          sellsInternationally ? 
            'Your account is now set up for international sales. Your finance page will show both your local currency and USD.' : 
            'Your account is now set for local sales only.',
          {
            sellsInternationally
          }
        );
        
        break;
        
      default:
        return errorResponse(res, 'Invalid onboarding stage', null, 400);
    }
    
    // Get updated user and merchant data
    const updatedUser = await UserModel.findById(userId);
    const updatedMerchant = await MerchantModel.findById(user.merchantId);
    
    return successResponse(res, 'Onboarding updated successfully', {
      user: {
        _id: updatedUser?._id,
        email: updatedUser?.email,
        role: updatedUser?.role,
        merchantId: updatedUser?.merchantId,
        onboardingStage: updatedUser?.onboardingStage,
        onboardingComplete: updatedUser?.onboardingComplete,
        emailVerifiedAt: updatedUser?.emailVerifiedAt,
        idCheckStatus: updatedUser?.idCheckStatus,
      },
      merchant: {
        _id: updatedMerchant?._id,
        businessName: updatedMerchant?.businessName,
        country: updatedMerchant?.country,
        dashboardCurrency: updatedMerchant?.dashboardCurrency,
        payoutCurrency: updatedMerchant?.payoutCurrency,
        sellingMethod: updatedMerchant?.sellingMethod,
        sellsInternationally: updatedMerchant?.sellsInternationally,
      },
    });
  } catch (error) {
    logger.error('Onboarding update error:', error);
    return errorResponse(res, 'Failed to update onboarding', (error as Error).message, 500);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getCurrentUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Get user data
    const user = await UserModel.findById(req.user._id);
    
    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }
    
    // Get merchant data if applicable
    let merchantData = null;
    if (user.merchantId) {
      merchantData = await MerchantModel.findById(user.merchantId);
    }
    
    // Return user data
    return successResponse(res, 'User profile retrieved', {
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        merchantId: user.merchantId,
        onboardingStage: user.onboardingStage,
        onboardingComplete: user.onboardingComplete,
        emailVerifiedAt: user.emailVerifiedAt,
        idCheckStatus: user.idCheckStatus,
      },
      merchant: merchantData ? {
        _id: merchantData._id,
        businessName: merchantData.businessName,
        country: merchantData.country,
        dashboardCurrency: merchantData.dashboardCurrency,
        payoutCurrency: merchantData.payoutCurrency,
        sellingMethod: merchantData.sellingMethod,
        sellsInternationally: merchantData.sellsInternationally,
      } : null,
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    return errorResponse(res, 'Failed to retrieve user profile', (error as Error).message, 500);
  }
};