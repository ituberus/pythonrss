import { Request, Response } from 'express';
import UserModel from '../models/user.model';
import MerchantModel from '../models/merchant.model';
import AddressModel from '../models/address.model';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

// @desc    Create or update business info (step 2 of onboarding)
// @route   POST /api/onboarding/business
// @access  Private
export const updateBusinessInfo = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { businessName, country, firstName, lastName } = req.body;
    const user = req.user;

    // Validate input
    if (!businessName || !country || !firstName || !lastName) {
      return errorResponse(res, 'Please provide all required fields', null, 400);
    }

    // Validate country
    if (!['US', 'BR'].includes(country)) {
      return errorResponse(res, 'Invalid country. Supported countries are US and BR', null, 400);
    }

    // Check if user already has a merchant profile
// -----------------------------------------------
// Create or update the merchant, then ALWAYS
// persist the user with merchantId + stage
// -----------------------------------------------
let merchant: any;

if (user.merchantId) {
  // Update existing merchant
  merchant = await MerchantModel.findByIdAndUpdate(
    user.merchantId,
    {
      businessName,
      country,
      firstName,
      lastName,
      defaultCurrency: country === 'BR' ? 'BRL' : 'USD',
    },
    { new: true }
  );
} else {
  // Create new merchant
  merchant = await MerchantModel.create({
    businessName,
    country,
    firstName,
    lastName,
    defaultCurrency: country === 'BR' ? 'BRL' : 'USD',
  });

  // Link the merchant to the user
  user.merchantId = merchant._id;
}

/* ── ALWAYS push the user to at least stage 2 and save ───────── */
if (user.onboardingStage < 2) {
  user.onboardingStage = 2;
}
await user.save();         // ← this was previously skipped for stage 2 users
/* ────────────────────────────────────────────────────────────── */


    // Check if merchant was created or updated successfully
    if (!merchant) {
      return errorResponse(res, 'Failed to create or update merchant profile', null, 500);
    }

    return successResponse(res, 'Business information updated successfully', {
      merchant: {
        id: merchant._id,
        businessName: merchant.businessName,
        country: merchant.country,
        firstName: merchant.firstName,
        lastName: merchant.lastName,
      },
      nextStep: 3,
    });
  } catch (error) {
    logger.error('Update business info error:', error);
    return errorResponse(res, 'Server error during business info update', null, 500);
  }
};

// @desc    Update address information (step 3 of onboarding)
// @route   POST /api/onboarding/address
// @access  Private
export const updateAddress = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {
      line1,
      line2,
      city,
      state,
      postalCode,
      country,
      timezone,
      phone, // Added phone field
    } = req.body;
    const user = req.user;

    // Validate input
    if (!line1 || !city || !state || !postalCode || !country || !timezone) {
      return errorResponse(res, 'Please provide all required fields', null, 400);
    }

    // Validate country
    if (!['US', 'BR'].includes(country)) {
      return errorResponse(res, 'Invalid country. Supported countries are US and BR', null, 400);
    }

    // Validate phone format if provided
    if (phone) {
      let isValidPhone = false;
      
      if (country === 'US') {
        // US phone validation - 10 digits, optional formatting
        isValidPhone = /^(\+1)?[\s-]?\(?(\d{3})\)?[\s-]?(\d{3})[\s-]?(\d{4})$/.test(phone);
      } else if (country === 'BR') {
        // Brazil phone validation - supports both mobile (with 9) and landline formats
        isValidPhone = /^(\+55)?[\s-]?\(?(\d{2})\)?[\s-]?9?(\d{4})[\s-]?(\d{4})$/.test(phone);
      }
      
      if (!isValidPhone) {
        return errorResponse(res, 'Invalid phone number format for the selected country', null, 400);
      }
    }

    // Ensure user has a merchant profile
    if (!user.merchantId) {
      return errorResponse(res, 'Business information must be set up first', null, 400);
    }

    // Check if merchant already has a legal address
    const existingAddress = await AddressModel.findOne({
      merchantId: user.merchantId,
      type: 'legal',
    });

    let address = null;
    if (existingAddress) {
      // Update existing address
      address = await AddressModel.findByIdAndUpdate(
        existingAddress._id,
        {
          line1,
          line2,
          city,
          state,
          postalCode,
          country,
          timezone,
          phone, // Added phone field
        },
        { new: true }
      );
    } else {
      // Create new address
      address = await AddressModel.create({
        merchantId: user.merchantId,
        type: 'legal',
        line1,
        line2,
        city,
        state,
        postalCode,
        country,
        timezone,
        phone, // Added phone field
      });
    }

    // Check if address was created or updated successfully
    if (!address) {
      return errorResponse(res, 'Failed to create or update address information', null, 500);
    }

    // Update user's timezone and onboarding stage
    user.timezone = timezone;
    if (user.onboardingStage <= 2) {
      user.onboardingStage = 3;
    }
    await user.save();

    return successResponse(res, 'Address information updated successfully', {
      address: {
        id: address._id,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        timezone: address.timezone,
        phone: address.phone, // Added phone field in response
      },
      nextStep: 4,
    });
  } catch (error) {
    logger.error('Update address error:', error);
    return errorResponse(res, 'Server error during address update', null, 500);
  }
};

// @desc    Update selling method (step 4 of onboarding)
// @route   POST /api/onboarding/selling-method
// @access  Private
export const updateSellingMethod = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { sellingMethod, integrationTypes } = req.body;
    const user = req.user;

    // Validate input
    if (!sellingMethod) {
      return errorResponse(res, 'Please provide a selling method', null, 400);
    }

    // Validate selling method
    if (!['hosted_store', 'integration'].includes(sellingMethod)) {
      return errorResponse(res, 'Invalid selling method', null, 400);
    }

    // Validate integration types if selling method is integration
    if (sellingMethod === 'integration' && (!integrationTypes || integrationTypes.length === 0)) {
      return errorResponse(res, 'Please provide at least one integration type', null, 400);
    }

    // Ensure user has a merchant profile
    if (!user.merchantId) {
      return errorResponse(res, 'Business information must be set up first', null, 400);
    }

    // Update merchant's selling method
    const merchant = await MerchantModel.findByIdAndUpdate(
      user.merchantId,
      {
        sellingMethod,
        integrationTypes: sellingMethod === 'integration' ? integrationTypes : [],
      },
      { new: true }
    );

    // Check if merchant was updated successfully
    if (!merchant) {
      return errorResponse(res, 'Failed to update selling method', null, 500);
    }

    // Complete onboarding
    user.onboardingStage = 4;
    user.onboardingComplete = true;
    await user.save();

    return successResponse(res, 'Selling method updated and onboarding completed', {
      merchant: {
        id: merchant._id,
        businessName: merchant.businessName,
        sellingMethod: merchant.sellingMethod,
        integrationTypes: merchant.integrationTypes,
      },
      onboardingComplete: true,
    });
  } catch (error) {
    logger.error('Update selling method error:', error);
    return errorResponse(res, 'Server error during selling method update', null, 500);
  }
};

// @desc    Get onboarding status and current step
// @route   GET /api/onboarding/status
// @access  Private
export const getOnboardingStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user;

    // Get merchant data if exists
    let merchantData = null;
    if (user.merchantId) {
      merchantData = await MerchantModel.findById(user.merchantId);
    }

    // Get address data if exists
    let addressData = null;
    if (user.merchantId) {
      addressData = await AddressModel.findOne({
        merchantId: user.merchantId,
        type: 'legal',
      });
    }

    return successResponse(res, 'Onboarding status retrieved successfully', {
      currentStage: user.onboardingStage,
      isComplete: user.onboardingComplete,
      emailVerified: user.emailVerifiedAt ? true : false,
      idVerified: user.idCheckStatus === 'verified',
      merchant: merchantData,
      address: addressData,
      nextStep: user.onboardingComplete ? null : user.onboardingStage + 1,
    });
  } catch (error) {
    logger.error('Get onboarding status error:', error);
    return errorResponse(res, 'Server error while fetching onboarding status', null, 500);
  }
};