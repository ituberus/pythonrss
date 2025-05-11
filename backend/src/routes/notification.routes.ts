// src/routes/notification.routes.ts
// Routes for notification management

import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationsAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// All routes are protected
router.use(authenticate as any);

// Notification routes
router.get('/', getUserNotifications as any);
router.post('/read', markNotificationsAsRead as any);
router.post('/read-all', markAllNotificationsAsRead as any);
router.delete('/:id', deleteNotification as any);

export default router;