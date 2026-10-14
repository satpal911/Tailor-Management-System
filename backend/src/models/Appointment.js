import mongoose from 'mongoose';
import tenantPlugin from './tenantPlugin.js';
const schema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    tailor: { type: mongoose.Schema.Types.ObjectId, ref: 'Tailor', default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, min: 5, max: 480, default: 30 },
    type: {
      type: String,
      enum: ['FITTING', 'MEASUREMENT', 'PICKUP', 'CONSULTATION', 'OTHER'],
      default: 'FITTING',
    },
    status: { type: String, enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED'], default: 'SCHEDULED' },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
schema.index({ tailor: 1, scheduledAt: 1 });
schema.index({ customer: 1, scheduledAt: 1 });
schema.plugin(tenantPlugin);
export default mongoose.model('Appointment', schema);
