import mongoose from 'mongoose';
import { roundMoney } from '../utils/money.js';
import tenantPlugin from './tenantPlugin.js';
const schema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    refundedPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    method: {
      type: String,
      enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'],
      default: 'CASH',
    },
    type: { type: String, enum: ['PAYMENT', 'REFUND'], default: 'PAYMENT' },
    reference: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
schema.pre('validate', function () {
  this.amount = roundMoney(this.amount);
});
schema.index({ customer: 1, createdAt: -1 });
schema.index({ order: 1, createdAt: -1 });
schema.index({ type: 1, createdAt: -1 });
schema.index({ createdAt: -1 });
schema.plugin(tenantPlugin);
export default mongoose.model('Payment', schema);
