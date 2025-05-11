// src/services/cron.service.ts
// Service for handling scheduled jobs (reserve release, notification cleanup)

const cron = require('node-cron');
import BalanceService from './balance.service';
import NotificationService from './notification.service';
import MerchantModel from '../models/merchant.model';
import BalanceModel from '../models/balance.model';
import logger from '../utils/logger';

export class CronService {
  /**
   * Initialize all cron jobs:
   * - Release funds from reserve daily
   * - Cleanup notifications weekly
   */
  public static initializeJobs(): void {
    logger.info('Initializing cron jobs...');

    // Release funds from reserve at 02:00 UTC every day
    cron.schedule('0 2 * * *', () => {
      this.releaseFundsFromReserve();
    });

    // Cleanup old notifications at 03:00 UTC every Sunday
    cron.schedule('0 3 * * 0', () => {
      this.cleanupNotifications();
    });

    logger.info('Cron jobs initialized successfully');
  }

  /**
   * Release placeholder funds from reserve to available for each active merchant.
   */
  private static async releaseFundsFromReserve(): Promise<void> {
    try {
      logger.info('Running release funds from reserve job');

      const merchants = await MerchantModel.find({ status: 'active' });
      let totalProcessed = 0;
      let totalReleased = 0;

      for (const merchant of merchants) {
        try {
          // Placeholder logic: release up to 100 units per merchant
          const balance = await BalanceModel.findOne({ merchantId: merchant._id });
          if (balance && balance.reserve > 0) {
            const released = Math.min(balance.reserve, 100);
            await BalanceService.moveFromReserveToAvailable(
              merchant._id as string,
              released,
              'scheduled-release'
            );
            totalReleased += released;
          }
          totalProcessed++;
        } catch (err) {
          logger.error(
            `Error processing merchant ${merchant._id} for reserve release:`,
            err
          );
        }
      }

      logger.info(
        `Release funds job completed: processed ${totalProcessed} merchants, released ${totalReleased} total`
      );
    } catch (err) {
      logger.error('Error in release funds from reserve job:', err);
    }
  }

  /**
   * Delete read notifications older than retention period.
   */
  private static async cleanupNotifications(): Promise<void> {
    try {
      logger.info('Running notifications cleanup job');

      const retentionDays = 90;
      const deletedCount = await NotificationService.cleanupOldNotifications(retentionDays);

      logger.info(`Notifications cleanup completed: deleted ${deletedCount} old notifications`);
    } catch (err) {
      logger.error('Error in notifications cleanup job:', err);
    }
  }
}

export default CronService;
