// backend/src/models/address.model.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAddress extends Document {
  merchantId: Types.ObjectId;
  type: 'legal' | 'warehouse' | 'billing';
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: 'US' | 'BR';
  timezone: string;
  phone?: string; // Added phone field
}

const AddressSchema = new Schema<IAddress>(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    type: {
      type: String,
      enum: ['legal', 'warehouse', 'billing'],
      default: 'legal',
    },
    line1: {
      type: String,
      required: true,
    },
    line2: {
      type: String,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    postalCode: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      enum: ['US', 'BR'],
      required: true,
    },
    timezone: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      // Not required, but will be validated if provided
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IAddress>('Address', AddressSchema);