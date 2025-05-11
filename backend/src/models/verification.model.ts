// backend/src/models/verification.model.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDocument {
  type: string;
  number?: string;
  frontImage?: string;
  backImage?: string;
  selfieImage?: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  uploadedAt: Date;
  updatedAt?: Date;
  verifiedAt?: Date;
}

export interface IVerification extends Document {
  merchantId: Types.ObjectId;
  userId: Types.ObjectId;
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: Date;
  updatedAt?: Date;
  verifiedAt?: Date;
  rejectionNote?: string; // Added this field
  
  // Business document
  businessDocument: {
    type: string; // EIN, SSN, CNPJ, CPF
    number: string;
    documentImage?: string;
    status: 'pending' | 'verified' | 'rejected';
    rejectionReason?: string;
  };
  
  // Personal document
  personalDocument: {
    type: string; // National ID, Driver's License, Passport
    number: string;
    frontImage?: string;
    backImage?: string;
    selfieImage?: string;
    status: 'pending' | 'verified' | 'rejected';
    rejectionReason?: string;
  };
  
  // Bank details
  bankDetails: {
    accountName: string;
    accountNumber: string;
    routingNumber?: string; // For US
    bankName: string;
    bankBranch?: string; // For Brazil
    statementDocument?: string;
    status: 'pending' | 'verified' | 'rejected';
    rejectionReason?: string;
  };
  
  // Payment settings
  paymentSettings: {
    receiptTime: 5 | 14;
    rateType: 'percentage' | 'fixed';
    rateValue: number;
    methods: {
      creditCard: boolean;
      paypal: boolean;
      wallets: boolean;
      pix: boolean;
    };
  };
}

const VerificationSchema = new Schema<IVerification>(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
    },
    verifiedAt: {
      type: Date,
    },
    rejectionNote: {
      type: String,
    },
    businessDocument: {
      type: {
        type: String,
        required: true,
      },
      number: {
        type: String,
        required: true,
      },
      documentImage: {
        type: String,
      },
      status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
      },
      rejectionReason: {
        type: String,
      },
    },
    personalDocument: {
      type: {
        type: String,
        required: true,
      },
      number: {
        type: String,
        required: true,
      },
      frontImage: {
        type: String,
      },
      backImage: {
        type: String,
      },
      selfieImage: {
        type: String,
      },
      status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
      },
      rejectionReason: {
        type: String,
      },
    },
    bankDetails: {
      accountName: {
        type: String,
        required: true,
      },
      accountNumber: {
        type: String,
        required: true,
      },
      routingNumber: {
        type: String,
      },
      bankName: {
        type: String,
        required: true,
      },
      bankBranch: {
        type: String,
      },
      statementDocument: {
        type: String,
      },
      status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
      },
      rejectionReason: {
        type: String,
      },
    },
    paymentSettings: {
      receiptTime: {
        type: Number,
        enum: [5, 14],
        default: 14,
      },
      rateType: {
        type: String,
        enum: ['percentage', 'fixed'],
        default: 'percentage',
      },
      rateValue: {
        type: Number,
        default: 0,
      },
      methods: {
        creditCard: {
          type: Boolean,
          default: true,
        },
        paypal: {
          type: Boolean,
          default: true,
        },
        wallets: {
          type: Boolean,
          default: true,
        },
        pix: {
          type: Boolean,
          default: true,
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IVerification>('Verification', VerificationSchema);