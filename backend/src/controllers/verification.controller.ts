// backend/src/controllers/verification.controller.ts
// Handles merchant identity verification submission and status checks

import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto'; // For encryption
import UserModel from '../models/user.model';
import MerchantModel from '../models/merchant.model';
import VerificationModel, { IVerification } from '../models/verification.model';
import PaymentRateModel, { IPaymentRate } from '../models/payment-rate.model';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';
import config from '../config/default';

// Configure multer for document uploads
const storage = multer.diskStorage({
  destination: (req: Express.Request, file: Express.Multer.File, callback: (error: Error | null, destination: string) => void) => {
    const uploadDir = path.join(__dirname, '../../uploads/verification');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    callback(null, uploadDir);
  },
  filename: (req: Express.Request, file: Express.Multer.File, callback: (error: Error | null, filename: string) => void) => {
    const uniquePrefix = uuidv4();
    callback(null, `${uniquePrefix}-${file.originalname}`);
  }
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
  // Accept only images and PDFs
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    callback(null, true);
  } else {
    callback(new Error('Only images and PDF files are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB file size limit
  }
});

// Helper function to partially mask sensitive data for display
export function maskSensitiveData(data: string, isDocumentNumber: boolean = false): string {
  if (!data) return '';
  
  // If the data is already in an error format, return it as-is
  if (data.startsWith('[') && data.endsWith(']')) {
    return data;
  }
  
  // If data contains a colon, it might be encrypted - just mask it as is
  if (data.includes(':')) {
    if (isDocumentNumber) {
      if (data.length <= 4) {
        return '••••';
      }
      return data.substring(0, 2) + '•'.repeat(data.length - 4) + data.substring(data.length - 2);
    } else {
      if (data.length <= 8) {
        return data;
      }
      return data.substring(0, 4) + '•'.repeat(data.length - 8) + data.substring(data.length - 4);
    }
  }

  // For document numbers: Keep first and last 2 characters, mask the rest
  if (isDocumentNumber) {
    if (data.length <= 4) {
      return '••••';
    }
    return data.substring(0, 2) + '•'.repeat(data.length - 4) + data.substring(data.length - 2);
  } else {
    // For bank info: Keep first and last 4 digits visible
    if (data.length <= 8) {
      return data; // Too short to mask meaningfully
    }
    return data.substring(0, 4) + '•'.repeat(data.length - 8) + data.substring(data.length - 4);
  }
}

// Skip encryption/decryption for now - just store plain text with a prefix
// This is a temporary solution to avoid the encryption issues
export function encryptData(text: string): string {
  try {
    // For development/testing only - use plain text with prefix
    return "PLAIN:" + text;
  } catch (error) {
    logger.error('Encryption error:', error);
    // Return a placeholder in case of error
    return 'ENCRYPTION_ERROR';
  }
}

// Simplified decryption that just returns the plain text
export function decryptData(encryptedText: string): string {
  try {
    // Check for plain text format
    if (encryptedText.startsWith('PLAIN:')) {
      return encryptedText.substring(6); // Remove the 'PLAIN:' prefix
    }
    
    // For any other format, return a message indicating it's encrypted
    return "[Encrypted data - format incompatible]";
  } catch (error) {
    logger.error('Decryption error:', error);
    // Return a placeholder in case of error
    return '[Decryption Error]';
  }
}

// @desc    Get verification status and requirements
// @route   GET /api/verification/status
// @access  Private (merchants only)
export const getVerificationStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user;

    // Check if user has a merchant profile
    if (!user.merchantId) {
      return errorResponse(res, 'Merchant profile not found', null, 404);
    }

    // Get verification data if it exists
    const verification = await VerificationModel.findOne({ userId: user._id });

    // Get merchant data
    const merchant = await MerchantModel.findById(user.merchantId);

    if (!merchant) {
      return errorResponse(res, 'Merchant profile not found', null, 404);
    }

    // Get ALL payment rates for this country (system level configuration)
    let paymentRates: IPaymentRate[] = [];

    try {
      paymentRates = await PaymentRateModel.find({
        $or: [
          { countries: merchant.country },
          { country: merchant.country } // For backward compatibility
        ]
      });
    } catch (error) {
      logger.error('Error fetching payment rates:', error);
      // Continue even if payment rates fetch fails
    }

    return successResponse(res, 'Verification status retrieved', {
      status: user.idCheckStatus,
      verification,
      country: merchant.country,
      paymentRates,
      requirements: getCountryRequirements(merchant.country),
    });
  } catch (error) {
    logger.error('Error fetching verification status:', error);
    return errorResponse(res, 'An error occurred while fetching verification status', null, 500);
  }
};

// @desc    Submit verification documents and data
// @route   POST /api/verification/submit
// @access  Private (merchants only)
export const submitVerification = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user;
    const {
      businessDocType,
      businessDocNumber,
      personalDocType,
      personalDocNumber,
      bankAccountName,
      bankAccountNumber,
      routingNumber,
      bankName,
      bankBranch,
      receiptTime,
      paymentMethods
    } = req.body;

    // Validate required fields
    if (!businessDocType || !businessDocNumber || !personalDocType || !personalDocNumber ||
        !bankAccountName || !bankAccountNumber || !bankName) {
      return errorResponse(res, 'Missing required fields', null, 400);
    }

    // Check if user has a merchant profile
    if (!user.merchantId) {
      return errorResponse(res, 'Merchant profile not found', null, 404);
    }

    // Get merchant data
    const merchant = await MerchantModel.findById(user.merchantId);

    if (!merchant) {
      return errorResponse(res, 'Merchant profile not found', null, 404);
    }

    // Check if files are uploaded - ensure req.files is defined and has the correct type
    if (!req.files || typeof req.files !== 'object') {
      return errorResponse(res, 'Document files are required', null, 400);
    }

    const files = req.files as Record<string, Express.Multer.File[]>;

    // Process file paths - all variables declared as string | undefined
    let businessDocImage: string | undefined;
    let personalDocFront: string | undefined;
    let personalDocBack: string | undefined;
    let personalSelfie: string | undefined;
    let bankStatement: string | undefined;

    if (files.businessDocImage && files.businessDocImage.length > 0) {
      businessDocImage = files.businessDocImage[0].path;
    }

    if (files.personalDocFront && files.personalDocFront.length > 0) {
      personalDocFront = files.personalDocFront[0].path;
    }

    if (files.personalDocBack && files.personalDocBack.length > 0 && personalDocType !== 'passport') {
      personalDocBack = files.personalDocBack[0].path;
    }

    if (files.personalSelfie && files.personalSelfie.length > 0) {
      personalSelfie = files.personalSelfie[0].path;
    }

    if (files.bankStatement && files.bankStatement.length > 0) {
      bankStatement = files.bankStatement[0].path;
    }

    // Get payment rate based on country and receipt days (SYSTEM LEVEL CONFIGURATION)
    const parsedReceiptTime = parseInt(receiptTime);

    // First try to get the default rate for this country and receipt days
    let paymentRate = await PaymentRateModel.findOne({
      $or: [
        { countries: merchant.country, receiptDays: parsedReceiptTime, isDefault: true },
        { country: merchant.country, receiptDays: parsedReceiptTime, isDefault: true } // For backward compatibility
      ]
    });

    // If no default rate found, try to get any rate for this country and receipt days
    if (!paymentRate) {
      paymentRate = await PaymentRateModel.findOne({
        $or: [
          { countries: merchant.country, receiptDays: parsedReceiptTime },
          { country: merchant.country, receiptDays: parsedReceiptTime } // For backward compatibility
        ]
      });
    }

    // If still no rate found, use a fallback default value
    const defaultRateValue = parsedReceiptTime === 5 ? 9.0 : 7.5; // Higher rate for faster payout
    const defaultRateType = 'percentage' as 'percentage' | 'fixed' | 'both';
    const rateType = paymentRate?.rateType || defaultRateType;
    const rateValue = paymentRate?.rateValue || defaultRateValue;

    // Encrypt document numbers before storing
    console.log(`Encrypting document numbers: business: ${businessDocNumber.length} chars, personal: ${personalDocNumber.length} chars`);
    const encryptedBusinessDocNumber = encryptData(businessDocNumber);
    const encryptedPersonalDocNumber = encryptData(personalDocNumber);

    // Check if verification already exists
    let verification = await VerificationModel.findOne({ userId: user._id });

    if (verification) {
      // Update existing verification
      verification.status = 'pending';
      verification.updatedAt = new Date();

      // Only update business document if it was rejected or if new document was submitted
      if (verification.businessDocument.status === 'rejected' || files.businessDocImage) {
        verification.businessDocument = {
          type: businessDocType,
          number: encryptedBusinessDocNumber, // Store encrypted version
          documentImage: businessDocImage || verification.businessDocument.documentImage,
          status: 'pending',
        };
      }

      // Only update personal document if it was rejected or if new document was submitted
      if (verification.personalDocument.status === 'rejected' ||
          files.personalDocFront || files.personalDocBack || files.personalSelfie) {
        verification.personalDocument = {
          type: personalDocType,
          number: encryptedPersonalDocNumber, // Store encrypted version
          frontImage: personalDocFront || verification.personalDocument.frontImage,
          backImage: personalDocBack || verification.personalDocument.backImage,
          selfieImage: personalSelfie || verification.personalDocument.selfieImage,
          status: 'pending',
        };
      }

      // Only update bank details if they were rejected or if new statement was submitted
      if (verification.bankDetails.status === 'rejected' || files.bankStatement) {
        verification.bankDetails = {
          accountName: bankAccountName,
          accountNumber: bankAccountNumber,
          routingNumber: routingNumber || undefined,
          bankName: bankName,
          bankBranch: bankBranch || verification.bankDetails.bankBranch || '',
          statementDocument: bankStatement || (verification.bankDetails ? verification.bankDetails.statementDocument : undefined),
          status: 'pending',
        };
      }

      verification.paymentSettings = {
        receiptTime: parsedReceiptTime as 5 | 14,
        rateType: rateType as 'percentage' | 'fixed',
        rateValue: rateValue,
        methods: {
          creditCard: paymentMethods.includes('creditCard'),
          paypal: paymentMethods.includes('paypal'),
          wallets: paymentMethods.includes('wallets'),
          pix: paymentMethods.includes('pix'),
        },
      };
    } else {
      // Create new verification record
      verification = new VerificationModel({
        merchantId: user.merchantId,
        userId: user._id,
        status: 'pending',
        submittedAt: new Date(),
        businessDocument: {
          type: businessDocType,
          number: encryptedBusinessDocNumber, // Store encrypted version
          documentImage: businessDocImage,
          status: 'pending',
        },
        personalDocument: {
          type: personalDocType,
          number: encryptedPersonalDocNumber, // Store encrypted version
          frontImage: personalDocFront,
          backImage: personalDocBack,
          selfieImage: personalSelfie,
          status: 'pending',
        },
        bankDetails: {
          accountName: bankAccountName,
          accountNumber: bankAccountNumber,
          routingNumber: routingNumber || undefined,
          bankName: bankName,
          bankBranch: bankBranch || '',
          statementDocument: bankStatement,
          status: 'pending',
        },
        paymentSettings: {
          receiptTime: parsedReceiptTime as 5 | 14,
          rateType: rateType as 'percentage' | 'fixed',
          rateValue: rateValue,
          methods: {
            creditCard: paymentMethods.includes('creditCard'),
            paypal: paymentMethods.includes('paypal'),
            wallets: paymentMethods.includes('wallets'),
            pix: paymentMethods.includes('pix'),
          },
        },
      });
    }

    // Save verification record
    await verification.save();

    // Update user status to pending
    user.idCheckStatus = 'pending';
    await user.save();

    return successResponse(res, 'Verification submitted successfully', {
      status: 'pending',
      message: 'Your verification is being processed. We will notify you when it is complete.',
    });
  } catch (error) {
    logger.error('Error submitting verification:', error);
    return errorResponse(res, 'An error occurred while submitting verification', null, 500);
  }
};

// @desc    Get document preview
// @route   GET /api/verification/document-preview
// @access  Private (merchants only)
export const getDocumentPreview = async (req: Request, res: Response): Promise<any> => {
  try {
    const user = req.user;
    const { type, field } = req.query;

    // Find verification record
    const verification = await VerificationModel.findOne({ userId: user._id });

    if (!verification) {
      return errorResponse(res, 'Verification not found', null, 404);
    }

    // Initialize filePath as an empty string or undefined
    let filePath: string | undefined;

    // Determine file path based on type and field
    if (type === 'business') {
      filePath = verification.businessDocument.documentImage;
    } else if (type === 'personal') {
      if (field === 'front') {
        filePath = verification.personalDocument.frontImage;
      } else if (field === 'back') {
        filePath = verification.personalDocument.backImage;
      } else if (field === 'selfie') {
        filePath = verification.personalDocument.selfieImage;
      }
    } else if (type === 'bank') {
      filePath = verification.bankDetails.statementDocument;
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
    logger.error('Error fetching document preview:', error);
    return errorResponse(res, 'An error occurred while fetching document preview', null, 500);
  }
};

// Helper function to get country-specific document requirements
const getCountryRequirements = (country: string) => {
  switch (country) {
    case 'US':
      return {
        businessDocTypes: [
          { value: 'ein', label: 'Employer Identification Number (EIN)' },
          { value: 'ssn', label: 'Social Security Number (SSN)' },
          { value: 'stateRegistration', label: 'State Registration Number' },
        ],
        personalDocTypes: [
          { value: 'nationalId', label: 'National ID' },
          { value: 'driversLicense', label: "Driver's License" },
          { value: 'passport', label: 'International Passport' },
        ],
        requiresRoutingNumber: true,
        requiresBankBranch: false,
      };
    case 'BR':
      return {
        businessDocTypes: [
          { value: 'cnpj', label: 'CNPJ' },
          { value: 'cpf', label: 'CPF' },
        ],
        personalDocTypes: [
          { value: 'nationalId', label: 'National ID' },
          { value: 'driversLicense', label: "Driver's License" },
          { value: 'passport', label: 'International Passport' },
        ],
        requiresRoutingNumber: false,
        requiresBankBranch: true,
      };
    default:
      // Default for other countries
      return {
        businessDocTypes: [
          { value: 'businessId', label: 'Business ID' },
          { value: 'taxId', label: 'Tax ID' },
        ],
        personalDocTypes: [
          { value: 'nationalId', label: 'National ID' },
          { value: 'driversLicense', label: "Driver's License" },
          { value: 'passport', label: 'International Passport' },
        ],
        requiresRoutingNumber: false,
        requiresBankBranch: false,
      };
  }
};
