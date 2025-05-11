// src/routes/admin.routes.ts
// Routes for admin operations - updated with new endpoints

import { Router } from 'express';
import {
  adminLogin,
  getPendingVerifications,
  getRejectedVerifications,
  getVerificationDetails,
  updateVerificationStatus,
  getDocumentFile,
  getPaymentRates,
  getPaymentRateById,
  updatePaymentRate,
  deletePaymentRate,
  getUsers,
  getUserDetails,
  suspendUser,
  blockUser,
  resubmitVerification,
  deleteUser,
  unverifyUser,
  editUserInfo,
  activateUser
} from '../controllers/admin.controller';

// Import admin product controllers
import {
  adminGetProducts,
  adminGetProductById,
  adminUpdateProduct,
  adminDeleteProduct,
  adminChangeProductCurrency,
  adminGetProductStats
} from '../controllers/admin.product.controller';

// Import admin balance/finance controllers
import {
  adminGetMerchantBalance,
  adminAdjustMerchantBalance,
  adminChangeMerchantCurrency,
  adminGetFxRates,
  adminUpdateFxSettings,
  adminForceUpdateFxRates,
  adminRefreshAllFxRates,
  adminGetMerchantTransactions
} from '../controllers/admin.balance.controller';

// Import admin notification controllers
import {
  adminBroadcastNotification,
  adminDeleteUserNotifications
} from '../controllers/notification.controller';

import { authenticateAdmin, requireFullAccess } from '../middlewares/admin.middleware';

const router = Router();

// Public admin routes
router.post('/login', adminLogin as any);

// Protected admin routes - read-only access
router.use(authenticateAdmin as any);

// Verification read-only routes
router.get('/verifications/pending', getPendingVerifications as any);
router.get('/verifications/rejected', getRejectedVerifications as any);
router.get('/verifications/:id', getVerificationDetails as any);

// User management read-only routes
router.get('/users', getUsers as any);
router.get('/users/:id', getUserDetails as any);

// Payment rates read-only routes
router.get('/payment-rates', getPaymentRates as any);
router.get('/payment-rates/:id', getPaymentRateById as any);

// Document routes - use authenticateAdmin middleware to validate token but NOT requireFullAccess since that's checked in the controller
router.get('/documents/:type/:id', authenticateAdmin as any, getDocumentFile as any);
router.get('/documents/:type/:id/:field', authenticateAdmin as any, getDocumentFile as any);

// Product routes - read-only without full access
router.get('/products', adminGetProducts as any);
router.get('/products/stats', adminGetProductStats as any);
router.get('/products/:id', adminGetProductById as any);

// Finance routes - read-only without full access
router.get('/finance/:merchantId', adminGetMerchantBalance as any);
router.get('/finance/:merchantId/transactions', adminGetMerchantTransactions as any);
router.get('/finance/fx-rates', adminGetFxRates as any);

// Modification routes - require full access
// Verification modification
router.post('/verifications/:id/update', requireFullAccess as any, updateVerificationStatus as any);

// User modification
router.post('/users/:id/suspend', requireFullAccess as any, suspendUser as any);
router.post('/users/:id/block', requireFullAccess as any, blockUser as any);
router.post('/users/:id/activate', requireFullAccess as any, activateUser as any);
router.post('/users/:id/resubmit', requireFullAccess as any, resubmitVerification as any);
router.post('/users/:id/unverify', requireFullAccess as any, unverifyUser as any);
router.post('/users/:id/edit', requireFullAccess as any, editUserInfo as any);
router.post('/users/:id/delete', requireFullAccess as any, deleteUser as any);

// Payment rates modification
router.post('/payment-rates', requireFullAccess as any, updatePaymentRate as any);
router.post('/payment-rates/:id', requireFullAccess as any, updatePaymentRate as any);
router.delete('/payment-rates/:id', requireFullAccess as any, deletePaymentRate as any);

// Product modification
router.put('/products/:id', requireFullAccess as any, adminUpdateProduct as any);
router.delete('/products/:id', requireFullAccess as any, adminDeleteProduct as any);
router.patch('/products/:id/currency', requireFullAccess as any, adminChangeProductCurrency as any);

// Finance modification
router.patch('/finance/:merchantId/balance', requireFullAccess as any, adminAdjustMerchantBalance as any);
router.patch('/finance/:merchantId/currency', requireFullAccess as any, adminChangeMerchantCurrency as any);
router.patch('/settings/fx', requireFullAccess as any, adminUpdateFxSettings as any);
router.post('/finance/fx-rates/update', requireFullAccess as any, adminForceUpdateFxRates as any);
router.post('/finance/fx-rates/refresh-all', requireFullAccess as any, adminRefreshAllFxRates as any);

// Notification routes
router.post('/notifications/broadcast', requireFullAccess as any, adminBroadcastNotification as any);
router.delete('/notifications/user/:userId', requireFullAccess as any, adminDeleteUserNotifications as any);

export default router;