// src/models/notification.model.ts
// Model for user notifications with read/unread status tracking

import mongoose, { Document, Schema, Types } from 'mongoose';

export type NotificationType = 'finance' | 'product' | 'security' | 'system' | 'verification';

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  unread: boolean;
  createdAt: Date;
  readAt?: Date;
  expiresAt?: Date;      // Optional expiration date
  metadata?: Record<string, any>; // Optional additional data
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['finance', 'product', 'security', 'system', 'verification'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    unread: {
      type: Boolean,
      default: true,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for faster querying of unread notifications per user
NotificationSchema.index({ userId: 1, unread: 1 });

// Index for expiring notifications
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to create a notification
NotificationSchema.statics.createNotification = async function(
  userId: Types.ObjectId, 
  type: NotificationType, 
  title: string, 
  body: string, 
  metadata: Record<string, any> = {},
  expiresAt?: Date
): Promise<INotification> {
  return this.create({
    userId,
    type,
    title,
    body,
    unread: true,
    metadata,
    expiresAt
  });
};

// Static method to mark notifications as read
NotificationSchema.statics.markAsRead = async function(
  userId: Types.ObjectId,
  notificationIds: Types.ObjectId[] | string[]
): Promise<number> {
  const result = await this.updateMany(
    { 
      _id: { $in: notificationIds },
      userId: userId
    },
    {
      unread: false,
      readAt: new Date()
    }
  );
  
  return result.modifiedCount;
};

export default mongoose.model<INotification>('Notification', NotificationSchema);