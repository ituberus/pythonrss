// src/models/user.model.ts
// Model for users with authentication and role-based access

import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  role: 'merchant' | 'admin' | 'customer';
  firstName?: string;
  lastName?: string;
  merchantId?: Types.ObjectId;
  emailVerifiedAt?: Date;
  emailVerified?: boolean; // Virtual field, true if emailVerifiedAt is set
  idCheckStatus?: 'pending' | 'verified' | 'rejected';
  idCheckVerifiedAt?: Date;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  onboardingStage: 'email' | 'business' | 'verification' | 'banking' | 'complete';
  onboardingComplete: boolean;
  status: 'active' | 'suspended' | 'blocked';
  suspendedUntil?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // Don't include password by default
    },
    role: {
      type: String,
      enum: ['merchant', 'admin', 'customer'],
      default: 'merchant',
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    idCheckStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    idCheckVerifiedAt: {
      type: Date,
      default: null,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false, // Don't include 2FA secret by default
    },
    onboardingStage: {
      type: String,
      enum: ['email', 'business', 'verification', 'banking', 'complete'],
      default: 'email',
    },
    onboardingComplete: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'blocked'],
      default: 'active',
    },
    suspendedUntil: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual property to check if email is verified
UserSchema.virtual('emailVerified').get(function (this: IUser) {
  return this.emailVerifiedAt !== null && this.emailVerifiedAt !== undefined;
});

// Indexes for efficient querying
UserSchema.index({ email: 1 });
UserSchema.index({ merchantId: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ onboardingStage: 1 });
UserSchema.index({ onboardingComplete: 1 });

export default mongoose.model<IUser>('User', UserSchema);
