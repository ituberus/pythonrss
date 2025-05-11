// src/models/fx-rate.model.ts
// Model for storing currency exchange rate snapshots to ensure consistent rates

import mongoose, { Document, Schema } from 'mongoose';

export interface IFxRate extends Document {
  baseCurrency: string;       // Base currency (e.g., 'USD')
  quoteCurrency: string;      // Quote currency (e.g., 'BRL')
  rate: number;               // Exchange rate (e.g., 5.88 for USD to BRL)
  source: string;             // Source of the rate (e.g., 'external-api')
  fetchedAt: Date;            // When the rate was fetched
  effectiveFrom: Date;        // When the rate becomes effective
  effectiveTo?: Date | null;  // When the rate expires (null for current rate)
}

const FxRateSchema = new Schema<IFxRate>(
  {
    baseCurrency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    quoteCurrency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    fetchedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    effectiveFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for efficient queries
FxRateSchema.index({ baseCurrency: 1, quoteCurrency: 1, effectiveFrom: -1 });
FxRateSchema.index({ baseCurrency: 1, quoteCurrency: 1, effectiveTo: 1 });
FxRateSchema.index({ fetchedAt: -1 });

// Static method to get current exchange rate
FxRateSchema.statics.getCurrentRate = async function(baseCurrency: string, quoteCurrency: string): Promise<IFxRate | null> {
  return this.findOne({
    baseCurrency: baseCurrency.toUpperCase(),
    quoteCurrency: quoteCurrency.toUpperCase(),
    effectiveFrom: { $lte: new Date() },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gt: new Date() } }
    ]
  }).sort({ effectiveFrom: -1 });
};

// Static method to get historical rate at a specific date
FxRateSchema.statics.getRateAtDate = async function(
  baseCurrency: string, 
  quoteCurrency: string,
  date: Date
): Promise<IFxRate | null> {
  return this.findOne({
    baseCurrency: baseCurrency.toUpperCase(),
    quoteCurrency: quoteCurrency.toUpperCase(),
    effectiveFrom: { $lte: date },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gt: date } }
    ]
  }).sort({ effectiveFrom: -1 });
};

// Static method to snapshot current rates
FxRateSchema.statics.snapshotRate = async function(
  baseCurrency: string,
  quoteCurrency: string,
  rate: number,
  source: string
): Promise<IFxRate> {
  // First, mark any current active rates as expired
  await this.updateMany(
    {
      baseCurrency: baseCurrency.toUpperCase(),
      quoteCurrency: quoteCurrency.toUpperCase(),
      effectiveTo: null
    },
    {
      effectiveTo: new Date()
    }
  );

  // Then create a new current rate
  return this.create({
    baseCurrency: baseCurrency.toUpperCase(),
    quoteCurrency: quoteCurrency.toUpperCase(),
    rate,
    source,
    fetchedAt: new Date(),
    effectiveFrom: new Date(),
    effectiveTo: null
  });
};

export default mongoose.model<IFxRate>('FxRate', FxRateSchema);