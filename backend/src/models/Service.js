import mongoose from 'mongoose';
import tenantPlugin from './tenantPlugin.js';
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    description: { type: String, trim: true, default: '' },
    basePrice: { type: Number, required: true, min: 0 },
    estimatedDays: { type: Number, min: 1, default: 7 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
schema.index({ tenantId: 1, name: 1, category: 1 }, { unique: true });
schema.plugin(tenantPlugin);
export default mongoose.model('Service', schema);
