import mongoose from 'mongoose';
import tenantPlugin from './tenantPlugin.js';
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
schema.index({ tenantId: 1, name: 1 }, { unique: true });
schema.plugin(tenantPlugin);
export default mongoose.model('Category', schema);
