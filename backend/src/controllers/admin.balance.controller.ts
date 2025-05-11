// src/controllers/admin.balance.controller.ts
import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import BalanceService from '../services/balance.service';
import FxService from '../services/fx.service';
import BalanceModel from '../models/balance.model';
import MerchantModel from '../models/merchant.model';
import SettingModel from '../models/settings.model';
import FxRateModel from '../models/fx-rate.model';
import NotificationService from '../services/notification.service';
import UserModel from '../models/user.model';
import logger from '../utils/logger';

// @desc    Admin - Get merchant balance
// @route   GET /api/admin/finance/:merchantId
// @access  Admin only
export const adminGetMerchantBalance = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { merchantId } = req.params;

    // Get balance
    const balance = await BalanceService.getBalance(merchantId);

    // Get merchant
    const merchant = await MerchantModel.findById(merchantId);

    if (!merchant) {
      return errorResponse(res, 'Merchant not found', null, 404);
    }

    // Get user for contact info
    const user = await UserModel.findOne({ merchantId });

    return successResponse(res, 'Merchant balance retrieved successfully', {
      balance: {
        reserve: balance.reserve,
        available: balance.available,
        pending: balance.pending,
        totalBalance: balance.totalBalance,
        currency: balance.dashboardCurrency,
      },
      merchant: {
        businessName: merchant.businessName,
        country: merchant.country,
        dashboardCurrency: merchant.dashboardCurrency,
        payoutCurrency: merchant.payoutCurrency,
        holdDays: merchant.holdDays,
        fxSpreadPercent: merchant.fxSpreadPercent,
        sellsInternationally: merchant.sellsInternationally
      },
      user: user
        ? {
            email: user.email,
            idVerified: user.idCheckStatus === 'verified',
          }
        : null,
    });
  } catch (error) {
    logger.error('Admin - Error retrieving merchant balance:', error);
    return errorResponse(
      res,
      'An error occurred while retrieving merchant balance',
      null,
      500
    );
  }
};

// @desc    Admin - Adjust merchant balance
// @route   PATCH /api/admin/finance/:merchantId/balance
// @access  Admin only with full access
export const adminAdjustMerchantBalance = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { merchantId } = req.params;
    const { reserve, available, pending, reason } = req.body;

    // Check for full access
    if (!req.adminUser?.hasFullAccess) {
      return errorResponse(
        res,
        'This operation requires admin access key',
        null,
        403
      );
    }

    // Validate input
    if (
      (reserve === undefined &&
        available === undefined &&
        pending === undefined) ||
      !reason
    ) {
      return errorResponse(
        res,
        'At least one balance adjustment and reason are required',
        null,
        400
      );
    }

    // Get merchant
    const merchant = await MerchantModel.findById(merchantId);

    if (!merchant) {
      return errorResponse(res, 'Merchant not found', null, 404);
    }

    // Create adjustments object
    const adjustments: any = {};

    if (reserve !== undefined) {
      adjustments.reserve = parseFloat(reserve);
    }

    if (available !== undefined) {
      adjustments.available = parseFloat(available);
    }

    if (pending !== undefined) {
      adjustments.pending = parseFloat(pending);
    }

    // Adjust balance
    const updatedBalance = await BalanceService.adminAdjustBalance(
      merchantId,
      adjustments,
      reason,
      req.adminUser.username
    );

    // Find user to notify
    const user = await UserModel.findOne({ merchantId });

    if (user) {
      // Prepare notification message
      let adjustmentText = '';

      if (reserve !== undefined) {
        adjustmentText += `Reserve: ${
          reserve > 0 ? '+' : ''
        }${reserve} ${updatedBalance.dashboardCurrency}. `;
      }

      if (available !== undefined) {
        adjustmentText += `Available: ${
          available > 0 ? '+' : ''
        }${available} ${updatedBalance.dashboardCurrency}. `;
      }

      if (pending !== undefined) {
        adjustmentText += `Pending: ${
          pending > 0 ? '+' : ''
        }${pending} ${updatedBalance.dashboardCurrency}. `;
      }

      // Create notification for the merchant
      await NotificationService.createNotification(
        (user._id as mongoose.Types.ObjectId).toString(),
        'finance',
        'Balance Adjusted by Administrator',
        `Your account balance has been adjusted by an administrator. ${adjustmentText}Reason: ${reason}`,
        {
          adjustments,
          reason,
          adjustedBy: req.adminUser.username,
          timestamp: new Date(),
        }
      );
    }

    return successResponse(
      res,
      'Merchant balance adjusted successfully',
      {
        balance: {
          reserve: updatedBalance.reserve,
          available: updatedBalance.available,
          pending: updatedBalance.pending,
          totalBalance: updatedBalance.totalBalance,
          currency: updatedBalance.dashboardCurrency,
        },
        adjustments,
        reason,
      }
    );
  } catch (error) {
    logger.error('Admin - Error adjusting merchant balance:', error);
    return errorResponse(
      res,
      'An error occurred while adjusting merchant balance',
      null,
      500
    );
  }
};

// @desc    Admin - Change merchant currency settings
// @route   PATCH /api/admin/finance/:merchantId/currency
// @access  Admin only with full access
export const adminChangeMerchantCurrency = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { merchantId } = req.params;
    const { dashboardCurrency, payoutCurrency, fxSpreadPercent, sellsInternationally } = req.body;

    // Check for full access
    if (!req.adminUser?.hasFullAccess) {
      return errorResponse(
        res,
        'This operation requires admin access key',
        null,
        403
      );
    }

    // Validate input
    if (
      !dashboardCurrency &&
      !payoutCurrency &&
      fxSpreadPercent === undefined &&
      sellsInternationally === undefined
    ) {
      return errorResponse(
        res,
        'At least one currency setting must be provided',
        null,
        400
      );
    }

    // Get merchant
    const merchant = await MerchantModel.findById(merchantId);

    if (!merchant) {
      return errorResponse(res, 'Merchant not found', null, 404);
    }

    // Prepare updates
    const updates: any = {};
    const oldValues: any = {
      dashboardCurrency: merchant.dashboardCurrency,
      payoutCurrency: merchant.payoutCurrency,
      fxSpreadPercent: merchant.fxSpreadPercent,
      sellsInternationally: merchant.sellsInternationally
    };

    if (dashboardCurrency) {
      // Validate currency
      if (!['USD', 'BRL'].includes(dashboardCurrency)) {
        return errorResponse(
          res,
          'Invalid dashboard currency. Must be USD or BRL.',
          null,
          400
        );
      }

      updates.dashboardCurrency = dashboardCurrency;
    }

    if (payoutCurrency) {
      // Validate currency
      if (!['USD', 'BRL'].includes(payoutCurrency)) {
        return errorResponse(
          res,
          'Invalid payout currency. Must be USD or BRL.',
          null,
          400
        );
      }

      updates.payoutCurrency = payoutCurrency;
    }

    if (fxSpreadPercent !== undefined) {
      // Validate spread
      if (
        isNaN(parseFloat(fxSpreadPercent as any)) ||
        parseFloat(fxSpreadPercent as any) < 0 ||
        parseFloat(fxSpreadPercent as any) > 10
      ) {
        return errorResponse(
          res,
          'FX spread percentage must be a number between 0 and 10',
          null,
          400
        );
      }

      updates.fxSpreadPercent = parseFloat(fxSpreadPercent as any);
    }
    
    if (sellsInternationally !== undefined) {
      updates.sellsInternationally = Boolean(sellsInternationally);
      
      // If Brazilian merchant is set to sell internationally, ensure payoutCurrency is USD
      if (updates.sellsInternationally && merchant.country === 'BR' && !updates.payoutCurrency) {
        updates.payoutCurrency = 'USD';
      }
    }

    // Update merchant
    const updatedMerchant = await MerchantModel.findByIdAndUpdate(
      merchantId,
      updates,
      { new: true }
    );

    // If dashboard currency changed, also update balance
    if (
      dashboardCurrency &&
      dashboardCurrency !== oldValues.dashboardCurrency
    ) {
      await BalanceModel.findOneAndUpdate(
        { merchantId },
        { dashboardCurrency }
      );
    }

    // Find user to notify
    const user = await UserModel.findOne({ merchantId });

    if (user) {
      // Create notification for the merchant
      await NotificationService.createNotification(
        (user._id as mongoose.Types.ObjectId).toString(),
        'finance',
        'Currency Settings Updated',
        'Your account currency settings have been updated by an administrator.',
        {
          oldValues,
          newValues: updates,
          updatedBy: req.adminUser.username,
          timestamp: new Date(),
        }
      );
    }

    return successResponse(res, 'Merchant currency settings updated successfully', {
      merchant: {
        dashboardCurrency: updatedMerchant?.dashboardCurrency,
        payoutCurrency: updatedMerchant?.payoutCurrency,
        fxSpreadPercent: updatedMerchant?.fxSpreadPercent,
        sellsInternationally: updatedMerchant?.sellsInternationally
      },
      updated: Object.keys(updates),
    });
  } catch (error) {
    logger.error('Admin - Error changing merchant currency settings:', error);
    return errorResponse(
      res,
      'An error occurred while changing merchant currency settings',
      null,
      500
    );
  }
};

// @desc    Admin - Get current FX rates
// @route   GET /api/admin/finance/fx-rates
// @access  Admin only
export const adminGetFxRates = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Get current rates from database
    const rates = await FxRateModel.find({ effectiveTo: null }).sort({
      baseCurrency: 1,
      quoteCurrency: 1,
    });

    // Get default spread setting
    const defaultSpread = await FxService.getDefaultSpread();

    // If no rates exist yet, include the hardcoded fallback rates
    let displayRates = rates;
    
    if (rates.length === 0) {
      // Create display-only rate objects - not trying to be Mongoose documents
      displayRates = [
        {
          _id: 'temp-usd-brl',
          baseCurrency: 'USD',
          quoteCurrency: 'BRL',
          rate: 5.88,
          source: 'hardcoded-fallback',
          fetchedAt: new Date(),
          effectiveFrom: new Date(),
          effectiveTo: null
        } as any,
        {
          _id: 'temp-brl-usd',
          baseCurrency: 'BRL',
          quoteCurrency: 'USD',
          rate: 1/5.88,
          source: 'hardcoded-fallback',
          fetchedAt: new Date(),
          effectiveFrom: new Date(),
          effectiveTo: null
        } as any
      ];
    }

    return successResponse(res, 'FX rates retrieved successfully', {
      rates: displayRates,
      defaultSpread,
      timestamp: new Date(),
      supported: await FxService.getSupportedCurrencies()
    });
  } catch (error) {
    logger.error('Admin - Error retrieving FX rates:', error);
    return errorResponse(
      res,
      'An error occurred while retrieving FX rates',
      null,
      500
    );
  }
};

// @desc    Admin - Update FX settings
// @route   PATCH /api/admin/settings/fx
// @access  Admin only with full access
export const adminUpdateFxSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { defaultSpread, autoFxUpdate } = req.body;

    // Check for full access
    if (!req.adminUser?.hasFullAccess) {
      return errorResponse(
        res,
        'This operation requires admin access key',
        null,
        403
      );
    }

    // Validate input
    if (defaultSpread === undefined && autoFxUpdate === undefined) {
      return errorResponse(
        res,
        'At least one setting must be provided',
        null,
        400
      );
    }

    const updates: string[] = [];

    if (defaultSpread !== undefined) {
      if (
        isNaN(parseFloat(defaultSpread as any)) ||
        parseFloat(defaultSpread as any) < 0 ||
        parseFloat(defaultSpread as any) > 10
      ) {
        return errorResponse(
          res,
          'Default FX spread percentage must be a number between 0 and 10',
          null,
          400
        );
      }

      await (SettingModel as any).setByKey(
        'fxSpreadPercentDefault',
        parseFloat(defaultSpread as any),
        req.adminUser.username
      );
      updates.push('defaultSpread');
    }

    if (autoFxUpdate !== undefined) {
      await (SettingModel as any).setByKey(
        'autoFxUpdate',
        Boolean(autoFxUpdate),
        req.adminUser.username
      );
      updates.push('autoFxUpdate');
    }

    const currentSettings = {
      defaultSpread: await (SettingModel as any).getByKey(
        'fxSpreadPercentDefault'
      ),
      autoFxUpdate: await (SettingModel as any).getByKey('autoFxUpdate'),
    };

    return successResponse(res, 'FX settings updated successfully', {
      settings: currentSettings,
      updated: updates,
    });
  } catch (error) {
    logger.error('Admin - Error updating FX settings:', error);
    return errorResponse(
      res,
      'An error occurred while updating FX settings',
      null,
      500
    );
  }
};

// @desc    Admin - Force update FX rates (manual snapshot)
// @route   POST /api/admin/finance/fx-rates/update
// @access  Admin only with full access
export const adminForceUpdateFxRates = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { baseCurrency, quoteCurrency, rate } = req.body;

    // Check for full access
    if (!req.adminUser?.hasFullAccess) {
      return errorResponse(
        res,
        'This operation requires admin access key',
        null,
        403
      );
    }

    // Validate input
    if (!baseCurrency || !quoteCurrency || rate === undefined) {
      return errorResponse(
        res,
        'Base currency, quote currency and rate are required',
        null,
        400
      );
    }

    const numericRate = parseFloat(rate as any);
    if (isNaN(numericRate) || numericRate <= 0) {
      return errorResponse(res, 'Rate must be a positive number', null, 400);
    }

    // Snapshot the provided rate
    await FxService.takeRateSnapshot(
      baseCurrency,
      quoteCurrency,
      numericRate
    );
    
    // Also add the inverse rate automatically
    const inverseRate = 1 / numericRate;
    await FxService.takeRateSnapshot(
      quoteCurrency,
      baseCurrency,
      inverseRate
    );

    return successResponse(res, 'FX rates updated successfully', {
      rates: [
        {
          baseCurrency,
          quoteCurrency,
          rate: numericRate
        },
        {
          baseCurrency: quoteCurrency,
          quoteCurrency: baseCurrency,
          rate: inverseRate
        }
      ],
      updatedAt: new Date(),
      updatedBy: req.adminUser.username,
    });
  } catch (error) {
    logger.error('Admin - Error updating FX rates:', error);
    return errorResponse(
      res,
      'An error occurred while updating FX rates',
      null,
      500
    );
  }
};

// @desc    Admin - Refresh all FX rates from external source
// @route   POST /api/admin/finance/fx-rates/refresh-all
// @access  Admin only with full access
export const adminRefreshAllFxRates = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Check for full access
    if (!req.adminUser?.hasFullAccess) {
      return errorResponse(
        res,
        'This operation requires admin access key',
        null,
        403
      );
    }
    
    // Force refresh all rates
    const success = await FxService.refreshAllRates();
    
    if (!success) {
      return errorResponse(
        res,
        'Failed to refresh FX rates from external source',
        null,
        500
      );
    }
    
    // Get the updated rates
    const rates = await FxRateModel.find({ effectiveTo: null }).sort({
      baseCurrency: 1,
      quoteCurrency: 1,
    });

    return successResponse(res, 'All FX rates refreshed successfully', {
      rates,
      updatedAt: new Date(),
      updatedBy: req.adminUser.username,
    });
  } catch (error) {
    logger.error('Admin - Error refreshing all FX rates:', error);
    return errorResponse(
      res,
      'An error occurred while refreshing FX rates',
      null,
      500
    );
  }
};

// @desc    Admin - Get merchant transactions
// @route   GET /api/admin/finance/:merchantId/transactions
// @access  Admin only
export const adminGetMerchantTransactions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { merchantId } = req.params;
    const { page, limit, status, fromDate, toDate, sortBy, sortOrder } =
      req.query;

    // Verify merchant exists
    const merchant = await MerchantModel.findById(merchantId);

    if (!merchant) {
      return errorResponse(res, 'Merchant not found', null, 404);
    }

    // Build query placeholder
    const query: any = { merchantId };

    if (status) {
      query.status = status;
    }
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        query.createdAt.$gte = new Date(fromDate as string);
      }
      if (toDate) {
        query.createdAt.$lte = new Date(toDate as string);
      }
    }

    const pageNum = page ? parseInt(page as string) : 1;
    const limitNum = limit ? parseInt(limit as string) : 20;
    const skip = (pageNum - 1) * limitNum;

    const sort: any = {};
    const sortField = (sortBy as string) || 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    sort[sortField] = sortDirection;

    // Placeholder empty result
    const transactions: any[] = [];
    const total = 0;

    return successResponse(
      res,
      'Merchant transactions retrieved successfully',
      {
        merchant: {
          id: merchantId,
          businessName: merchant.businessName,
          country: merchant.country,
          dashboardCurrency: merchant.dashboardCurrency,
        },
        transactions,
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      }
    );
  } catch (error) {
    logger.error('Admin - Error retrieving merchant transactions:', error);
    return errorResponse(
      res,
      'An error occurred while retrieving merchant transactions',
      null,
      500
    );
  }
};