// src/models/product.model.ts - Updated with new fields
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IShippingMethod {
  name: string;
  price: number; // 0 means free shipping
}

export interface IVariant {
  name: string;
  values: string[];
  stock: number;
}

export interface IImage {
  url: string;
  isMain: boolean;
}

export interface IDigitalOptions {
  fileUrl?: string;
  fileUpload?: string;
  recurring?: {
    interval: 'monthly' | 'yearly';
    trialDays?: number;
    hasTrial: boolean;
  };
}

export interface IPhysicalOptions {
  weight?: number;  // in kg
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  shippingClass?: string;
  stock?: number;
  shippingMethods?: IShippingMethod[];
}

export interface IProduct extends Document {
  merchantId: Types.ObjectId;
  title: string;
  shortDescription: string;  // Short description for listings
  longDescription: string;   // Detailed description with HTML
  description: string;       // Original description field (kept for backward compatibility)
  slug: string;              // Unique product identifier for URLs
  price: number;
  currency: string;          // Currency code (USD, BRL, EUR, etc.)
  type: 'digital' | 'physical';
  sku?: string;              // Stock Keeping Unit
  barcode?: string;          // Barcode (ISBN, UPC, GTIN, etc.)
  digital?: IDigitalOptions;
  physical?: IPhysicalOptions;
  variants?: IVariant[];
  images: IImage[];
  status: 'active' | 'deactivated' | 'deleted';
  listedAt: Date;
  delistedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Define subdocument schemas separately for better type handling
const ShippingMethodSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
});

const VariantSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  values: [{
    type: String,
    required: true,
    trim: true,
  }],
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
});

const ImageSchema = new Schema({
  url: {
    type: String,
    required: true,
    // Accept both full URLs and server paths
    validate: {
      validator: function(v: string) {
        // Accept both full URLs, absolute paths, and relative paths
        return /^(https?:\/\/|\/).*/.test(v);
      },
      message: (props: { value: string }) => `${props.value} is not a valid URL or path!`
    },
  },
  isMain: {
    type: Boolean,
    default: false
  }
});

const DigitalOptionsSchema = new Schema({
  fileUrl: {
    type: String,
  },
  fileUpload: {
    type: String,
  },
  recurring: {
    interval: {
      type: String,
      enum: ['monthly', 'yearly'],
    },
    hasTrial: {
      type: Boolean,
      default: false
    },
    trialDays: {
      type: Number,
      min: 0,
      max: 90,
    },
  },
});

const PhysicalOptionsSchema = new Schema({
  weight: {
    type: Number,
    min: 0,
  },
  dimensions: {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
  },
  shippingClass: {
    type: String,
    trim: true,
  },
  stock: {
    type: Number,
    min: 0,
    default: 0
  },
  shippingMethods: [ShippingMethodSchema],
});

const ProductSchema = new Schema<IProduct>(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    shortDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    longDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      // Common currencies (can be expanded later)
      enum: ['USD', 'BRL', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
    },
    type: {
      type: String,
      required: true,
      enum: ['digital', 'physical'],
    },
    // New inventory fields
    sku: {
      type: String,
      trim: true,
      sparse: true,
      maxlength: 100,
    },
    barcode: {
      type: String,
      trim: true,
      sparse: true,
      maxlength: 100,
    },
    digital: DigitalOptionsSchema,
    physical: PhysicalOptionsSchema,
    variants: [VariantSchema],
    images: [ImageSchema],
    status: {
      type: String,
      enum: ['active', 'deactivated', 'deleted'],
      default: 'active',
    },
    listedAt: {
      type: Date,
      default: Date.now,
    },
    delistedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to ensure one main image
ProductSchema.pre('save', function(next) {
  // If there are no images, skip this validation
  if (!this.images || this.images.length === 0) {
    return next();
  }
  
  // Check if there's already a main image
  const mainImageExists = this.images.some(image => image.isMain);
  
  // If no main image exists, set the first image as main
  if (!mainImageExists && this.images.length > 0) {
    this.images[0].isMain = true;
  }
  
  // Ensure only one image is set as main
  let mainImageCount = 0;
  
  this.images.forEach(image => {
    if (image.isMain) {
      mainImageCount++;
    }
  });
  
  // If multiple main images, keep only the first one as main
  if (mainImageCount > 1) {
    let foundMain = false;
    
    this.images = this.images.map(image => {
      if (image.isMain) {
        if (!foundMain) {
          foundMain = true;
        } else {
          image.isMain = false;
        }
      }
      return image;
    });
  }
  
  // Ensure descriptions are in sync if they're missing
  // For backwards compatibility
  if (!this.shortDescription && this.description) {
    this.shortDescription = this.description;
  }
  
  if (!this.longDescription && this.description) {
    this.longDescription = this.description;
  }
  
  if (!this.description && (this.shortDescription || this.longDescription)) {
    this.description = this.shortDescription || this.longDescription;
  }
  
  // Validate variants have unique names
  if (this.variants && this.variants.length > 0) {
    const variantNames = new Set();
    for (const variant of this.variants) {
      if (variantNames.has(variant.name.toLowerCase())) {
        const error = new Error(`Duplicate variant name: ${variant.name}`);
        return next(error);
      }
      variantNames.add(variant.name.toLowerCase());
    }
  }

  // Validate maximum 10 images
  if (this.images && this.images.length > 10) {
    const error = new Error('Maximum 10 images allowed per product');
    return next(error);
  }
  
  next();
});

// Create useful indexes
ProductSchema.index({ merchantId: 1, status: 1 });
ProductSchema.index({ title: 'text', shortDescription: 'text', longDescription: 'text', description: 'text' });
ProductSchema.index({ currency: 1 });
ProductSchema.index({ type: 1 });
ProductSchema.index({ listedAt: -1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ sku: 1 });

export default mongoose.model<IProduct>('Product', ProductSchema);