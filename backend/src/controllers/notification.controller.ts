// src/controllers/notification.controller.ts
// Controller for handling user notifications

import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import NotificationService from '../services/notification.service';
import logger from '../utils/logger';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getUserNotifications = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { page, limit, unreadOnly, type } = req.query;
    
    // Query notifications
    const result = await NotificationService.getUserNotifications(
      req.user._id,
      {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        unreadOnly: unreadOnly === 'true',
        type: type as any,
      }
    );
    
    return successResponse(res, 'Notifications retrieved successfully', result);
  } catch (error) {
    logger.error('Error retrieving notifications:', error);
    return errorResponse(res, 'An error occurred while retrieving notifications', null, 500);
  }
};

// @desc    Mark notifications as read
// @route   POST /api/notifications/read
// @access  Private
export const markNotificationsAsRead = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { ids } = req.body;
    
    // Check if ids is an array
    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(res, 'Notification IDs must be provided as an array', null, 400);
    }
    
    // Mark notifications as read
    const count = await NotificationService.markAsRead(req.user._id, ids);
    
    return successResponse(res, `${count} notification(s) marked as read`, { count });
  } catch (error) {
    logger.error('Error marking notifications as read:', error);
    return errorResponse(res, 'An error occurred while marking notifications as read', null, 500);
  }
};

// @desc    Mark all notifications as read
// @route   POST /api/notifications/read-all
// @access  Private
export const markAllNotificationsAsRead = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Mark all notifications as read
    const count = await NotificationService.markAllAsRead(req.user._id);
    
    return successResponse(res, `${count} notification(s) marked as read`, { count });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    return errorResponse(res, 'An error occurred while marking all notifications as read', null, 500);
  }
};

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    // Delete notification
    const result = await NotificationService.deleteNotification(req.user._id, id);
    
    return successResponse(res, 'Notification deleted successfully', { deleted: result });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    
    if ((error as Error).message.includes('not found')) {
      return errorResponse(res, 'Notification not found or does not belong to you', null, 404);
    }
    
    return errorResponse(res, 'An error occurred while deleting notification', null, 500);
  }
};

// @desc    Admin - Broadcast notification
// @route   POST /api/admin/notifications/broadcast
// @access  Admin only with full access
export const adminBroadcastNotification = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { type, title, body, role, country, userIds } = req.body;
    
    // Check for full access
    if (!req.adminUser?.hasFullAccess) {
      return errorResponse(res, 'This operation requires admin access key', null, 403);
    }
    
    // Validate required fields
    if (!type || !title || !body) {
      return errorResponse(res, 'Type, title, and body are required', null, 400);
    }
    
    // At least one targeting option must be provided
    if (!role && !country && (!userIds || userIds.length === 0)) {
      return errorResponse(res, 'At least one targeting option (role, country, or userIds) must be provided', null, 400);
    }
    
    // Broadcast notification
    const count = await NotificationService.adminBroadcastNotification(
      type,
      title,
      body,
      {
        role,
        country,
        userIds,
      },
      req.adminUser.username
    );
    
    return successResponse(res, `Notification broadcast to ${count} users`, { count });
  } catch (error) {
    logger.error('Admin - Error broadcasting notification:', error);
    return errorResponse(res, 'An error occurred while broadcasting notification', null, 500);
  }
};

// @desc    Admin - Delete user notifications
// @route   DELETE /api/admin/notifications/user/:userId
// @access  Admin only with full access
export const adminDeleteUserNotifications = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    
    // Check for full access
    if (!req.adminUser?.hasFullAccess) {
      return errorResponse(res, 'This operation requires admin access key', null, 403);
    }
    
    // Delete user notifications
    const count = await NotificationService.adminDeleteUserNotifications(
      userId,
      req.adminUser.username
    );
    
    return successResponse(res, `${count} notification(s) deleted for user`, { count });
  } catch (error) {
    logger.error('Admin - Error deleting user notifications:', error);
    return errorResponse(res, 'An error occurred while deleting user notifications', null, 500);
  }
};