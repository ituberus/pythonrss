// backend/src/controllers/admin.controller.ts
// Admin dashboard controller for document verification management

import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import UserModel from '../models/user.model';
import MerchantModel from '../models/merchant.model';
import VerificationModel from '../models/verification.model';
import PaymentRateModel from '../models/payment-rate.model';
import AddressModel from '../models/address.model';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';
import config from '../config/default';
import { maskSensitiveData, decryptData } from './verification.controller';

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
export const adminLogin = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { username, password, accessKey } = req.body;

    // Validate admin credentials from environment variables
    const adminUsers = (process.env.ADMIN_USERNAMES || '').split(',');
    const adminPasswords = (process.env.ADMIN_ACCESS_KEYS || '').split(',');

    // Find matching username and password pair
    const userIndex = adminUsers.findIndex(user => user.trim() === username);

    if (userIndex === -1 || adminPasswords[userIndex]?.trim() !== password) {
      return errorResponse(res, 'Invalid admin credentials', null, 401);
    }

    // Check if access key is provided and valid
    const hasFullAccess = accessKey === process.env.ADMIN_ACCESS_KEY;

    // Generate admin token with access flag
    const adminToken = Buffer.from(`${username}:${Date.now()}:${hasFullAccess}`).toString('base64');

    return successResponse(res, 'Admin login successful', {
      adminToken,
      hasFullAccess
    });
  } catch (error) {
    logger.error('Admin login error:', error);
    return errorResponse(res, 'An error occurred during admin login', null, 500);
  }
};

// @desc    Get pending verifications list
// @route   GET /api/admin/verifications/pending
// @access  Admin only
export const getPendingVerifications = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Find all verifications with pending status
    const pendingVerifications = await VerificationModel.find({ status: 'pending' })
      .populate('userId', 'email')
      .populate('merchantId', 'businessName country');

    // Clone and sanitize the data to ensure no sensitive information is revealed
    const sanitizedVerifications = pendingVerifications.map(verification => {
      const verificationObj = verification.toObject();

      // Remove sensitive document numbers from the response
      if (verificationObj.businessDocument && verificationObj.businessDocument.number) {
        verificationObj.businessDocument.number = '[Hidden]';
      }

      if (verificationObj.personalDocument && verificationObj.personalDocument.number) {
        verificationObj.personalDocument.number = '[Hidden]';
      }

      return verificationObj;
    });

    return successResponse(res, 'Pending verifications retrieved', { pendingVerifications: sanitizedVerifications });
  } catch (error) {
    logger.error('Error fetching pending verifications:', error);
    return errorResponse(res, 'An error occurred while fetching verifications', null, 500);
  }
};

// @desc    Get rejected verifications list
// @route   GET /api/admin/verifications/rejected
// @access  Admin only
export const getRejectedVerifications = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Find all verifications with rejected status
    const rejectedVerifications = await VerificationModel.find({ status: 'rejected' })
      .populate('userId', 'email')
      .populate('merchantId', 'businessName country');

    return successResponse(res, 'Rejected verifications retrieved', { rejectedVerifications });
  } catch (error) {
    logger.error('Error fetching rejected verifications:', error);
    return errorResponse(res, 'An error occurred while fetching verifications', null, 500);
  }
};

// @desc    Get verification details
// @route   GET /api/admin/verifications/:id
// @access  Admin only
export const getVerificationDetails = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Find verification by ID
    const verification = await VerificationModel.findById(id)
      .populate('userId', 'email idCheckStatus')
      .populate('merchantId', 'businessName country');

    if (!verification) {
      return errorResponse(res, 'Verification not found', null, 404);
    }

    // Clone verification object to avoid modifying the original stored data
    const resultVerification = JSON.parse(JSON.stringify(verification));

    // Handle document numbers based on access permissions
    if (!req.adminUser || !req.adminUser.hasFullAccess) {
      console.log("No access key - hiding sensitive document numbers");

      // Completely hide document numbers
      if (resultVerification.businessDocument) {
        resultVerification.businessDocument.number = "[Hidden - Access Key Required]";
      }

      if (resultVerification.personalDocument) {
        resultVerification.personalDocument.number = "[Hidden - Access Key Required]";
      }

      if (resultVerification.bankDetails) {
        resultVerification.bankDetails.accountNumber = "[Hidden - Access Key Required]";
        if (resultVerification.bankDetails.routingNumber) {
          resultVerification.bankDetails.routingNumber = "[Hidden - Access Key Required]";
        }
      }
    } else {
      // When access key is provided, decrypt sensitive data if necessary
      console.log("Access key provided - showing sensitive data");

      if (resultVerification.businessDocument?.number) {
        try {
          // Check if the number is in encrypted format
          if (resultVerification.businessDocument.number.includes(':')) {
            resultVerification.businessDocument.number = decryptData(resultVerification.businessDocument.number);
          }
        } catch (error) {
          console.error('Error decrypting business document number:', error);
          resultVerification.businessDocument.number = '[Decryption error]';
        }
      }

      if (resultVerification.personalDocument?.number) {
        try {
          // Check if the number is in encrypted format
          if (resultVerification.personalDocument.number.includes(':')) {
            resultVerification.personalDocument.number = decryptData(resultVerification.personalDocument.number);
          }
        } catch (error) {
          console.error('Error decrypting personal document number:', error);
          resultVerification.personalDocument.number = '[Decryption error]';
        }
      }
    }

    return successResponse(res, 'Verification details retrieved', {
      verification: resultVerification,
      hasFullAccess: req.adminUser?.hasFullAccess || false
    });
  } catch (error) {
    logger.error('Error fetching verification details:', error);
    return errorResponse(res, 'An error occurred while fetching verification details', null, 500);
  }
};

// @desc    Update verification status
// @route   POST /api/admin/verifications/:id/update
// @access  Admin only
export const updateVerificationStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const {
      overallStatus,
      businessDocStatus,
      personalDocStatus,
      bankDetailsStatus,
      rejectionNote,
      businessDocRejectionReason,
      personalDocRejectionReason,
      bankDetailsRejectionReason,
    } = req.body;

    // No document key check anymore - we rely on admin token with hasFullAccess

    // Find verification by ID
    const verification = await VerificationModel.findById(id);

    if (!verification) {
      return errorResponse(res, 'Verification not found', null, 404);
    }

    // Store the overall rejection note if provided
    if (rejectionNote) {
      verification.rejectionNote = rejectionNote;
    }

    // Update business document status
    if (businessDocStatus) {
      if (
        verification.businessDocument.status !== businessDocStatus ||
        (businessDocStatus === 'rejected' && businessDocRejectionReason)
      ) {
        verification.businessDocument.status = businessDocStatus;

        if (businessDocStatus === 'rejected' && businessDocRejectionReason) {
          verification.businessDocument.rejectionReason = businessDocRejectionReason;
        } else if (businessDocStatus === 'verified') {
          verification.businessDocument.rejectionReason = undefined;
        }
      }
    }

    // Update personal document status
    if (personalDocStatus) {
      if (
        verification.personalDocument.status !== personalDocStatus ||
        (personalDocStatus === 'rejected' && personalDocRejectionReason)
      ) {
        verification.personalDocument.status = personalDocStatus;

        if (personalDocStatus === 'rejected' && personalDocRejectionReason) {
          verification.personalDocument.rejectionReason = personalDocRejectionReason;
        } else if (personalDocStatus === 'verified') {
          verification.personalDocument.rejectionReason = undefined;
        }
      }
    }

    // Update bank details status
    if (bankDetailsStatus) {
      if (
        verification.bankDetails.status !== bankDetailsStatus ||
        (bankDetailsStatus === 'rejected' && bankDetailsRejectionReason)
      ) {
        verification.bankDetails.status = bankDetailsStatus;

        if (bankDetailsStatus === 'rejected' && bankDetailsRejectionReason) {
          verification.bankDetails.rejectionReason = bankDetailsRejectionReason;
        } else if (bankDetailsStatus === 'verified') {
          verification.bankDetails.rejectionReason = undefined;
        }
      }
    }

    // Update overall status if provided
    if (overallStatus) {
      verification.status = overallStatus;

      if (overallStatus === 'verified') {
        verification.verifiedAt = new Date();
      }

      const user = await UserModel.findById(verification.userId);
      if (user) {
        user.idCheckStatus = overallStatus;
        await user.save();
      }
    } else {
      const allDocumentsVerified =
        verification.businessDocument.status === 'verified' &&
        verification.personalDocument.status === 'verified' &&
        verification.bankDetails.status === 'verified';

      const anyDocumentRejected =
        verification.businessDocument.status === 'rejected' ||
        verification.personalDocument.status === 'rejected' ||
        verification.bankDetails.status === 'rejected';

      if (allDocumentsVerified) {
        verification.status = 'verified';
        verification.verifiedAt = new Date();

        const user = await UserModel.findById(verification.userId);
        if (user) {
          user.idCheckStatus = 'verified';
          await user.save();
        }
      } else if (anyDocumentRejected) {
        verification.status = 'rejected';

        const user = await UserModel.findById(verification.userId);
        if (user) {
          user.idCheckStatus = 'rejected';
          await user.save();
        }
      }
    }

    await verification.save();

    return successResponse(res, 'Verification status updated successfully', { verification });
  } catch (error) {
    logger.error('Error updating verification status:', error);
    return errorResponse(res, 'An error occurred while updating verification', null, 500);
  }
};

// @desc    Get document file
// @route   GET /api/admin/documents/:type/:id/:field
// @access  Admin only (full access)
export const getDocumentFile = async (req: Request, res: Response): Promise<any> => {
  try {
    const { type, id, field } = req.params;

    console.log('Document request received for:', { type, id, field });

    // Check if admin is authenticated and has full access
    // The authenticateAdmin middleware already verified the token in req.query.adminToken
    if (!req.adminUser || !req.adminUser.hasFullAccess) {
      return errorResponse(res, 'Access key required to view documents', null, 403);
    }

    // Find verification by ID
    const verification = await VerificationModel.findById(id);

    if (!verification) {
      return errorResponse(res, 'Verification not found', null, 404);
    }

    let filePath = '';

    // Determine file path based on type and field
    if (type === 'business') {
      filePath = verification.businessDocument.documentImage || '';
    } else if (type === 'personal') {
      if (field === 'front') {
        filePath = verification.personalDocument.frontImage || '';
      } else if (field === 'back') {
        filePath = verification.personalDocument.backImage || '';
      } else if (field === 'selfie') {
        filePath = verification.personalDocument.selfieImage || '';
      }
    } else if (type === 'bank') {
      filePath = verification.bankDetails.statementDocument || '';
    }

    if (!filePath) {
      return errorResponse(res, 'Document not found', null, 404);
    }

    // Resolve absolute file path
    const absFilePath = path.resolve(filePath);

    // Check if file exists
    if (!fs.existsSync(absFilePath)) {
      return errorResponse(res, 'Document file not found', null, 404);
    }

    // Set appropriate content type based on file extension
    const fileExt = path.extname(filePath).toLowerCase();
    if (fileExt === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (fileExt === '.jpg' || fileExt === '.jpeg') {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (fileExt === '.png') {
      res.setHeader('Content-Type', 'image/png');
    } else if (fileExt === '.gif') {
      res.setHeader('Content-Type', 'image/gif');
    }

    // Send file
    return res.sendFile(absFilePath);
  } catch (error) {
    console.error('Error fetching document file:', error);
    return errorResponse(res, 'An error occurred while fetching document', null, 500);
  }
};

// @desc    Get payment rates
// @route   GET /api/admin/payment-rates
// @access  Admin only
export const getPaymentRates = async (req: Request, res: Response): Promise<Response> => {
  try {
    const paymentRates = await PaymentRateModel.find().sort({ countries: 1, receiptDays: 1 });

    return successResponse(res, 'Payment rates retrieved', { paymentRates });
  } catch (error) {
    logger.error('Error fetching payment rates:', error);
    return errorResponse(res, 'An error occurred while fetching payment rates', null, 500);
  }
};

// @desc    Get payment rate by ID
// @route   GET /api/admin/payment-rates/:id
// @access  Admin only
export const getPaymentRateById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const paymentRate = await PaymentRateModel.findById(id);

    if (!paymentRate) {
      return errorResponse(res, 'Payment rate not found', null, 404);
    }

    return successResponse(res, 'Payment rate retrieved', { paymentRate });
  } catch (error) {
    logger.error('Error fetching payment rate:', error);
    return errorResponse(res, 'An error occurred while fetching payment rate', null, 500);
  }
};

// @desc    Create or update payment rate
// @route   POST /api/admin/payment-rates
// @access  Admin only
export const updatePaymentRate = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { countries, receiptDays, rateType, rateValue, currencies } = req.body;

    // Validate required fields
    if (!countries || !countries.length || !receiptDays || !rateType) {
      return errorResponse(res, 'Missing required fields', null, 400);
    }

    // Validate values based on rate type
    if (rateType === 'percentage' && rateValue === undefined) {
      return errorResponse(res, 'Rate value is required for percentage type', null, 400);
    }

    if (rateType === 'fixed' && (!currencies || (!currencies.USD && !currencies.BRL))) {
      return errorResponse(res, 'At least one currency rate is required for fixed type', null, 400);
    }

    // Prepare the rate object
    const rateData: any = {
      countries,
      receiptDays: parseInt(receiptDays),
      rateType,
    };

    // Set values based on rate type
    if (rateType === 'percentage') {
      rateData.rateValue = parseFloat(rateValue);
      rateData.currencies = { USD: undefined, BRL: undefined };
    } else {
      rateData.currencies = currencies;
      rateData.rateValue = undefined;
    }

    let paymentRate;

    if (id) {
      // Update existing rate
      paymentRate = await PaymentRateModel.findByIdAndUpdate(id, rateData, { new: true });
    } else {
      // Create new rate
      paymentRate = await PaymentRateModel.create(rateData);
    }

    if (!paymentRate) {
      return errorResponse(res, 'Failed to update payment rate', null, 500);
    }

    return successResponse(res, 'Payment rate updated successfully', { paymentRate });
  } catch (error) {
    logger.error('Error updating payment rate:', error);
    return errorResponse(res, 'An error occurred while updating payment rate', null, 500);
  }
};

// @desc    Delete payment rate
// @route   DELETE /api/admin/payment-rates/:id
// @access  Admin only
export const deletePaymentRate = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Find and delete rate
    const paymentRate = await PaymentRateModel.findByIdAndDelete(id);

    if (!paymentRate) {
      return errorResponse(res, 'Payment rate not found', null, 404);
    }

    return successResponse(res, 'Payment rate deleted successfully', null);
  } catch (error) {
    logger.error('Error deleting payment rate:', error);
    return errorResponse(res, 'An error occurred while deleting payment rate', null, 500);
  }
};

// @desc    Get users with filtering
// @route   GET /api/admin/users
// @access  Admin only
export const getUsers = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { status, search } = req.query;

    // Build the query
    let query: any = {};

    // Filter by status if provided
    if (status && status !== 'all') {
      if (status === 'verified' || status === 'pending' || status === 'rejected') {
        query.idCheckStatus = status;
      } else if (status === 'suspended' || status === 'blocked') {
        query.status = status;
      }
    }

    // Add search if provided
    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      query.$or = [{ email: searchRegex }];
    }

    // Fetch users with their merchant data
    const users = await UserModel.find(query)
      .populate('merchantId', 'businessName country')
      .sort({ createdAt: -1 });

    return successResponse(res, 'Users retrieved successfully', { users });
  } catch (error) {
    logger.error('Error fetching users:', error);
    return errorResponse(res, 'An error occurred while fetching users', null, 500);
  }
};

// @desc    Get user details
// @route   GET /api/admin/users/:id
// @access  Admin only
export const getUserDetails = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    // Find user by ID
    const user = await UserModel.findById(id).populate(
      'merchantId',
      'businessName country status sellingMethod integrationTypes',
    );

    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }

    // Get verification data if exists
    const verification = await VerificationModel.findOne({ userId: id });

    return successResponse(res, 'User details retrieved', { user, verification });
  } catch (error) {
    logger.error('Error fetching user details:', error);
    return errorResponse(res, 'An error occurred while fetching user details', null, 500);
  }
};

// @desc    Activate user (unblock or unsuspend)
// @route   POST /api/admin/users/:id/activate
// @access  Admin only
export const activateUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    // No document key check - we rely on admin token with hasFullAccess

    // Find user by ID
    const user = await UserModel.findById(id);

    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }

    // Update user status
    user.status = 'active';
    user.suspendedUntil = undefined;
    await user.save();

    return successResponse(res, 'User activated successfully', { user });
  } catch (error) {
    logger.error('Error activating user:', error);
    return errorResponse(res, 'An error occurred while activating user', null, 500);
  }
};

// @desc    Suspend user
// @route   POST /api/admin/users/:id/suspend
// @access  Admin only
export const suspendUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { suspendUntil } = req.body;

    // No document key check - we rely on admin token with hasFullAccess

    // Validate suspend until date
    if (!suspendUntil) {
      return errorResponse(res, 'Suspension end date is required', null, 400);
    }

    // Find user by ID
    const user = await UserModel.findById(id);

    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }

    // Update user status
    user.status = 'suspended';
    user.suspendedUntil = new Date(suspendUntil);
    await user.save();

    return successResponse(res, 'User suspended successfully', { user });
  } catch (error) {
    logger.error('Error suspending user:', error);
    return errorResponse(res, 'An error occurred while suspending user', null, 500);
  }
};

// @desc    Block user
// @route   POST /api/admin/users/:id/block
// @access  Admin only
export const blockUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    // No document key check - we rely on admin token with hasFullAccess

    // Find user by ID
    const user = await UserModel.findById(id);

    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }

    // Update user status
    user.status = 'blocked';
    await user.save();

    return successResponse(res, 'User blocked successfully', { user });
  } catch (error) {
    logger.error('Error blocking user:', error);
    return errorResponse(res, 'An error occurred while blocking user', null, 500);
  }
};

// @desc    Request verification resubmission
// @route   POST /api/admin/users/:id/resubmit
// @access  Admin only
export const resubmitVerification = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    // No document key check - we rely on admin token with hasFullAccess

    // Find user by ID
    const user = await UserModel.findById(id);

    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }

    // Find and update verification document if exists
    const verification = await VerificationModel.findOne({ userId: id });
    if (verification) {
      // Set status of specific sections to rejected to request resubmission
      verification.status = 'pending';

      if (verification.businessDocument.status !== 'verified') {
        verification.businessDocument.status = 'rejected';
        verification.businessDocument.rejectionReason = 'Resubmission required by admin';
      }
      if (verification.personalDocument.status !== 'verified') {
        verification.personalDocument.status = 'rejected';
        verification.personalDocument.rejectionReason = 'Resubmission required by admin';
      }
      if (verification.bankDetails.status !== 'verified') {
        verification.bankDetails.status = 'rejected';
        verification.bankDetails.rejectionReason = 'Resubmission required by admin';
      }

      verification.rejectionNote = 'Please resubmit the marked verification documents as requested by administrator';

      await verification.save();

      user.idCheckStatus = 'pending';
      await user.save();
    } else {
      return errorResponse(res, 'No verification record found for this user', null, 404);
    }

    return successResponse(res, 'Verification resubmission requested successfully', {
      user,
      verification: {
        businessDocStatus: verification.businessDocument.status,
        personalDocStatus: verification.personalDocument.status,
        bankDetailsStatus: verification.bankDetails.status,
        overallStatus: verification.status,
      },
    });
  } catch (error) {
    logger.error('Error requesting verification resubmission:', error);
    return errorResponse(res, 'An error occurred while requesting verification resubmission', null, 500);
  }
};

// @desc    Unverify a user
// @route   POST /api/admin/users/:id/unverify
// @access  Admin only
export const unverifyUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    // No document key check - we rely on admin token with hasFullAccess

    // Find the user
    const user = await UserModel.findById(id);

    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }

    // Reset verification status
    user.idCheckStatus = undefined;
    await user.save();

    // Find verification document if exists
    const verification = await VerificationModel.findOne({ userId: id });
    if (verification) {
      verification.status = 'rejected';
      verification.businessDocument.status = 'rejected';
      verification.businessDocument.rejectionReason = 'Resubmission required by admin';
      verification.personalDocument.status = 'rejected';
      verification.personalDocument.rejectionReason = 'Resubmission required by admin';
      verification.bankDetails.status = 'rejected';
      verification.bankDetails.rejectionReason = 'Resubmission required by admin';
      verification.rejectionNote = 'All verification documents must be resubmitted as requested by administrator';

      await verification.save();
    }

    return successResponse(res, 'User verification status reset successfully', null);
  } catch (error) {
    logger.error('Error unverifying user:', error);
    return errorResponse(res, 'An error occurred while resetting verification status', null, 500);
  }
};

// @desc    Edit user information
// @route   POST /api/admin/users/:id/edit
// @access  Admin only
export const editUserInfo = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;
    
    // No document key check - we rely on admin token with hasFullAccess

    const user = await UserModel.findById(id);
    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }

    switch (field) {
      case 'email':
        const existingUser = await UserModel.findOne({ email: value, _id: { $ne: id } });
        if (existingUser) {
          return errorResponse(res, 'Email already in use by another account', null, 400);
        }
        user.email = value;
        break;

      case 'role':
        if (!['merchant', 'admin'].includes(value)) {
          return errorResponse(res, 'Invalid role value', null, 400);
        }
        user.role = value;
        break;

      case 'status':
        if (!['active', 'suspended', 'blocked'].includes(value)) {
          return errorResponse(res, 'Invalid status value', null, 400);
        }
        user.status = value;
        break;

      case 'suspendedUntil':
        if (user.status !== 'suspended') {
          return errorResponse(res, 'User must be suspended to set suspension end date', null, 400);
        }
        user.suspendedUntil = new Date(value);
        break;

      case 'idCheckStatus':
        if (!['', 'pending', 'verified', 'rejected'].includes(value)) {
          return errorResponse(res, 'Invalid verification status', null, 400);
        }
        user.idCheckStatus = value || undefined;
        break;

      case 'emailVerified':
        const isVerified = value === 'true';
        user.emailVerifiedAt = isVerified ? new Date() : undefined;
        break;

      case 'businessName':
        if (!user.merchantId) {
          return errorResponse(res, 'User does not have a merchant profile', null, 400);
        }
        const merchant = await MerchantModel.findById(user.merchantId);
        if (!merchant) {
          return errorResponse(res, 'Merchant profile not found', null, 404);
        }
        merchant.businessName = value;
        await merchant.save();
        break;

      case 'country':
        if (!user.merchantId) {
          return errorResponse(res, 'User does not have a merchant profile', null, 400);
        }
        if (!['US', 'BR'].includes(value)) {
          return errorResponse(res, 'Invalid country code. Supported countries are US and BR', null, 400);
        }
        const merchantForCountry = await MerchantModel.findById(user.merchantId);
        if (!merchantForCountry) {
          return errorResponse(res, 'Merchant profile not found', null, 404);
        }
        merchantForCountry.country = value as 'US' | 'BR';
        merchantForCountry.defaultCurrency = value === 'BR' ? 'BRL' : 'USD';
        await merchantForCountry.save();
        break;

      case 'sellingMethod':
        if (!user.merchantId) {
          return errorResponse(res, 'User does not have a merchant profile', null, 400);
        }
        if (!['hosted_store', 'integration'].includes(value)) {
          return errorResponse(res, 'Invalid selling method', null, 400);
        }
        const merchantForMethod = await MerchantModel.findById(user.merchantId);
        if (!merchantForMethod) {
          return errorResponse(res, 'Merchant profile not found', null, 404);
        }
        merchantForMethod.sellingMethod = value as 'hosted_store' | 'integration';
        await merchantForMethod.save();
        break;

      default:
        return errorResponse(res, `Cannot edit field "${field}"`, null, 400);
    }

    await user.save();

    return successResponse(res, `Successfully updated ${field}`, { field, value });
  } catch (error) {
    logger.error('Error editing user info:', error);
    return errorResponse(res, 'An error occurred while updating user information', null, 500);
  }
};

// @desc    Delete user account
// @route   POST /api/admin/users/:id/delete
// @access  Admin only
export const deleteUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    
    // No document key check - we rely on admin token with hasFullAccess

    const user = await UserModel.findById(id);

    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }

    if (user.merchantId) {
      await MerchantModel.findByIdAndDelete(user.merchantId);
      await AddressModel.deleteMany({ merchantId: user.merchantId });

      const verification = await VerificationModel.findOne({ merchantId: user.merchantId });
      if (verification) {
        const filesToDelete = [
          verification.businessDocument?.documentImage,
          verification.personalDocument?.frontImage,
          verification.personalDocument?.backImage,
          verification.personalDocument?.selfieImage,
          verification.bankDetails?.statementDocument,
        ].filter(Boolean);

        for (const filePath of filesToDelete) {
          if (filePath && fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (err) {
              logger.error(`Error deleting file ${filePath}:`, err);
            }
          }
        }

        await VerificationModel.deleteOne({ _id: verification._id });
      }
    }

    await UserModel.findByIdAndDelete(id);

    return successResponse(res, 'User deleted successfully', null);
  } catch (error) {
    logger.error('Error deleting user:', error);
    return errorResponse(res, 'An error occurred while deleting user', null, 500);
  }
};
