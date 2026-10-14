import mongoose from 'mongoose';
import tenantPlugin from './tenantPlugin.js';
const schema = new mongoose.Schema(
  {
    key: { type: String, default: 'main' },
    shopName: { type: String, trim: true, default: 'Stitchcraft Atelier' },
    contactEmail: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    taxRate: { type: Number, min: 0, max: 100, default: 0 },
    orderPrefix: { type: String, default: 'ORD' },
    requireDeposit: { type: Boolean, default: false },
  },
  { timestamps: true },
);
schema.index({ tenantId: 1, key: 1 }, { unique: true });
schema.plugin(tenantPlugin);
export default mongoose.model('ShopSettings', schema);
