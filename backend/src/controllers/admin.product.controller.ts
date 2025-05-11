// src/controllers/admin.product.controller.ts
// Controller for admin operations on products

import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import ProductService from '../services/product.service';
import NotificationService from '../services/notification.service';
import logger from '../utils/logger';
import UserModel from '../models/user.model';
import ProductModel from '../models/product.model';
import { PipelineStage } from 'mongoose';

// @desc    Admin - Get all products with advanced filtering
// @route   GET /api/admin/products
// @access  Admin only
export const adminGetProducts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      page,
      limit,
      status,
      type,
      currency,
      search,
      merchantId,
      sortBy,
      sortOrder,
      fromDate,
      toDate,
      priceMin,
      priceMax,
    } = req.query;
    
    // Query products with admin privileges
    const result = await ProductService.adminGetProducts({
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      status: status as any,
      type: type as any,
      currency: currency as string,
      search: search as string,
      merchantId: merchantId as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as any,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
      priceMin: priceMin ? parseFloat(priceMin as string) : undefined,
      priceMax: priceMax ? parseFloat(priceMax as string) : undefined,
    });
    
    return successResponse(res, 'Products retrieved successfully', result);
  } catch (error) {
    logger.error('Admin - Error retrieving products:', error);
    return errorResponse(res, 'An error occurred while retrieving products', null, 500);
  }
};

// @desc    Admin - Get a single product by ID
// @route   GET /api/admin/products/:id
// @access  Admin only
export const adminGetProductById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    // Get product
    const product = await ProductService.getProductById(id);
    
    if (!product) {
      return errorResponse(res, 'Product not found', null, 404);
    }
    
    // Get merchant details for context
    const merchant = await UserModel.findOne({ merchantId: product.merchantId })
      .select('email _id')
      .populate('merchantId', 'businessName country');
    
    return successResponse(res, 'Product retrieved successfully', { 
      product,
      merchant: merchant || null 
    });
  } catch (error) {
    logger.error('Admin - Error retrieving product:', error);
    return errorResponse(res, 'An error occurred while retrieving product', null, 500);
  }
};

// @desc    Admin - Update a product
// @route   PUT /api/admin/products/:id
// @access  Admin only with full access
export const adminUpdateProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Check for full access
    if (!req.adminUser?.hasFullAccess) {
      return errorResponse(res, 'This operation requires admin access key', null, 403);
    }
    
    // Update product with admin privileges
    const product = await ProductService.adminUpdateProduct(
      id, 
      updates, 
      req.adminUser.username
    );
    
    if (!product) {
      return errorResponse(res, 'Product not found', null, 404);
    }
    
    // If significant updates (e.g. price change, deactivation), notify the merchant
    if (updates.price !== undefined || updates.status === 'deactivated') {
      // Find the merchant (user) by merchantId
      const user = await UserModel.findOne({ merchantId: product.merchantId });
      
      if (user) {
        // Create notification for the merchant
        const message = updates.status === 'deactivated'
          ? `Your product "${product.title}" has been deactivated by an administrator.`
          : `Your product "${product.title}" has been updated by an administrator.`;
          
        await NotificationService.createNotification(
            user._id as string,
          'product',
          'Product Updated by Admin',
          message,
          { 
            productId: product._id,
            updatedBy: req.adminUser.username,
            changes: Object.keys(updates)
          }
        );
      }
    }
    
    return successResponse(res, 'Product updated successfully', { product });
  } catch (error) {
    logger.error('Admin - Error updating product:', error);
    return errorResponse(res, 'An error occurred while updating product', null, 500);
  }
};

// @desc    Admin - Delete a product (hard delete)
// @route   DELETE /api/admin/products/:id
// @access  Admin only with full access
export const adminDeleteProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    // Check for full access
    if (!req.adminUser?.hasFullAccess) {
      return errorResponse(res, 'This operation requires admin access key', null, 403);
    }
    
    // Verify product exists
    const product = await ProductService.getProductById(id);
    
    if (!product) {
      return errorResponse(res, 'Product not found', null, 404);
    }
    
    // Hard delete (completely remove from database)
    await product.deleteOne();
    
    // Find the merchant (user) by merchantId
    const user = await UserModel.findOne({ merchantId: product.merchantId });
    
    if (user) {
      // Create notification for the merchant
      await NotificationService.createNotification(
        user._id as string,
        'product',
        'Product Deleted by Admin',
        `Your product "${product.title}" has been permanently deleted by an administrator.`,
        { 
            productId: (product._id as import('mongoose').Types.ObjectId).toString(),
          deletedBy: req.adminUser.username
        }
      );
    }
    
    return successResponse(res, 'Product permanently deleted', { productId: id });
  } catch (error) {
    logger.error('Admin - Error deleting product:', error);
    return errorResponse(res, 'An error occurred while deleting product', null, 500);
  }
};

// @desc    Admin - Force change product currency
// @route   PATCH /api/admin/products/:id/currency
// @access  Admin only with full access
export const adminChangeProductCurrency = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { currency, newPrice } = req.body;
    
    // Check for full access
    if (!req.adminUser?.hasFullAccess) {
      return errorResponse(res, 'This operation requires admin access key', null, 403);
    }
    
    // Validate required fields
    if (!currency) {
      return errorResponse(res, 'Currency is required', null, 400);
    }
    
    // Verify currency is valid
    const validCurrencies = ['USD', 'BRL', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];
    if (!validCurrencies.includes(currency.toUpperCase())) {
      return errorResponse(res, `Invalid currency. Supported currencies: ${validCurrencies.join(', ')}`, null, 400);
    }
    
    // Get product
    const product = await ProductService.getProductById(id);
    
    if (!product) {
      return errorResponse(res, 'Product not found', null, 404);
    }
    
    // Update currency (and price if provided)
    const updates: any = { 
      currency: currency.toUpperCase() 
    };
    
    if (newPrice !== undefined) {
      updates.price = parseFloat(newPrice);
    }
    
    // Update product
    const updatedProduct = await ProductService.adminUpdateProduct(
      id,
      updates,
      req.adminUser.username
    );
    
    // Find the merchant (user) by merchantId and notify
    const user = await UserModel.findOne({ merchantId: product.merchantId });
    
    if (user) {
      await NotificationService.createNotification(
        user._id as string,
        'product',
        'Product Currency Changed',
        `The currency for your product "${product.title}" has been changed from ${product.currency} to ${currency.toUpperCase()} by an administrator.`,
        { 
          productId: product._id,
          oldCurrency: product.currency,
          newCurrency: currency.toUpperCase(),
          oldPrice: product.price,
          newPrice: updates.price || product.price
        }
      );
    }
    
    return successResponse(res, 'Product currency updated successfully', { product: updatedProduct });
  } catch (error) {
    logger.error('Admin - Error changing product currency:', error);
    return errorResponse(res, 'An error occurred while changing product currency', null, 500);
  }
};

// @desc    Admin - Get product stats
// @route   GET /api/admin/products/stats
// @access  Admin only
export const adminGetProductStats = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Get high-level stats
    const totalActive = await ProductService.adminGetProducts({ status: 'active' }).then(r => r.total);
    const totalDeactivated = await ProductService.adminGetProducts({ status: 'deactivated' }).then(r => r.total);
    const totalDeleted = await ProductService.adminGetProducts({ status: 'deleted' }).then(r => r.total);
    
    // Get currency distribution
    const pipeline: PipelineStage[] = [
             {
               $group: {
                 _id: '$currency',
                 count: { $sum: 1 },
                 avgPrice: { $avg: '$price' }
               }
             },
             {
               // Use a literal 1 or -1 so TS recognizes it as valid Sort order
               $sort: { count: 1 }
             }
           ];
           const currencyStats = await ProductModel.aggregate(pipeline);
    
    // Get type distribution
    const typePipeline = [
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ];
    
    const typeStats = await ProductModel.aggregate(typePipeline);
    
    return successResponse(res, 'Product statistics retrieved', {
      counts: {
        total: totalActive + totalDeactivated + totalDeleted,
        active: totalActive,
        deactivated: totalDeactivated,
        deleted: totalDeleted
      },
      currencies: currencyStats,
      types: typeStats
    });
  } catch (error) {
    logger.error('Admin - Error getting product stats:', error);
    return errorResponse(res, 'An error occurred while retrieving product statistics', null, 500);
  }
};