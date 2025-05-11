// src/services/fx.service.ts
// Service for handling currency exchange rates stored in the database

import FxRateModel from '../models/fx-rate.model';
import SettingModel from '../models/settings.model';
import logger from '../utils/logger';

export class FxService {
  /**
   * Get current exchange rate from the database
   * @param baseCurrency Base currency code (e.g., 'USD')
   * @param quoteCurrency Quote currency code (e.g., 'BRL')
   * @returns The current exchange rate
   */
  public static async getCurrentRate(
    baseCurrency: string,
    quoteCurrency: string
  ): Promise<number> {
    baseCurrency = baseCurrency.toUpperCase();
    quoteCurrency = quoteCurrency.toUpperCase();

    // Same currency => rate 1
    if (baseCurrency === quoteCurrency) {
      return 1;
    }

    // Fetch the latest active rate snapshot from MongoDB
    const record = await (FxRateModel as any).getCurrentRate(
      baseCurrency,
      quoteCurrency
    );

    if (record) {
      return record.rate;
    }

    // If no rate found, use hardcoded fallback rates for USD/BRL only
    // This is a temporary solution for the MVP
    if ((baseCurrency === 'USD' && quoteCurrency === 'BRL') || 
        (baseCurrency === 'BRL' && quoteCurrency === 'USD')) {
      
      // Current USD to BRL rate (as of May 2025)
      const usdToBrl = 5.88;
      
      if (baseCurrency === 'USD' && quoteCurrency === 'BRL') {
        return usdToBrl;
      } else {
        // BRL to USD
        return 1 / usdToBrl;
      }
    }

    throw new Error(`Exchange rate for ${baseCurrency}/${quoteCurrency} not found`);
  }

  /**
   * Snapshot a provided rate into the database
   * @param baseCurrency Base currency code
   * @param quoteCurrency Quote currency code
   * @param rate The rate to store
   */
  public static async takeRateSnapshot(
    baseCurrency: string,
    quoteCurrency: string,
    rate: number
  ): Promise<void> {
    try {
      await (FxRateModel as any).snapshotRate(
        baseCurrency.toUpperCase(),
        quoteCurrency.toUpperCase(),
        rate,
        'manual'
      );
      logger.info(
        `Manual FX rate snapshot taken: ${baseCurrency.toUpperCase()}/${quoteCurrency.toUpperCase()} = ${rate}`
      );
    } catch (error) {
      logger.error(`Failed to snapshot FX rate: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get the default FX spread percentage from settings
   * @returns Default FX spread percentage
   */
  public static async getDefaultSpread(): Promise<number> {
    try {
      const defaultSpreadPct = 
        (await (SettingModel as any).getByKey('fxSpreadPercentDefault')) || 1.9;
      return defaultSpreadPct;
    } catch (error) {
      logger.error(`Error getting default FX spread: ${(error as Error).message}`);
      // Fallback to a safe default spread of 1.5%
      return 1.5;
    }
  }

  /**
   * Apply FX spread to a rate based on merchant or global settings
   * @param rate Base exchange rate
   * @param merchantSpreadPct Optional merchant-specific spread percentage
   * @returns Rate after spread applied
   */
  public static async applySpread(
    rate: number,
    merchantSpreadPct?: number | null
  ): Promise<number> {
    try {
      // If merchant-specific spread provided, use it
      if (merchantSpreadPct != null) {
        // Apply spread by reducing the rate slightly (so we make a margin)
        // For example, if USD to BRL is 5.88 and spread is 1.9%, 
        // we'll use 5.77 (meaning the merchant gets slightly less BRL per USD)
        return rate * (1 - merchantSpreadPct / 100);
      }
      
      // Otherwise use global default spread
      const defaultSpreadPct = await this.getDefaultSpread();
      return rate * (1 - defaultSpreadPct / 100);
    } catch (error) {
      logger.error(`Error applying FX spread: ${(error as Error).message}`);
      // Fallback to a safe default spread of 1.5%
      return rate * 0.985;
    }
  }

  /**
   * Convert an amount from one currency to another, applying spread
   * @param amount Amount to convert
   * @param fromCurrency Source currency code
   * @param toCurrency Target currency code
   * @param merchantSpreadPct Optional merchant-specific spread
   * @returns Object containing convertedAmount and effectiveRate
   */
  public static async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    merchantSpreadPct?: number | null
  ): Promise<{ convertedAmount: number; effectiveRate: number }> {
    // No conversion needed if currencies match
    if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
      return { convertedAmount: amount, effectiveRate: 1 };
    }

    // Retrieve the base rate
    const baseRate = await this.getCurrentRate(fromCurrency, toCurrency);
    
    // Apply spread to get effective rate (the rate we'll use for the merchant)
    const effectiveRate = await this.applySpread(baseRate, merchantSpreadPct);
    
    // Compute converted amount, rounded to 2 decimals
    const convertedAmount = parseFloat((amount * effectiveRate).toFixed(2));

    return { convertedAmount, effectiveRate };
  }
  
  /**
   * Get all supported currencies
   * @returns Array of supported currency codes
   */
  public static async getSupportedCurrencies(): Promise<string[]> {
    try {
      // For MVP, just hardcode the two main currencies
      return ['USD', 'BRL'];
    } catch (error) {
      logger.error(`Error getting supported currencies: ${(error as Error).message}`);
      // Fallback to USD and BRL
      return ['USD', 'BRL'];
    }
  }
  
  /**
   * Force refresh all exchange rates from an external source
   * This would connect to a real FX API in production
   */
  public static async refreshAllRates(): Promise<boolean> {
    try {
      // For MVP, just update the USD/BRL rate
      // In production, this would call an external FX API
      const currentUsdToBrl = 5.88;
      
      // Take snapshot of USD to BRL
      await this.takeRateSnapshot('USD', 'BRL', currentUsdToBrl);
      
      // Take snapshot of BRL to USD
      await this.takeRateSnapshot('BRL', 'USD', 1 / currentUsdToBrl);
      
      logger.info('Successfully refreshed all FX rates');
      return true;
    } catch (error) {
      logger.error(`Error refreshing FX rates: ${(error as Error).message}`);
      return false;
    }
  }
}

export default FxService;