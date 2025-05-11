// backend/src/models/payment-rate.model.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentRate extends Document {
  countries: string[]; // Multiple countries
  country?: string; // For backward compatibility
  receiptDays: number;
  rateType: 'percentage' | 'fixed' | 'both';
  rateValue: number; // Used for percentage
  currencies?: { // Used for fixed amount
    USD?: number;
    BRL?: number;
  };
  isDefault?: boolean; // For backward compatibility
  createdAt: Date;
  updatedAt: Date;
}

const PaymentRateSchema = new Schema<IPaymentRate>(
  {
    countries: {
      type: [String],
      required: true,
    },
    country: {
      type: String, // For backward compatibility
    },
    receiptDays: {
      type: Number,
      required: true,
    },
    rateType: {
      type: String,
      enum: ['percentage', 'fixed', 'both'],
      default: 'percentage',
    },
    rateValue: {
      type: Number,
    },
    currencies: {
      USD: { type: Number },
      BRL: { type: Number },
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// For backward compatibility - populate 'country' from 'countries'
PaymentRateSchema.pre('save', function(next) {
  if (this.countries && this.countries.length > 0) {
    this.country = this.countries[0];
  }
  next();
});

// Remove compound index from previous version, as now we can have different rates for the same country & receipt days
// but with different currencies or rate types
PaymentRateSchema.index({ countries: 1, receiptDays: 1, rateType: 1 });

export default mongoose.model<IPaymentRate>('PaymentRate', PaymentRateSchema);