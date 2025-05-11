// backend/src/routes/verification.routes.ts
// Routes for merchant identity verification

import { Router } from 'express';
import { 
  getVerificationStatus,
  submitVerification,
  upload
} from '../controllers/verification.controller';
import { authenticate, requireMerchantRole } from '../middlewares/auth.middleware';

const router = Router();

// Protect all routes
router.use(authenticate as any);
router.use(requireMerchantRole as any);

// Get verification status
router.get('/status', getVerificationStatus as any);

// Submit verification documents
router.post(
  '/submit',
  upload.fields([
    { name: 'businessDocImage', maxCount: 1 },
    { name: 'personalDocFront', maxCount: 1 },
    { name: 'personalDocBack', maxCount: 1 },
    { name: 'personalSelfie', maxCount: 1 },
    { name: 'bankStatement', maxCount: 1 }
  ]),
  submitVerification as any
);

export default router;