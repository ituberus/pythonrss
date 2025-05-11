// src/services/product.service.ts
import { Types } from 'mongoose';
import ProductModel, { IProduct } from '../models/product.model';
import UserModel from '../models/user.model';
import MerchantModel from '../models/merchant.model';
import SettingModel from '../models/settings.model';
import logger from '../utils/logger';

export class ProductService {
  /**
   * Check if a user is allowed to create or modify products
   * @param userId User ID to check
   * @returns Boolean indicating if user can create/modify products
   */
  public static async canCreateProducts(userId: string | Types.ObjectId): Promise<boolean> {
    try {
      // Find user with both status checks
      const user = await UserModel.findById(userId);
      
      if (!user) {
        return false;
      }
      
      // Both email verification and ID verification are required
      if (!user.emailVerifiedAt || user.idCheckStatus !== 'verified') {
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`Error checking product creation permissions: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Find a product by slug
   * @param slug Product slug to find
   * @returns Product or null if not found
   */
  public static async findProductBySlug(slug: string): Promise<IProduct | null> {
    try {
      return await ProductModel.findOne({ slug });
    } catch (error) {
      logger.error(`Error finding product by slug: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Create a new product
   * @param userId User ID of the creator
   * @param productData Product data
   * @returns Created product
   */
  public static async createProduct(userId: string | Types.ObjectId, productData: Partial<IProduct>): Promise<IProduct> {
    try {
      // Check if user can create products
      const canCreate = await this.canCreateProducts(userId);
      if (!canCreate) {
        throw new Error('User is not eligible to create products. Both email and ID verification are required.');
      }
      
      // Find user's merchant ID
      const user = await UserModel.findById(userId);
      if (!user || !user.merchantId) {
        throw new Error('User does not have a merchant profile');
      }
      
      // Check if slug is already in use
      if (productData.slug) {
        const existingProduct = await this.findProductBySlug(productData.slug);
        if (existingProduct) {
          throw new Error('Product slug already in use');
        }
      }
      
      // Validate allowed currencies
      const allowedCurrencies = await (SettingModel as any).getByKey('allowedCurrencies') || 
        ['USD', 'BRL', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'];
      
      if (!allowedCurrencies.includes(productData.currency?.toUpperCase() || '')) {
        throw new Error(`Currency not supported. Allowed currencies: ${allowedCurrencies.join(', ')}`);
      }
      
      // Create new product
      const newProduct = await ProductModel.create({
        ...productData,
        merchantId: user.merchantId,
        status: 'active',
        listedAt: new Date(),
      });
      
      logger.info(`Created product ${newProduct._id} for merchant ${user.merchantId}`);
      
      return newProduct;
    } catch (error) {
      logger.error(`Error creating product: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get products for a merchant (with pagination)
   * @param merchantId Merchant ID
   * @param options Query options (pagination, filters)
   * @returns Products and pagination metadata
   */
  public static async getMerchantProducts(
    merchantId: string | Types.ObjectId,
    options: {
      page?: number;
      limit?: number;
      status?: 'active' | 'deactivated' | 'deleted';
      type?: 'digital' | 'physical';
      currency?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ products: IProduct[]; total: number; page: number; pages: number }> {
    try {
      // Default options
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;
      
      // Build query
      const query: any = { merchantId };
      
      // Add filters if provided
      if (options.status) {
        query.status = options.status;
      } else {
        // Default to not showing deleted products
        query.status = { $ne: 'deleted' };
      }
      
      if (options.type) {
        query.type = options.type;
      }
      
      if (options.currency) {
        query.currency = options.currency.toUpperCase();
      }
      
      if (options.search) {
        query.$or = [
          { title: { $regex: options.search, $options: 'i' } },
          { description: { $regex: options.search, $options: 'i' } },
          { shortDescription: { $regex: options.search, $options: 'i' } },
          { longDescription: { $regex: options.search, $options: 'i' } },
          { sku: { $regex: options.search, $options: 'i' } },
          { barcode: { $regex: options.search, $options: 'i' } },
        ];
      }
      
      // Build sort
      const sort: any = {};
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      sort[sortBy] = sortOrder;
      
      // Execute query with pagination
      const products = await ProductModel.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);
      
      // Get total count for pagination
      const total = await ProductModel.countDocuments(query);
      
      // Calculate total pages
      const pages = Math.ceil(total / limit);
      
      return {
        products,
        total,
        page,
        pages,
      };
    } catch (error) {
      logger.error(`Error getting merchant products: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get a single product by ID
   * @param productId Product ID
   * @returns Product or null if not found
   */
  public static async getProductById(productId: string | Types.ObjectId): Promise<IProduct | null> {
    try {
      return await ProductModel.findById(productId);
    } catch (error) {
      logger.error(`Error getting product by ID: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Update a product
   * @param productId Product ID
   * @param userId User ID attempting the update
   * @param updates Updates to apply
   * @returns Updated product
   */
  public static async updateProduct(
    productId: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    updates: Partial<IProduct>
  ): Promise<IProduct | null> {
    try {
      // Check if user can modify products
      const canCreate = await this.canCreateProducts(userId);
      if (!canCreate) {
        throw new Error('User is not eligible to modify products. Both email and ID verification are required.');
      }
      
      // Find user's merchant ID
      const user = await UserModel.findById(userId);
      if (!user || !user.merchantId) {
        throw new Error('User does not have a merchant profile');
      }
      
      // Find product and verify ownership
      const product = await ProductModel.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      if (product.merchantId.toString() !== user.merchantId.toString()) {
        throw new Error('You do not have permission to modify this product');
      }
      
      // Check if product is deleted
      if (product.status === 'deleted') {
        throw new Error('Cannot update a deleted product');
      }
      
      // Check if slug is being updated and is already in use by another product
      if (updates.slug && updates.slug !== product.slug) {
        const existingProduct = await this.findProductBySlug(updates.slug);
        if (existingProduct && existingProduct.id !== productId.toString()) {
          throw new Error('Product slug already in use');
        }
      }
      
      
      // Apply updates (allow all relevant fields to be updated)
      const allowedUpdates = [
        'title',
        'description',
        'shortDescription',
        'longDescription',
        'price',
        'currency',
        'type',
        'images',
        'variants',
        'status',
        'physical',
        'digital',
        'slug',
        'sku',
        'barcode'
      ];
      
      // Create a filtered update object
      const filteredUpdates: any = {};
      for (const key of allowedUpdates) {
        if (key in updates) {
          filteredUpdates[key] = (updates as any)[key];
        }
      }
      
      // Special treatment for status changes
      if (updates.status === 'deactivated') {
        filteredUpdates.delistedAt = new Date();
      } else if (updates.status === 'active' && product.status === 'deactivated') {
        filteredUpdates.delistedAt = null;
        filteredUpdates.listedAt = new Date();
      }
      
      // Update product
      const updatedProduct = await ProductModel.findByIdAndUpdate(
        productId,
        filteredUpdates,
        { new: true, runValidators: true }
      );
      
      logger.info(`Updated product ${productId} for merchant ${user.merchantId}`);
      
      return updatedProduct;
    } catch (error) {
      logger.error(`Error updating product: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Delete a product (soft delete)
   * @param productId Product ID
   * @param userId User ID attempting the deletion
   * @returns Deleted product
   */
  public static async deleteProduct(
    productId: string | Types.ObjectId,
    userId: string | Types.ObjectId
  ): Promise<IProduct | null> {
    try {
      // Find user's merchant ID
      const user = await UserModel.findById(userId);
      if (!user || !user.merchantId) {
        throw new Error('User does not have a merchant profile');
      }
      
      // Find product and verify ownership
      const product = await ProductModel.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      if (product.merchantId.toString() !== user.merchantId.toString()) {
        throw new Error('You do not have permission to delete this product');
      }
      
      // Soft delete by updating status
      const deletedProduct = await ProductModel.findByIdAndUpdate(
        productId,
        {
          status: 'deleted',
          delistedAt: new Date(),
        },
        { new: true }
      );
      
      logger.info(`Deleted product ${productId} for merchant ${user.merchantId}`);
      
      return deletedProduct;
    } catch (error) {
      logger.error(`Error deleting product: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Admin function to get all products with advanced filtering
   * @param options Query options
   * @returns Products and pagination metadata
   */
  public static async adminGetProducts(
    options: {
      page?: number;
      limit?: number;
      status?: 'active' | 'deactivated' | 'deleted';
      type?: 'digital' | 'physical';
      currency?: string;
      search?: string;
      merchantId?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      fromDate?: Date;
      toDate?: Date;
      priceMin?: number;
      priceMax?: number;
    } = {}
  ): Promise<{ products: IProduct[]; total: number; page: number; pages: number }> {
    try {
      // Default options
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;
      
      // Build query
      const query: any = {};
      
      // Add filters if provided
      if (options.status) {
        query.status = options.status;
      }
      
      if (options.type) {
        query.type = options.type;
      }
      
      if (options.currency) {
        query.currency = options.currency.toUpperCase();
      }
      
      if (options.merchantId) {
        query.merchantId = options.merchantId;
      }
      
      if (options.search) {
        query.$or = [
          { title: { $regex: options.search, $options: 'i' } },
          { description: { $regex: options.search, $options: 'i' } },
          { shortDescription: { $regex: options.search, $options: 'i' } },
          { longDescription: { $regex: options.search, $options: 'i' } },
          { sku: { $regex: options.search, $options: 'i' } },
          { barcode: { $regex: options.search, $options: 'i' } },
          { slug: { $regex: options.search, $options: 'i' } },
        ];
      }
      
      // Date range filter
      if (options.fromDate || options.toDate) {
        query.createdAt = {};
        
        if (options.fromDate) {
          query.createdAt.$gte = options.fromDate;
        }
        
        if (options.toDate) {
          query.createdAt.$lte = options.toDate;
        }
      }
      
      // Price range filter
      if (options.priceMin !== undefined || options.priceMax !== undefined) {
        query.price = {};
        
        if (options.priceMin !== undefined) {
          query.price.$gte = options.priceMin;
        }
        
        if (options.priceMax !== undefined) {
          query.price.$lte = options.priceMax;
        }
      }
      
      // Build sort
      const sort: any = {};
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
      sort[sortBy] = sortOrder;
      
      // Execute query with pagination
      const products = await ProductModel.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit);
      
      // Get total count for pagination
      const total = await ProductModel.countDocuments(query);
      
      // Calculate total pages
      const pages = Math.ceil(total / limit);
      
      return {
        products,
        total,
        page,
        pages,
      };
    } catch (error) {
      logger.error(`Error in admin product query: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Admin function to update a product (no ownership check)
   * @param productId Product ID
   * @param updates Updates to apply
   * @param adminId Admin user ID for audit
   * @returns Updated product
   */
  public static async adminUpdateProduct(
    productId: string | Types.ObjectId,
    updates: Partial<IProduct>,
    adminId: string
  ): Promise<IProduct | null> {
    try {
      // Find product
      const product = await ProductModel.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }
      
      // Apply updates directly (admins can update all fields)
      const updatedProduct = await ProductModel.findByIdAndUpdate(
        productId,
        updates,
        { new: true, runValidators: true }
      );
      
      // Log admin action for audit trail
      logger.info(`Admin ${adminId} updated product ${productId} (merchant: ${product.merchantId})`);
      
      return updatedProduct;
    } catch (error) {
      logger.error(`Error in admin product update: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * Get public product details (for checkout/public view)
   * @param productId Product ID
   * @returns Public product information
   */
  public static async getPublicProductDetails(
    productId: string | Types.ObjectId
  ): Promise<Partial<IProduct> | null> {
    try {
      // Find active product
      const product = await ProductModel.findOne({
        _id: productId,
        status: 'active'
      });
      
      if (!product) {
        return null;
      }
      
      // Return only public fields
      return {
        _id: product._id,
        title: product.title,
        description: product.description,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        price: product.price,
        currency: product.currency,
        type: product.type,
        variants: product.variants,
        images: product.images,
        // Don't include merchantId or other sensitive fields
      };
    } catch (error) {
      logger.error(`Error getting public product details: ${(error as Error).message}`);
      throw error;
    }
  }
}

export default ProductService;