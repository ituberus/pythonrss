// src/models/balance.model.ts
// Model for merchant balance tracking with separate buckets for reserve, available, and pending amounts

import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBalance extends Document {
  merchantId: Types.ObjectId;
  dashboardCurrency: 'USD' | 'BRL';
  reserve: number;       // Funds in reserve (held for potential chargebacks/refunds)
  available: number;     // Funds available for withdrawal
  pending: number;       // Funds pending (e.g., in processing)
  totalBalance: number;  // Virtual property for total amount
  updatedAt: Date;
  createdAt: Date;
}

const BalanceSchema = new Schema<IBalance>(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      unique: true,
    },
    dashboardCurrency: {
      type: String,
      enum: ['USD', 'BRL'],
      required: true,
    },
    reserve: {
      type: Number,
      default: 0,
      min: 0,
    },
    available: {
      type: Number,
      default: 0,
      min: 0,
    },
    pending: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual property to calculate total balance
BalanceSchema.virtual('totalBalance').get(function (this: IBalance) {
  return this.reserve + this.available + this.pending;
});

// Ensure all balance updates are correctly formatted to 2 decimal places
BalanceSchema.pre('save', function (next) {
  this.reserve = parseFloat(this.reserve.toFixed(2));
  this.available = parseFloat(this.available.toFixed(2));
  this.pending = parseFloat(this.pending.toFixed(2));
  next();
});



export default mongoose.model<IBalance>('Balance', BalanceSchema);