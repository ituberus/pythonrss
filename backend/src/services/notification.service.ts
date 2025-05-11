// src/services/notification.service.ts
// Service for handling user notifications and system-wide announcements

import { Types } from 'mongoose';
import NotificationModel, { INotification, NotificationType } from '../models/notification.model';
import UserModel from '../models/user.model';
import logger from '../utils/logger';

export class NotificationService {
  /**
   * Create a notification for a specific user
   * @param userId User ID
   * @param type Notification type
   * @param title Notification title
   * @param body Notification body
   * @param metadata Additional metadata
   * @returns Created notification
   */
  public static async createNotification(
    userId: string | Types.ObjectId,
    type: NotificationType,
    title: string,
    body: string,
    metadata: Record<string, any> = {}
  ): Promise<INotification> {
    try {
      // Create notification
      const notification = await NotificationModel.create({
        userId,
        type,
        title,
        body,
        unread: true,
        metadata,
      });
      
      logger.info(`Created notification for user ${userId}: ${type} - ${title}`);
      
      return notification;
    } catch (error) {
      logger.error(`Error creating notification: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   * @param userId User ID
   * @param options Query options
   * @returns Notifications and pagination metadata
   */
  public static async getUserNotifications(
    userId: string | Types.ObjectId,
    options: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
    } = {}
  ): Promise<{ notifications: INotification[]; total: number; unreadCount: number }> {
    try {
      // Default options
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;
      
      // Build query
      const query: any = { userId };
      
      if (options.unreadOnly) {
        query.unread = true;
      }
      
      if (options.type) {
        query.type = options.type;
      }
      
      // Get notifications with pagination
      const notifications = await NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      // Get total count
      const total = await NotificationModel.countDocuments(query);
      
      // Get unread count
      const unreadCount = await NotificationModel.countDocuments({ 
        userId, 
        unread: true 
      });
      
      return {
        notifications,
        total,
        unreadCount,
      };
    } catch (error) {
      logger.error(`Error getting user notifications: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Mark notifications as read
   * @param userId User ID
   * @param notificationIds Array of notification IDs to mark as read
   * @returns Number of notifications marked as read
   */
  public static async markAsRead(
    userId: string | Types.ObjectId,
    notificationIds: (string | Types.ObjectId)[]
  ): Promise<number> {
    try {
      if (!notificationIds.length) {
        return 0;
      }
      
      // Update notifications
      const result = await NotificationModel.updateMany(
        {
          _id: { $in: notificationIds },
          userId,
          unread: true,
        },
        {
          unread: false,
          readAt: new Date(),
        }
      );
      
      logger.info(`Marked ${result.modifiedCount} notifications as read for user ${userId}`);
      
      return result.modifiedCount;
    } catch (error) {
      logger.error(`Error marking notifications as read: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param userId User ID
   * @returns Number of notifications marked as read
   */
  public static async markAllAsRead(userId: string | Types.ObjectId): Promise<number> {
    try {
      // Update all unread notifications
      const result = await NotificationModel.updateMany(
        {
          userId,
          unread: true,
        },
        {
          unread: false,
          readAt: new Date(),
        }
      );
      
      logger.info(`Marked all ${result.modifiedCount} notifications as read for user ${userId}`);
      
      return result.modifiedCount;
    } catch (error) {
      logger.error(`Error marking all notifications as read: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Delete a notification
   * @param userId User ID
   * @param notificationId Notification ID
   * @returns Boolean indicating success
   */
  public static async deleteNotification(
    userId: string | Types.ObjectId,
    notificationId: string | Types.ObjectId
  ): Promise<boolean> {
    try {
      // Delete notification (only if it belongs to the user)
      const result = await NotificationModel.deleteOne({
        _id: notificationId,
        userId,
      });
      
      if (result.deletedCount === 0) {
        throw new Error('Notification not found or does not belong to the user');
      }
      
      logger.info(`Deleted notification ${notificationId} for user ${userId}`);
      
      return true;
    } catch (error) {
      logger.error(`Error deleting notification: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Admin function to broadcast a notification to multiple users
   * @param type Notification type
   * @param title Notification title
   * @param body Notification body
   * @param options Target options
   * @param adminId Admin user ID for audit
   * @returns Number of notifications created
   */
  public static async adminBroadcastNotification(
    type: NotificationType,
    title: string,
    body: string,
    options: {
      role?: 'merchant' | 'admin';
      country?: 'US' | 'BR';
      userIds?: (string | Types.ObjectId)[];
    },
    adminId: string
  ): Promise<number> {
    try {
      // Build query to find target users
      const query: any = {};
      
      if (options.role) {
        query.role = options.role;
      }
      
      if (options.userIds && options.userIds.length > 0) {
        query._id = { $in: options.userIds };
      }
      
      // If country filter, we need to join with merchant data
      let users = [];
      if (options.country) {
        users = await UserModel.aggregate([
          {
            $lookup: {
              from: 'merchants',
              localField: 'merchantId',
              foreignField: '_id',
              as: 'merchant',
            },
          },
          {
            $match: {
              ...query,
              'merchant.country': options.country,
            },
          },
          {
            $project: {
              _id: 1,
            },
          },
        ]);
      } else {
        users = await UserModel.find(query).select('_id');
      }
      
      if (users.length === 0) {
        return 0;
      }
      
      // Create notifications in bulk
      const notifications = users.map(user => ({
        userId: user._id,
        type,
        title,
        body,
        unread: true,
        metadata: {
          isSystemBroadcast: true,
          broadcastBy: adminId,
        },
      }));
      
      // Insert notifications
      const result = await NotificationModel.insertMany(notifications);
      
      logger.info(`Admin ${adminId} broadcasted notification to ${result.length} users: ${type} - ${title}`);
      
      return result.length;
    } catch (error) {
      logger.error(`Error in admin broadcast: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Admin function to delete notifications for a user
   * @param userId User ID
   * @param adminId Admin user ID for audit
   * @returns Number of notifications deleted
   */
  public static async adminDeleteUserNotifications(
    userId: string | Types.ObjectId,
    adminId: string
  ): Promise<number> {
    try {
      // Delete all notifications for the user
      const result = await NotificationModel.deleteMany({ userId });
      
      logger.info(`Admin ${adminId} deleted ${result.deletedCount} notifications for user ${userId}`);
      
      return result.deletedCount;
    } catch (error) {
      logger.error(`Error in admin notification deletion: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Cleanup expired or old read notifications
   * @param daysToKeepRead Days to keep read notifications
   * @returns Number of notifications deleted
   */
  public static async cleanupOldNotifications(daysToKeepRead: number = 90): Promise<number> {
    try {
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeepRead);
      
      // Delete old read notifications
      const result = await NotificationModel.deleteMany({
        unread: false,
        readAt: { $lt: cutoffDate },
      });
      
      logger.info(`Cleaned up ${result.deletedCount} old read notifications (older than ${daysToKeepRead} days)`);
      
      return result.deletedCount;
    } catch (error) {
      logger.error(`Error cleaning up old notifications: ${(error as Error).message}`);
      throw error;
    }
  }
}

export default NotificationService;