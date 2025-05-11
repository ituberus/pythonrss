// src/modules/commerce/index.ts
// Main entry point for commerce module, combining all routes

import { Router } from 'express';
import productRoutes from '../../routes/product.routes';
import financeRoutes from '../../routes/finance.routes';
import notificationRoutes from '../../routes/notification.routes';

const router = Router();

// Product routes
router.use('/products', productRoutes);

// Finance routes
router.use('/finance', financeRoutes);

// Notification routes
router.use('/notifications', notificationRoutes);

export default router;