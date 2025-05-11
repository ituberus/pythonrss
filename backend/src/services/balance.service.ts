// src/services/balance.service.ts
// Service for managing merchant balances, including reserve and available funds

import mongoose, { Types } from 'mongoose';
import BalanceModel, { IBalance } from '../models/balance.model';
import MerchantModel from '../models/merchant.model';
import FxService from './fx.service';
import logger from '../utils/logger';

export class BalanceService {
  /**
   * Initialize a merchant's balance if it doesn't exist
   * @param merchantId Merchant ID
   * @returns The merchant's balance document
   */
  public static async ensureBalanceExists(merchantId: string | Types.ObjectId): Promise<IBalance> {
    try {
      // Try to find existing balance
      let balance = await BalanceModel.findOne({ merchantId });
      
      // If it doesn't exist, create it
      if (!balance) {
        // Get merchant to determine dashboard currency
        const merchant = await MerchantModel.findById(merchantId);
        if (!merchant) {
          throw new Error(`Merchant not found: ${merchantId}`);
        }
        
        // Use the merchant's country to determine dashboard currency
        // Brazilian merchants see their dashboard in BRL, everyone else in USD
        const dashboardCurrency = merchant.country === 'BR' ? 'BRL' : 'USD';
        
        // Create new balance with zero amounts
        balance = await BalanceModel.create({
          merchantId,
          dashboardCurrency,
          reserve: 0,
          available: 0,
          pending: 0,
        });
        
        logger.info(`Created new balance for merchant ${merchantId} with dashboard currency ${dashboardCurrency}`);
      }
      
      return balance;
    } catch (error) {
      logger.error(`Error ensuring balance exists: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get a merchant's current balance
   * @param merchantId Merchant ID
   * @returns The merchant's balance
   */
  public static async getBalance(merchantId: string | Types.ObjectId): Promise<IBalance> {
    return this.ensureBalanceExists(merchantId);
  }

  /**
   * Add funds to a merchant's reserve balance (e.g., from a new order)
   * @param merchantId Merchant ID
   * @param amount Amount to add
   * @param currency Currency of the amount
   * @param reference Reference ID (e.g., order ID)
   * @returns Updated balance
   */
  public static async addToReserve(
    merchantId: string | Types.ObjectId,
    amount: number,
    currency: string,
    reference: string
  ): Promise<IBalance> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Get merchant to determine dashboard currency and FX spread
      const merchant = await MerchantModel.findById(merchantId);
      if (!merchant) {
        throw new Error(`Merchant not found: ${merchantId}`);
      }

      // Get or create balance
      const balance = await this.ensureBalanceExists(merchantId);

      // If currencies don't match, convert the amount
      // Apply the FX spread as described by Ryan - we will take a small percentage
      let amountInDashboardCurrency = amount;
      let conversionDetails: {
        originalAmount: number;
        originalCurrency: string;
        convertedAmount: number;
        convertedCurrency: string;
        effectiveRate: number;
        appliedSpread: number;
      } | null = null;

      if (currency !== balance.dashboardCurrency) {
        const { convertedAmount, effectiveRate } = await FxService.convertCurrency(
          amount,
          currency,
          balance.dashboardCurrency,
          merchant.fxSpreadPercent
        );

        amountInDashboardCurrency = convertedAmount;
        conversionDetails = {
          originalAmount: amount,
          originalCurrency: currency,
          convertedAmount: convertedAmount,
          convertedCurrency: balance.dashboardCurrency,
          effectiveRate: effectiveRate,
          appliedSpread: merchant.fxSpreadPercent || await FxService.getDefaultSpread()
        };

        logger.info(
          `Converted ${amount} ${currency} to ${convertedAmount} ${balance.dashboardCurrency} for merchant ${merchantId} with rate ${effectiveRate}`
        );
      }

      // Update reserve balance (rounding to 2 decimal places)
      const newReserve = parseFloat((balance.reserve + amountInDashboardCurrency).toFixed(2));

      // Update balance in database
      const updatedBalance = await BalanceModel.findByIdAndUpdate(
        balance._id,
        { reserve: newReserve },
        { new: true, session }
      );

      await session.commitTransaction();

      logger.info(
        `Added ${amountInDashboardCurrency} ${balance.dashboardCurrency} to reserve for merchant ${merchantId} (original: ${amount} ${currency}, reference: ${reference})`
      );

      return updatedBalance!;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error adding to reserve: ${(error as Error).message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Move funds from reserve to available (e.g., after hold period)
   * @param merchantId Merchant ID
   * @param amount Amount to move
   * @param reference Reference ID
   * @returns Updated balance
   */
  public static async moveFromReserveToAvailable(
    merchantId: string | Types.ObjectId,
    amount: number,
    reference: string
  ): Promise<IBalance> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Get balance
      const balance = await BalanceModel.findOne({ merchantId });
      if (!balance) {
        throw new Error(`Balance not found for merchant ${merchantId}`);
      }

      // Verify sufficient funds in reserve
      if (balance.reserve < amount) {
        throw new Error(`Insufficient reserve balance: ${balance.reserve} < ${amount}`);
      }

      // Round to 2 decimal places
      const newReserve = parseFloat((balance.reserve - amount).toFixed(2));
      const newAvailable = parseFloat((balance.available + amount).toFixed(2));

      // Update balance in database
      const updatedBalance = await BalanceModel.findByIdAndUpdate(
        balance._id,
        { reserve: newReserve, available: newAvailable },
        { new: true, session }
      );

      await session.commitTransaction();

      logger.info(
        `Moved ${amount} ${balance.dashboardCurrency} from reserve to available for merchant ${merchantId} (reference: ${reference})`
      );

      return updatedBalance!;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error moving funds from reserve to available: ${(error as Error).message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Deduct funds from available balance (e.g., for payout)
   * @param merchantId Merchant ID
   * @param amount Amount to deduct
   * @param reference Reference ID
   * @returns Updated balance
   */
  public static async deductFromAvailable(
    merchantId: string | Types.ObjectId,
    amount: number,
    reference: string
  ): Promise<IBalance> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Get balance
      const balance = await BalanceModel.findOne({ merchantId });
      if (!balance) {
        throw new Error(`Balance not found for merchant ${merchantId}`);
      }

      // Verify sufficient funds in available
      if (balance.available < amount) {
        throw new Error(`Insufficient available balance: ${balance.available} < ${amount}`);
      }

      // Round to 2 decimal places
      const newAvailable = parseFloat((balance.available - amount).toFixed(2));

      // Update balance in database
      const updatedBalance = await BalanceModel.findByIdAndUpdate(
        balance._id,
        { available: newAvailable },
        { new: true, session }
      );

      await session.commitTransaction();

      logger.info(
        `Deducted ${amount} ${balance.dashboardCurrency} from available for merchant ${merchantId} (reference: ${reference})`
      );

      return updatedBalance!;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error deducting from available: ${(error as Error).message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Check if a merchant sells internationally (needs balance in USD)
   * @param merchantId Merchant ID
   * @returns True if merchant sells internationally 
   */
  public static async checkSellsInternationally(merchantId: string | Types.ObjectId): Promise<boolean> {
    try {
      const merchant = await MerchantModel.findById(merchantId);
      if (!merchant) {
        throw new Error(`Merchant not found: ${merchantId}`);
      }
      
      return merchant.sellsInternationally || false;
    } catch (error) {
      logger.error(`Error checking if merchant sells internationally: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Update merchant's currency settings based on their sales
   * For Brazilian merchants, if they sell abroad, update settings to show Finance in USD
   * @param merchantId Merchant ID
   * @param internationalSales Boolean indicating if merchant sells internationally
   */
  public static async updateMerchantCurrencySettings(
    merchantId: string | Types.ObjectId,
    internationalSales: boolean
  ): Promise<void> {
    try {
      const merchant = await MerchantModel.findById(merchantId);
      if (!merchant) {
        throw new Error(`Merchant not found: ${merchantId}`);
      }

      // Only update if this is a change
      if (merchant.sellsInternationally !== internationalSales) {
        // For Brazilian merchants who start selling internationally, make sure they can see USD in Finance
        if (merchant.country === 'BR' && internationalSales) {
          await MerchantModel.findByIdAndUpdate(merchantId, {
            sellsInternationally: true,
            payoutCurrency: 'USD' // They need to receive USD payouts for international sales
          });

          logger.info(`Updated Brazilian merchant ${merchantId} to sell internationally with USD payouts`);
        } else {
          await MerchantModel.findByIdAndUpdate(merchantId, {
            sellsInternationally: internationalSales
          });

          logger.info(`Updated merchant ${merchantId} international sales flag to ${internationalSales}`);
        }
      }
    } catch (error) {
      logger.error(`Error updating merchant currency settings: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Handle refund by deducting from appropriate balance bucket
   * @param merchantId Merchant ID
   * @param amount Refund amount
   * @param currency Currency of the refund
   * @param reference Reference ID
   * @returns Updated balance
   */
  public static async handleRefund(
    merchantId: string | Types.ObjectId,
    amount: number,
    currency: string,
    reference: string
  ): Promise<IBalance> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Get merchant to determine dashboard currency and FX spread
      const merchant = await MerchantModel.findById(merchantId);
      if (!merchant) {
        throw new Error(`Merchant not found: ${merchantId}`);
      }

      // Get balance
      const balance = await BalanceModel.findOne({ merchantId });
      if (!balance) {
        throw new Error(`Balance not found for merchant ${merchantId}`);
      }

      // Convert amount if needed
      let amountInDashboardCurrency = amount;

      if (currency !== balance.dashboardCurrency) {
        const { convertedAmount } = await FxService.convertCurrency(
          amount,
          currency,
          balance.dashboardCurrency,
          merchant.fxSpreadPercent
        );

        amountInDashboardCurrency = convertedAmount;
      }

      // Determine where to deduct from (reserve first, then available)
      let newReserve = balance.reserve;
      let newAvailable = balance.available;

      if (newReserve >= amountInDashboardCurrency) {
        // Sufficient funds in reserve - deduct from there
        newReserve = parseFloat((newReserve - amountInDashboardCurrency).toFixed(2));
      } else {
        // Deduct what we can from reserve
        const remainingAmount = amountInDashboardCurrency - newReserve;
        newReserve = 0;

        // Then deduct remainder from available
        if (newAvailable >= remainingAmount) {
          newAvailable = parseFloat((newAvailable - remainingAmount).toFixed(2));
        } else {
          // Not enough funds - this is a negative balance situation
          newAvailable = 0;
          logger.warning(
            `Refund creates negative balance for merchant ${merchantId}: ${amountInDashboardCurrency} > ${balance.reserve + balance.available}`
          );
        }
      }

      // Update balance in database
      const updatedBalance = await BalanceModel.findByIdAndUpdate(
        balance._id,
        { reserve: newReserve, available: newAvailable },
        { new: true, session }
      );

      await session.commitTransaction();

      logger.info(
        `Processed refund of ${amountInDashboardCurrency} ${balance.dashboardCurrency} for merchant ${merchantId} (reference: ${reference})`
      );

      return updatedBalance!;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error handling refund: ${(error as Error).message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Admin function to adjust a merchant's balance with an audit trail
   * @param merchantId Merchant ID
   * @param adjustments Adjustments to each balance bucket
   * @param reason Reason for adjustment
   * @param adminId Admin user ID
   * @returns Updated balance
   */
  public static async adminAdjustBalance(
    merchantId: string | Types.ObjectId,
    adjustments: {
      reserve?: number;
      available?: number;
      pending?: number;
    },
    reason: string,
    adminId: string
  ): Promise<IBalance> {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // Get balance
      const balance = await BalanceModel.findOne({ merchantId });
      if (!balance) {
        throw new Error(`Balance not found for merchant ${merchantId}`);
      }

      // Calculate new values (ensure we have at least 0)
      const updates: any = {};

      if (adjustments.reserve !== undefined) {
        updates.reserve = Math.max(0, parseFloat((balance.reserve + adjustments.reserve).toFixed(2)));
      }

      if (adjustments.available !== undefined) {
        updates.available = Math.max(0, parseFloat((balance.available + adjustments.available).toFixed(2)));
      }

      if (adjustments.pending !== undefined) {
        updates.pending = Math.max(0, parseFloat((balance.pending + adjustments.pending).toFixed(2)));
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No valid adjustments provided');
      }

      // Update balance in database
      const updatedBalance = await BalanceModel.findByIdAndUpdate(
        balance._id,
        updates,
        { new: true, session }
      );

      // Log adjustment for audit trail
      // In a real system, this would log to a dedicated audit collection
      logger.info(
        `Admin ${adminId} adjusted balance for merchant ${merchantId}: ${JSON.stringify(adjustments)} - Reason: ${reason}`
      );

      await session.commitTransaction();

      return updatedBalance!;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error in admin balance adjustment: ${(error as Error).message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export default BalanceService;
