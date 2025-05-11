import { Router } from 'express';
import {
  updateBusinessInfo,
  updateAddress,
  updateSellingMethod,
  getOnboardingStatus,
} from '../controllers/onboarding.controller';
import { authenticate, requireMerchantRole } from '../middlewares/auth.middleware';

const router = Router();

// All routes are protected for merchants only
router.use(authenticate as any);
router.use(requireMerchantRole as any);

router.get('/status', getOnboardingStatus as any);
router.post('/business', updateBusinessInfo as any);
router.post('/address', updateAddress as any);
router.post('/selling-method', updateSellingMethod as any);

export default router;