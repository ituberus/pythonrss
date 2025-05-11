// src/controllers/product.controller.ts
import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import ProductService from '../services/product.service';
import NotificationService from '../services/notification.service';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * Standardize image URLs for consistency
 * This fixes the issue with URLs being inconsistently formatted
 * @param path The image path or filename
 * @returns Standardized URL path
 */
function standardizeImagePath(path: string): string {
  // If it already has /api/uploads or /uploads, leave it as is
  if (path.startsWith('/api/uploads/') || path.startsWith('/uploads/')) {
    return path;
  }
  
  // Otherwise, ensure it has /api/uploads/ prefix
  return `/api/uploads/${path.startsWith('/') ? path.substring(1) : path}`;
}

/**
 * Helper function to ensure image URLs are properly constructed
 * @param imageUrl The raw image URL
 * @param req Express request object for building full URLs
 * @returns A properly formatted image URL
 */
function formatImageUrl(imageUrl: string, req: Request): string {
  // If already a full URL, return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // If it's an absolute path starting with /uploads
  if (imageUrl.startsWith('/uploads/')) {
    return `${req.protocol}://${req.get('host')}${imageUrl}`;
  }

  // If it's just a filename or relative path
  if (!imageUrl.includes('/uploads/')) {
    return `${req.protocol}://${req.get('host')}/uploads/${imageUrl}`;
  }

  // Default fallback - prepend host and protocol
  return `${req.protocol}://${req.get('host')}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}

/**
 * Helper function to organize uploads by product slug
 * @param files List of files to organize
 * @param slug Product slug
 * @returns List of organized file paths
 */
async function organizeFilesBySlug(files: any[], slug: string): Promise<string[]> {
  try {
    // Create directory for the product if it doesn't exist
    const productDir = path.join(__dirname, '../../uploads', slug);
    
    if (!fs.existsSync(productDir)) {
      fs.mkdirSync(productDir, { recursive: true });
    }
    
    const organizedPaths: string[] = [];
    
    // Move each file to the product directory
    for (const file of files) {
      const oldPath = file.path;
      const filename = file.filename || path.basename(oldPath);
      const newPath = path.join(productDir, filename);
      
      // Copy file to new location
      fs.copyFileSync(oldPath, newPath);
      
      // Delete old file
      fs.unlinkSync(oldPath);
      
      // Update file path
      const relativePath = `/uploads/${slug}/${filename}`;
      organizedPaths.push(relativePath);
    }
    
    return organizedPaths;
  } catch (error) {
    logger.error('Error organizing files by slug:', error);
    return [];
  }
}

// Helper function to generate a random slug (10 characters)
function generateSlug(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// @desc    Create a new product
// @route   POST /api/products
// @access  Private (merchants only, verified)
export const createProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Log the raw request body for debugging
    logger.info('Product creation request body:', JSON.stringify(req.body));

    const { 
      title, 
      description, 
      shortDescription, 
      longDescription, 
      price, 
      currency, 
      type,
      slug,
      sku,
      barcode,
      isRecurring
    } = req.body;

    // Check if all required fields are present
    if (!title || !price || !currency || !type) {
      logger.info('Missing required fields:', { 
        hasTitle: !!title, 
        hasPrice: !!price, 
        hasCurrency: !!currency, 
        hasType: !!type 
      });
      return errorResponse(res, 'Missing required fields', null, 400);
    }

    // Generate or use provided slug
    const productSlug = slug || generateSlug();
    
    // Check if slug is already in use
    const existingProduct = await (ProductService as any).findProductBySlug(productSlug);
    if (existingProduct) {
      return errorResponse(res, 'Product slug already in use. Please try a different one.', null, 400);
    }

    // Create object to hold parsed data
    const productData: any = {
      title,
      // Handle both old and new description fields
      description: description || shortDescription || '',
      shortDescription: shortDescription || description || '',
      longDescription: longDescription || description || '',
      price: parseFloat(price),
      currency: currency.toUpperCase(),
      type,
      slug: productSlug,
    };
    
    // Add inventory fields if provided
    if (sku) productData.sku = sku;
    if (barcode) productData.barcode = barcode;

    // Handle type-specific details
    if (type === 'digital') {
      productData.digital = {};

      // Handle file method (URL or upload)
      const fileMethod = req.body.fileMethod || 'url';

      if (fileMethod === 'url') {
        const fileUrl = req.body.fileUrl;
        if (fileUrl) {
          productData.digital.fileUrl = fileUrl;
        }
      } else if (fileMethod === 'upload' && req.files && (req.files as any).digitalFile) {
        const digitalFile = (req.files as any).digitalFile[0];
        
        // Organize file by slug
        const organizedFiles = await organizeFilesBySlug([(req.files as any).digitalFile[0]], productSlug);
        if (organizedFiles.length > 0) {
          productData.digital.fileUpload = organizedFiles[0];
        } else {
          productData.digital.fileUpload = digitalFile.filename || digitalFile.path;
        }
      }

      // Handle recurring subscription data - explicitly check 'isRecurring' flag
      const hasRecurring = isRecurring === 'true' || isRecurring === true;
      if (hasRecurring && req.body.digital) {
        try {
          const digitalData = typeof req.body.digital === 'string' 
            ? JSON.parse(req.body.digital) 
            : req.body.digital;

          if (digitalData.recurring) {
            productData.digital.recurring = digitalData.recurring;
          }
        } catch (e) {
          logger.error('Failed to parse digital data:', e);
        }
      }
    } 
    else if (type === 'physical') {
      productData.physical = {};

      // Handle stock without variants
      if (req.body.hasStock === 'true' && req.body.stock) {
        productData.physical.stock = parseInt(req.body.stock, 10);
      }
      
      // Handle shipping methods
      if (req.body.shippingMethods) {
        try {
          const shippingMethods = typeof req.body.shippingMethods === 'string'
            ? JSON.parse(req.body.shippingMethods)
            : req.body.shippingMethods;
            
          if (Array.isArray(shippingMethods) && shippingMethods.length > 0) {
            productData.physical.shippingMethods = shippingMethods;
          }
        } catch (e) {
          logger.error('Failed to parse shipping methods:', e);
        }
      }

      // Parse physical data if provided
      if (req.body.physical) {
        try {
          const physicalData = typeof req.body.physical === 'string' 
            ? JSON.parse(req.body.physical) 
            : req.body.physical;

          Object.assign(productData.physical, physicalData);
        } catch (e) {
          logger.error('Failed to parse physical data:', e);
        }
      }
    }

    // Handle variants
    if (req.body.variants) {
      try {
        productData.variants = typeof req.body.variants === 'string' 
          ? JSON.parse(req.body.variants) 
          : req.body.variants;
      } catch (e) {
        logger.error('Failed to parse variants data:', e);
      }
    }

    // Handle images - limit to 10 max
    if (req.files && (req.files as any).images) {
      const imageFiles = Array.isArray((req.files as any).images) 
        ? (req.files as any).images 
        : [(req.files as any).images];
      
      // Limit to 10 images
      const limitedImageFiles = imageFiles.slice(0, 10);
      
      // Organize images by slug
      const organizedPaths = await organizeFilesBySlug(limitedImageFiles, productSlug);
      
      if (organizedPaths.length > 0) {
        // Create image objects for organized files
        productData.images = organizedPaths.map((path, index) => {
          // Check if this is the main image
          const isMain = req.body.mainImageIndex 
            ? parseInt(req.body.mainImageIndex) === index
            : index === 0; // Default to first image as main
          
          return {
            url: path,
            isMain: isMain
          };
        });
      } else {
        // Fallback to original approach if organization fails
        productData.images = limitedImageFiles.map((file: any, index: number) => {
          // Check if this is the main image
          const isMain = req.body.mainImageIndex 
            ? parseInt(req.body.mainImageIndex) === index
            : index === 0; // Default to first image as main
          
          // Get just the filename part
          const filename = file.filename || file.originalname;
          
          // Create the standardized URL path
          const imagePath = `/api/uploads/${filename}`;
          
          return {
            url: imagePath,
            isMain: isMain
          };
        });
      }
    } else if (req.body.images) {
      // Parse image data if provided directly
      try {
        productData.images = typeof req.body.images === 'string' 
          ? JSON.parse(req.body.images) 
          : req.body.images;
      } catch (e) {
        logger.error('Failed to parse images data:', e);
      }
    }

    // Validate that we have at least one image
    if (!productData.images || productData.images.length === 0) {
      return errorResponse(res, 'At least one product image is required', null, 400);
    }

    // Log the final product data before creation
    logger.info('Final product data for creation:', productData);

    // Create product
    const product = await ProductService.createProduct(req.user._id, productData);

    // Create notification for the merchant
    await NotificationService.createNotification(
      req.user._id,
      'product',
      'Product Created',
      `Your product "${title}" has been created successfully.`,
      { productId: product._id }
    );

    return successResponse(res, 'Product created successfully', { product }, 201);
  } catch (error) {
    logger.error('Error creating product:', error);

    // Check for specific error cases
    if ((error as Error).message.includes('User is not eligible')) {
      return errorResponse(res, 'Complete email and ID verification before creating products', null, 403);
    }
    
    if ((error as Error).message.includes('slug already in use')) {
      return errorResponse(res, 'Product slug already in use. Please try a different one.', null, 400);
    }
    
    if ((error as Error).message.includes('Maximum 10 images')) {
      return errorResponse(res, 'Maximum 10 images allowed per product', null, 400);
    }

    // Log more details about the error
    if (error instanceof Error) {
      logger.error('Error details:', { 
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }

    return errorResponse(res, 'An error occurred while creating product', (error as Error).message, 500);
  }
};

// @desc    Get all merchant's products
// @route   GET /api/products
// @access  Private (merchants only)
export const getMerchantProducts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { page, limit, status, type, currency, search, sortBy, sortOrder } = req.query;

    // Get merchant ID from user
    const merchantId = req.user.merchantId;

    if (!merchantId) {
      return errorResponse(res, 'Merchant profile not found', null, 404);
    }

    // Query products
    const result = await ProductService.getMerchantProducts(merchantId, {
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      status: status as any,
      type: type as any,
      currency: currency as string,
      search: search as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as any,
    });

    return successResponse(res, 'Products retrieved successfully', result);
  } catch (error) {
    logger.error('Error retrieving products:', error);
    return errorResponse(res, 'An error occurred while retrieving products', null, 500);
  }
};

// @desc    Get a single product by ID
// @route   GET /api/products/:id
// @access  Private (merchants only)
export const getProductById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Get product
    const product = await ProductService.getProductById(id);

    // Standardize existing image URLs
    if (product && product.images) {
      product.images = product.images.map(image => ({
        ...image,
        url: standardizeImagePath(image.url)
      }));
    }

    if (!product) {
      return errorResponse(res, 'Product not found', null, 404);
    }

    // Check ownership
    if (product.merchantId.toString() !== req.user.merchantId?.toString()) {
      return errorResponse(res, 'You do not have permission to view this product', null, 403);
    }

    return successResponse(res, 'Product retrieved successfully', { product });
  } catch (error) {
    logger.error('Error retrieving product:', error);
    return errorResponse(res, 'An error occurred while retrieving product', null, 500);
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private (merchants only, verified)
export const updateProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Log the raw request body for debugging
    logger.info('Product update request body:', JSON.stringify(req.body));

    const { id } = req.params;

    // Get current product to check if it exists and verify ownership
    const existingProduct = await ProductService.getProductById(id);

    if (!existingProduct) {
      return errorResponse(res, 'Product not found', null, 404);
    }

    // Check ownership
    if (existingProduct.merchantId.toString() !== req.user.merchantId?.toString()) {
      return errorResponse(res, 'You do not have permission to modify this product', null, 403);
    }

    // Check if product is deleted
    if (existingProduct.status === 'deleted') {
      return errorResponse(res, 'Cannot update a deleted product', null, 400);
    }

    // Start with existing product data to preserve fields that aren't being updated
    const updates: any = {};

    // Update basic fields if provided
    const basicFields = [
      'title', 'description', 'shortDescription', 'longDescription', 
      'price', 'currency', 'status', 'type', 'sku', 'barcode'
    ];
    
    basicFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Handle backwards compatibility - if old description field is updated but new fields aren't
    if (updates.description && !updates.shortDescription && !updates.longDescription) {
      updates.shortDescription = updates.description;
      updates.longDescription = updates.description;
    }

    // Make sure price is a number if provided
    if (updates.price) {
      updates.price = parseFloat(updates.price);
    }

    // Handle type-specific fields
    if (existingProduct.type === 'digital' || updates.type === 'digital') {
        updates.digital = {};

      // Handle file method (URL or upload)
      const fileMethod = req.body.fileMethod;

      if (fileMethod === 'url') {
        const fileUrl = req.body.fileUrl;
        if (fileUrl) {
          updates.digital = updates.digital || {};
          updates.digital.fileUrl = fileUrl;
          // Clear file upload if switching to URL
          updates.digital.fileUpload = undefined;
        }
      } else if (fileMethod === 'upload' && req.files && (req.files as any).digitalFile) {
        const digitalFile = (req.files as any).digitalFile[0];
        updates.digital = updates.digital || {};
        
        // Organize digital file by slug
        const organizedFiles = await organizeFilesBySlug([(req.files as any).digitalFile[0]], existingProduct.slug);
        if (organizedFiles.length > 0) {
          updates.digital.fileUpload = organizedFiles[0];
        } else {
          updates.digital.fileUpload = digitalFile.filename || digitalFile.path;
        }
        
        // Clear file URL if switching to upload
        updates.digital.fileUrl = undefined;
      }

      // If isRecurring is explicitly set to false, remove recurring settings
      if (req.body.isRecurring === 'false') {
        if (updates.digital) {
          updates.digital.recurring = undefined;
        }
      }
      // Handle recurring subscription data
      else if (req.body.isRecurring === 'true' && req.body.digital) {
        try {
          const digitalData = typeof req.body.digital === 'string' 
            ? JSON.parse(req.body.digital) 
            : req.body.digital;

          if (digitalData.recurring) {
            updates.digital = updates.digital || {};
            updates.digital.recurring = digitalData.recurring;
          } else {
            // Remove recurring if not enabled
            if (updates.digital) {
              updates.digital.recurring = undefined;
            }
          }
        } catch (e) {
          logger.error('Failed to parse digital data for update:', e);
        }
      }
    } 
    else if (existingProduct.type === 'physical' || updates.type === 'physical') {
        updates.physical = {};

      // Handle stock without variants
      if (req.body.hasStock === 'true' && req.body.stock) {
        updates.physical.stock = parseInt(req.body.stock, 10);
      } else if (req.body.hasStock === 'false') {
        updates.physical.stock = undefined;
      }
      
      // Handle shipping methods
      if (req.body.shippingMethods) {
        try {
          const shippingMethods = typeof req.body.shippingMethods === 'string'
            ? JSON.parse(req.body.shippingMethods)
            : req.body.shippingMethods;
            
          if (Array.isArray(shippingMethods)) {
            updates.physical.shippingMethods = shippingMethods;
          }
        } catch (e) {
          logger.error('Failed to parse shipping methods for update:', e);
        }
      }

      // Parse physical data if provided
      if (req.body.physical) {
        try {
          const physicalData = typeof req.body.physical === 'string' 
            ? JSON.parse(req.body.physical) 
            : req.body.physical;

          Object.assign(updates.physical, physicalData);
        } catch (e) {
          logger.error('Failed to parse physical data for update:', e);
        }
      }
    }

    // Handle variants
    if (req.body.hasVariants === 'true' && req.body.variants) {
      try {
        updates.variants = typeof req.body.variants === 'string' 
          ? JSON.parse(req.body.variants) 
          : req.body.variants;
      } catch (e) {
        logger.error('Failed to parse variants data for update:', e);
      }
    } else if (req.body.hasVariants === 'false') {
      // Remove variants if disabled
      updates.variants = [];
    }

    // Start with existing images
    const currentImages = existingProduct.images || [];
    let updatedImages = [...currentImages];

    // Handle removed images
    if (req.body.removedImages) {
      const removedIndices = req.body.removedImages.split(',').map((idx: string) => parseInt(idx, 10));
      updatedImages = updatedImages.filter((_img, idx) => !removedIndices.includes(idx));
    }

    // Handle new images - limit to 10 total
    if (req.files && (req.files as any).newImages) {
      const newImageFiles = Array.isArray((req.files as any).newImages) 
        ? (req.files as any).newImages 
        : [(req.files as any).newImages];
      
      // Calculate how many new images we can add
      const maxNewImages = 10 - updatedImages.length;
      if (maxNewImages <= 0) {
        return errorResponse(res, 'Maximum 10 images allowed per product', null, 400);
      }
      
      // Limit to available slots
      const limitedNewImageFiles = newImageFiles.slice(0, maxNewImages);
      
      // Organize new images by slug
      const organizedPaths = await organizeFilesBySlug(limitedNewImageFiles, existingProduct.slug);
      
      if (organizedPaths.length > 0) {
        // Create image objects for organized files
        const newImages = organizedPaths.map((path) => ({
          url: path,
          isMain: false // New images are not main by default
        }));
        
        // Add new images to the list
        updatedImages = [...updatedImages, ...newImages];
      } else {
        // Fallback if organization fails
        const newImages = limitedNewImageFiles.map((file: any) => {
          // Get just the filename part
          const filename = file.filename || file.originalname;
          
          // Create the standardized URL path
          const imagePath = `/api/uploads/${filename}`;
          
          return {
            url: imagePath,
            isMain: false // New images are not main by default
          };
        });
        
        // Add new images to the list
        updatedImages = [...updatedImages, ...newImages];
      }
    }

    // Handle main image selection
    if (req.body.mainImageIndex !== undefined) {
      const mainIndex = parseInt(req.body.mainImageIndex, 10);
      
      // Check if this is a new image or existing image
      if (req.body.mainImageIsNew === 'true') {
        // Calculate the actual index in the updatedImages array
        const currentCount = currentImages.length;
        const newIndex = currentCount + parseInt(req.body.mainImageNewIndex, 10);
        
        // Set the selected image as main and others as not main
        updatedImages = updatedImages.map((img, idx) => ({
          ...img,
          isMain: idx === newIndex
        }));
      } else {
        // Set the selected image as main and others as not main
        updatedImages = updatedImages.map((img, idx) => ({
          ...img,
          isMain: idx === mainIndex
        }));
      }
    }

    // Only update images if there are changes
    if (updatedImages.length > 0) {
      updates.images = updatedImages;
    }

    // Log the update data
    logger.info('Update data for product:', updates);

    // Update product
    const updatedProduct = await ProductService.updateProduct(id, req.user._id, updates);

    if (!updatedProduct) {
      return errorResponse(res, 'Failed to update product', null, 500);
    }

    return successResponse(res, 'Product updated successfully', { product: updatedProduct });
  } catch (error) {
    logger.error('Error updating product:', error);

    // Check for specific error cases
    if ((error as Error).message.includes('User is not eligible')) {
      return errorResponse(res, 'Complete email and ID verification before updating products', null, 403);
    }

    if ((error as Error).message.includes('permission')) {
      return errorResponse(res, 'You do not have permission to modify this product', null, 403);
    }
    
    if ((error as Error).message.includes('Maximum 10 images')) {
      return errorResponse(res, 'Maximum 10 images allowed per product', null, 400);
    }
    
    if ((error as Error).message.includes('Duplicate variant name')) {
      return errorResponse(res, 'Duplicate variant names are not allowed', null, 400);
    }

    return errorResponse(res, 'An error occurred while updating product', (error as Error).message, 500);
  }
};

// @desc    Delete a product (soft delete)
// @route   DELETE /api/products/:id
// @access  Private (merchants only)
export const deleteProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Delete product
    const product = await ProductService.deleteProduct(id, req.user._id);

    if (!product) {
      return errorResponse(res, 'Product not found', null, 404);
    }

    return successResponse(res, 'Product deleted successfully', { productId: id });
  } catch (error) {
    logger.error('Error deleting product:', error);

    if ((error as Error).message.includes('permission')) {
      return errorResponse(res, 'You do not have permission to delete this product', null, 403);
    }

    return errorResponse(res, 'An error occurred while deleting product', null, 500);
  }
};

// @desc    Get a public product (for checkout/public view)
// @route   GET /api/products/public/:id
// @access  Public
export const getPublicProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Get public product details
    const product = await ProductService.getPublicProductDetails(id);

    // Standardize existing image URLs
    if (product && product.images) {
      product.images = product.images.map(image => ({
        ...image,
        url: standardizeImagePath(image.url)
      }));
    }

    if (!product) {
      return errorResponse(res, 'Product not found or not active', null, 404);
    }

    return successResponse(res, 'Product details retrieved', { product });
  } catch (error) {
    logger.error('Error retrieving public product:', error);
    return errorResponse(res, 'An error occurred while retrieving product details', null, 500);
  }
};