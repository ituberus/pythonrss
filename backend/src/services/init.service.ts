// src/services/init.service.ts
// Service for initializing application settings and defaults (FX initialization is now manual)

import SettingModel from '../models/settings.model';
import CronService from './cron.service';
import logger from '../utils/logger';

export class InitService {
  /**
   * Initialize the application
   * - Set up default settings
   * - Start cron jobs (FX jobs removed; rates are managed manually via admin endpoint)
   */
  public static async initialize(): Promise<void> {
    try {
      logger.info('Initializing application...');

      // Initialize default settings
      await this.initializeSettings();

      // Skip automatic FX initialization
      logger.info(
        'Skipping automatic FX rates initialization; rates will be managed manually via admin endpoint'
      );

      // Start cron jobs
      CronService.initializeJobs();

      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Error initializing application:', error);
      throw error;
    }
  }

  /**
   * Initialize default settings
   */
  private static async initializeSettings(): Promise<void> {
    try {
      logger.info('Initializing default settings...');

      // Ensure settings collection exists and has defaults
      await (SettingModel as any).initDefaults();

      logger.info('Default settings initialized successfully');
    } catch (error) {
      logger.error('Error initializing default settings:', error);
      throw error;
    }
  }
}

export default InitService;
