// src/models/merchant.model.ts
// Updated Merchant model with currency handling and payout preferences

import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMerchant extends Document {
  businessName: string;
  country: 'US' | 'BR';
  defaultCurrency: 'USD' | 'BRL';
  holdDays: number;
  payoutSchedule: 'manual' | 'weekly' | 'biweekly' | 'monthly';
  sellingMethod: 'hosted_store' | 'integration';
  integrationTypes?: string[];
  status: 'pending_verification' | 'active' | 'suspended';
  firstName?: string;
  lastName?: string;
  
  // Currency-related fields
  dashboardCurrency: 'USD' | 'BRL';       // Currency displayed on dashboard (BRL for Brazil, USD for others)
  fxSpreadPercent: number;                // Merchant-specific FX spread percentage
  payoutCurrency?: 'USD' | 'BRL';         // Currency for payouts
  sellsInternationally: boolean;          // Whether merchant sells outside their country
}

const MerchantSchema = new Schema<IMerchant>(
  {
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      enum: ['US', 'BR'],
      required: true,
    },
    defaultCurrency: {
      type: String,
      enum: ['USD', 'BRL'],
      required: true,
    },
    holdDays: {
      type: Number,
      default: 14,
      enum: [5, 14], // Only allow 5 or 14 days
    },
    payoutSchedule: {
      type: String,
      enum: ['manual', 'weekly', 'biweekly', 'monthly'],
      default: 'manual',
    },
    sellingMethod: {
      type: String,
      enum: ['hosted_store', 'integration'],
      default: 'hosted_store',
    },
    integrationTypes: [{
      type: String,
      enum: ['shopify', 'woocommerce', 'wordpress', 'custom'],
    }],
    status: {
      type: String,
      enum: ['pending_verification', 'active', 'suspended'],
      default: 'pending_verification',
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    
    // Currency-related fields
    dashboardCurrency: {
      type: String,
      enum: ['USD', 'BRL'],
      required: true,
    },
    fxSpreadPercent: {
      type: Number,
      default: null, // Uses global setting if null
      min: 0,
      max: 10, // Cap at 10% to prevent abuse
    },
    payoutCurrency: {
      type: String,
      enum: ['USD', 'BRL'],
    },
    sellsInternationally: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to set default values based on country
MerchantSchema.pre('save', function(next) {
  // If this is a new merchant or country has changed
  if (this.isNew || this.isModified('country')) {
    if (this.country === 'BR') {
      // For Brazilian merchants:
      // - Dashboard currency is always BRL
      // - Default currency is BRL
      // - Payout currency is BRL by default (will be updated to USD if they sell internationally)
      this.dashboardCurrency = 'BRL';
      this.defaultCurrency = 'BRL';
      this.payoutCurrency = this.payoutCurrency || 'BRL';
    } else {
      // For all other merchants:
      // - Dashboard currency is always USD
      // - Default currency is USD
      // - Payout currency is USD by default
      this.dashboardCurrency = 'USD';
      this.defaultCurrency = 'USD';
      this.payoutCurrency = this.payoutCurrency || 'USD';
    }
  }
  
  // When sell internationally flag changes and merchant is from Brazil
  if (this.isModified('sellsInternationally') && this.country === 'BR' && this.sellsInternationally) {
    // Brazilian merchants selling internationally should get paid in USD
    this.payoutCurrency = 'USD';
  }
  
  next();
});

export default mongoose.model<IMerchant>('Merchant', MerchantSchema);