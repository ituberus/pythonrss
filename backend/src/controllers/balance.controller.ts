// src/controllers/balance.controller.ts
// Controller for merchant balance operations and financial data

import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import BalanceService from '../services/balance.service';
import FxService from '../services/fx.service';
import MerchantModel from '../models/merchant.model';
import logger from '../utils/logger';

// @desc    Get merchant balance
// @route   GET /api/finance/balance
// @access  Private (merchants only)
export const getBalance = async (req: Request, res: Response): Promise<Response> => {
    try {
      // Check if user has a merchant ID
      if (!req.user || !req.user.merchantId) {
        return errorResponse(res, 'Merchant profile not found', null, 404);
      }
      
      const merchantId = req.user.merchantId;
      
      // Get balance
      const balance = await BalanceService.getBalance(merchantId);
      
      // Get merchant to get dashboardCurrency
      const merchant = await MerchantModel.findById(merchantId);
      
      if (!merchant) {
        return errorResponse(res, 'Merchant profile not found', null, 404);
      }
      
      return successResponse(res, 'Balance retrieved successfully', {
        balance: {
          reserve: balance.reserve,
          available: balance.available,
          pending: balance.pending,
          totalBalance: balance.totalBalance,
          currency: balance.dashboardCurrency
        },
        holdDays: merchant?.holdDays || 14
      });
    } catch (error) {
      logger.error('Error retrieving balance:', error);
      return errorResponse(res, 'An error occurred while retrieving balance', null, 500);
    }
  };

// @desc    Get merchant transactions
// @route   GET /api/finance/transactions
// @access  Private (merchants only)
export const getTransactions = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { page, limit, status, fromDate, toDate, sortBy, sortOrder } = req.query;
    const merchantId = req.user.merchantId;
    
    if (!merchantId) {
      return errorResponse(res, 'Merchant profile not found', null, 404);
    }
    
    // Build query for orders
    const query: any = { merchantId };
    
    // Add status filter if provided
    if (status) {
      query.status = status;
    }
    
    // Add date range filter if provided
    if (fromDate || toDate) {
      query.createdAt = {};
      
      if (fromDate) {
        query.createdAt.$gte = new Date(fromDate as string);
      }
      
      if (toDate) {
        query.createdAt.$lte = new Date(toDate as string);
      }
    }
    
    // Set up pagination
    const pageNum = page ? parseInt(page as string) : 1;
    const limitNum = limit ? parseInt(limit as string) : 10;
    const skip = (pageNum - 1) * limitNum;
    
    // Set up sorting
    const sort: any = {};
    const sortField = sortBy as string || 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    sort[sortField] = sortDirection;
    
    // Query transactions (from orders collection)
    // This is just a placeholder - in a real implementation,
    // we would query the orders collection with proper population
    const transactions: any[] = [];
    const total = 0;
    
    // For now, return a placeholder response
    // In a real implementation, this would return actual transaction data
    return successResponse(res, 'Transactions retrieved successfully', {
      transactions,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    logger.error('Error retrieving transactions:', error);
    return errorResponse(res, 'An error occurred while retrieving transactions', null, 500);
  }
};

// @desc    Request a manual payout
// @route   POST /api/finance/payout
// @access  Private (merchants only)
export const requestPayout = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { amount, currency } = req.body;
    const merchantId = req.user.merchantId;
    
    if (!merchantId) {
      return errorResponse(res, 'Merchant profile not found', null, 404);
    }
    
    // Validate input
    if (!amount || amount <= 0) {
      return errorResponse(res, 'Valid amount is required', null, 400);
    }
    
    // Get balance
    const balance = await BalanceService.getBalance(merchantId);
    
    // Check if merchant has sufficient funds
    if (balance.available < amount) {
      return errorResponse(res, 'Insufficient available balance', null, 400);
    }
    
    // Get merchant for currency settings
    const merchant = await MerchantModel.findById(merchantId);
    
    if (!merchant) {
      return errorResponse(res, 'Merchant profile not found', null, 404);
    }
    
    // Determine payout currency (default to merchant's payout currency)
    const payoutCurrency = currency || merchant.payoutCurrency || merchant.dashboardCurrency;
    
    // Convert amount if currencies don't match
    let payoutAmount = amount;
    let conversionInfo = null;
    
    if (balance.dashboardCurrency !== payoutCurrency) {
      const conversion = await FxService.convertCurrency(
        amount,
        balance.dashboardCurrency,
        payoutCurrency,
        merchant.fxSpreadPercent
      );
      
      payoutAmount = conversion.convertedAmount;
      conversionInfo = {
        fromCurrency: balance.dashboardCurrency,
        toCurrency: payoutCurrency,
        exchangeRate: conversion.effectiveRate,
        originalAmount: amount
      };
    }
    
    // For this implementation, we'll deduct from available balance
    // but in a real system, this would create a payout record and handle it asynchronously
    const updatedBalance = await BalanceService.deductFromAvailable(
      merchantId,
      amount,
      'manual-payout-request'
    );
    
    // Return success with payout details
    return successResponse(res, 'Payout requested successfully', {
      payout: {
        amount: payoutAmount,
        currency: payoutCurrency,
        status: 'processing',
        requestedAt: new Date()
      },
      conversionInfo,
      updatedBalance: {
        available: updatedBalance.available,
        currency: updatedBalance.dashboardCurrency
      }
    });
  } catch (error) {
    logger.error('Error requesting payout:', error);
    return errorResponse(res, 'An error occurred while requesting payout', null, 500);
  }
};

// @desc    Get current exchange rates
// @route   GET /api/finance/rates
// @access  Private (merchants only)
export const getExchangeRates = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { base, quote } = req.query;
    
    // Validate input
    if (!base || !quote) {
      return errorResponse(res, 'Base and quote currencies are required', null, 400);
    }
    
    // Get exchange rate
    const rate = await FxService.getCurrentRate(base as string, quote as string);
    
    // Get merchant for FX spread
    const merchantId = req.user.merchantId;
    let spreadRate = null;
    
    if (merchantId) {
      const merchant = await MerchantModel.findById(merchantId);
      if (merchant) {
        // Apply merchant-specific spread if available
        spreadRate = await FxService.applySpread(rate, merchant.fxSpreadPercent);
      }
    }
    
    // If no merchant-specific spread, apply default spread
    if (spreadRate === null) {
      spreadRate = await FxService.applySpread(rate);
    }
    
    return successResponse(res, 'Exchange rates retrieved successfully', {
      base: (base as string).toUpperCase(),
      quote: (quote as string).toUpperCase(),
      rate,
      effectiveRate: spreadRate,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Error retrieving exchange rates:', error);
    return errorResponse(res, 'An error occurred while retrieving exchange rates', null, 500);
  }
};