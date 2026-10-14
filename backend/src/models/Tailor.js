import mongoose from 'mongoose';
import tenantPlugin from './tenantPlugin.js';
const tailorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    specialties: [{ type: String, trim: true }],
    capacity: { type: Number, min: 1, default: 20 },
    status: {
      type: String,
      enum: ['PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED'],
      default: 'ACTIVE',
      index: true,
    },
    isAvailable: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);
tailorSchema.index({ tenantId: 1, user: 1 }, { unique: true });
tailorSchema.plugin(tenantPlugin);
export default mongoose.model('Tailor', tailorSchema);
