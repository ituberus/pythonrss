// src/routes/finance.routes.ts
// Routes for financial operations (balance, transactions, payouts)

import { Router } from 'express';
import {
  getBalance,
  getTransactions,
  requestPayout,
  getExchangeRates,
} from '../controllers/balance.controller';
import { authenticate, requireMerchantRole, requireOnboardingComplete, requireIdVerification } from '../middlewares/auth.middleware';

const router = Router();

// All routes are protected
router.use(authenticate as any);
router.use(requireMerchantRole as any);
router.use(requireOnboardingComplete as any);

// Balance and transactions can be accessed with just completed onboarding
router.get('/balance', getBalance as any);
router.get('/transactions', getTransactions as any);
router.get('/rates', getExchangeRates as any);

// Payout requests require ID verification
router.post('/payout', requireIdVerification as any, requestPayout as any);

export default router;