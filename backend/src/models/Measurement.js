import mongoose from 'mongoose';
import tenantPlugin from './tenantPlugin.js';
const measurementSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    garmentType: { type: String, required: true, trim: true },
    unit: { type: String, enum: ['cm', 'in'], default: 'cm' },
    values: { type: Map, of: Number, default: {} },
    customMeasurements: [
      {
        name: { type: String, required: true, trim: true },
        value: { type: Number, required: true, min: 0 },
      },
    ],
    notes: { type: String, trim: true, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
measurementSchema.index({ customer: 1, garmentType: 1, updatedAt: -1 });
measurementSchema.plugin(tenantPlugin);
export default mongoose.model('Measurement', measurementSchema);
