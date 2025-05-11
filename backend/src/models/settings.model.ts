// src/models/settings.model.ts
// Model for system-wide settings that can be modified by admin

import mongoose, { Document, Schema } from 'mongoose';

export interface ISetting extends Document {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  updatedAt: Date;
  updatedBy?: string;
}

const SettingSchema = new Schema<ISetting>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['string', 'number', 'boolean', 'object', 'array'],
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    updatedBy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get setting by key
SettingSchema.statics.getByKey = async function(key: string): Promise<any> {
  const setting = await this.findOne({ key });
  return setting ? setting.value : null;
};

// Static method to set setting by key
SettingSchema.statics.setByKey = async function(key: string, value: any, updatedBy?: string): Promise<ISetting | null> {
  const setting = await this.findOne({ key });
  
  if (!setting) {
    return null;
  }
  
  setting.value = value;
  if (updatedBy) {
    setting.updatedBy = updatedBy;
  }
  
  return setting.save();
};

// Default settings initialization function
SettingSchema.statics.initDefaults = async function(): Promise<void> {
  const defaults = [
    {
      key: 'fxSpreadPercentDefault',
      value: 1.9,
      type: 'number',
      description: 'Default FX spread percentage applied to currency conversions',
    },
    {
      key: 'maxApiRPS',
      value: 20,
      type: 'number',
      description: 'Maximum API requests per second per client',
    },
    {
      key: 'payoutMinAmount',
      value: { USD: 50, BRL: 250 },
      type: 'object',
      description: 'Minimum amount for automatic payouts in each currency',
    },
    {
      key: 'productRateLimits',
      value: { 
        create: 20, 
        update: 50, 
        list: 100 
      },
      type: 'object',
      description: 'Rate limits for product API endpoints (per hour)',
    },
    {
      key: 'maintenanceMode',
      value: false,
      type: 'boolean',
      description: 'System-wide maintenance mode flag',
    },
    {
      key: 'allowedCurrencies',
      value: ['USD', 'BRL', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
      type: 'array',
      description: 'List of allowed currencies for products',
    },
    {
      key: 'autoFxUpdate',
      value: true,
      type: 'boolean',
      description: 'Whether to automatically update FX rates daily',
    },
    {
      key: 'notificationRetentionDays',
      value: 90,
      type: 'number',
      description: 'Days to keep read notifications before cleanup',
    },
  ];

  for (const setting of defaults) {
    const exists = await this.findOne({ key: setting.key });
    if (!exists) {
      await this.create(setting);
    }
  }
};

export default mongoose.model<ISetting>('Setting', SettingSchema);