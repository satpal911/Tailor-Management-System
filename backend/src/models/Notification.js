import mongoose from 'mongoose';
import tenantPlugin from './tenantPlugin.js';
const schema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: { type: String, enum: ['INFO', 'ORDER', 'PAYMENT', 'SYSTEM'], default: 'INFO' },
    link: { type: String, default: '' },
    readAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);
schema.index({ recipient: 1, createdAt: -1 });
schema.index({ recipient: 1, readAt: 1, createdAt: -1 });
schema.plugin(tenantPlugin);
export default mongoose.model('Notification', schema);
