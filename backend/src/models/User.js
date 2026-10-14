import mongoose from 'mongoose';
import { ROLES } from '../constants/roles.js';
import { normalizePhone } from '../utils/phone.js';
import tenantPlugin from './tenantPlugin.js';
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, lowercase: true, trim: true, default: undefined },
    password: { type: String, select: false, minlength: 8 },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.CUSTOMER, index: true },
    phone: { type: String, trim: true, default: '' },
    phoneNormalized: { type: String },
    accountStatus: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED'],
      default: 'ACTIVE',
      index: true,
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);
userSchema.index(
  { tenantId: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
userSchema.index(
  { tenantId: 1, phoneNormalized: 1 },
  { unique: true, partialFilterExpression: { phoneNormalized: { $type: 'string' } } },
);
userSchema.pre('validate', function () {
  this.phoneNormalized = this.phone ? normalizePhone(this.phone) : undefined;
  if (!this.email) this.email = undefined;
});
userSchema.methods.toSafeJSON = function () {
  const o = this.toObject();
  delete o.password;
  return o;
};
userSchema.plugin(tenantPlugin);
export default mongoose.model('User', userSchema);
