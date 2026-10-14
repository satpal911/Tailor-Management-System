import mongoose from 'mongoose';
import { normalizePhone } from '../utils/phone.js';
import tenantPlugin from './tenantPlugin.js';
const customerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, lowercase: true, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    phoneNormalized: { type: String },
    address: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
customerSchema.index({ name: 'text', email: 'text', phone: 'text' });
customerSchema.index(
  { tenantId: 1, user: 1 },
  { unique: true, partialFilterExpression: { user: { $type: 'objectId' } } },
);
customerSchema.index({ tenantId: 1, phoneNormalized: 1 }, { sparse: true });
customerSchema.pre('validate', function () {
  this.phoneNormalized = this.phone ? normalizePhone(this.phone) : undefined;
});
customerSchema.plugin(tenantPlugin);
export default mongoose.model('Customer', customerSchema);
