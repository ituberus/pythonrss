// src/routes/auth.routes.ts
// Routes for authentication and user management

import { Router } from 'express';
import {
  register,
  login,
  updateOnboarding,
  getCurrentUser
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.post('/register', register as any);
router.post('/login', login as any);

// Protected routes
router.use(authenticate as any);
router.get('/me', getCurrentUser as any);
router.post('/onboarding/:stage', updateOnboarding as any);

export default router;