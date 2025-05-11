// src/routes/product.routes.ts
import { Router } from 'express';
import {
  createProduct,
  getMerchantProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getPublicProduct,
} from '../controllers/product.controller';
import { authenticate, requireMerchantRole } from '../middlewares/auth.middleware';
import upload from '../utils/upload'; // Import the centralized upload config

const router = Router();

// Public route: get a single active product for public view
router.get('/public/:id', getPublicProduct as any);

// All following routes require authentication + merchant role
router.use(authenticate as any);
router.use(requireMerchantRole as any);

// Create a new product, accepting up to 10 images + 1 digital file
router.post(
  '/',
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'digitalFile', maxCount: 1 },
  ]),
  createProduct as any
);

// List merchant's products
router.get('/', getMerchantProducts as any);

// Get individual product by ID
router.get('/:id', getProductById as any);

// Update a product—also allow new file uploads
router.put(
  '/:id',
  upload.fields([
    { name: 'newImages', maxCount: 10 },
    { name: 'digitalFile', maxCount: 1 },
  ]),
  updateProduct as any
);

// Soft-delete a product
router.delete('/:id', deleteProduct as any);

export default router;