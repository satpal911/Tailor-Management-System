import mongoose from 'mongoose';

const shopApplicationSchema = new mongoose.Schema(
  {
    ownerName: { type: String, required: true, trim: true, maxlength: 120 },
    shopName: { type: String, required: true, trim: true, maxlength: 120 },
    ownerEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    phoneNormalized: { type: String, required: true },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    businessDetails: { type: String, trim: true, maxlength: 1000, default: '' },
    plan: { type: String, enum: ['STARTER', 'GROWTH', 'STUDIO'], required: true },
    customDomain: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'APPROVED', 'REJECTED'],
      default: 'NEW',
      index: true,
    },
    internalNotes: { type: String, trim: true, maxlength: 5000, default: '' },
    paymentStatus: {
      type: String,
      enum: ['NOT_STARTED', 'PENDING', 'VERIFIED', 'NOT_REQUIRED'],
      default: 'NOT_STARTED',
      index: true,
    },
    activeSubmissionKey: { type: String, select: false },
    provisioningStatus: {
      type: String,
      enum: ['NOT_STARTED', 'IN_PROGRESS', 'FAILED', 'COMPLETE'],
      default: 'NOT_STARTED',
    },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    domain: { type: String, trim: true, default: '' },
    activationTokenHash: { type: String, select: false, default: undefined },
    activationExpiresAt: { type: Date, default: null },
    activationInProgress: { type: Boolean, default: false },
    activatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

shopApplicationSchema.index(
  { activeSubmissionKey: 1 },
  { unique: true, sparse: true, name: 'active_application_submission_unique' },
);
shopApplicationSchema.index({ createdAt: -1 });

export default mongoose.model('ShopApplication', shopApplicationSchema);
