import mongoose from 'mongoose';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../constants/orderStatuses.js';
import { roundMoney } from '../utils/money.js';
import tenantPlugin from './tenantPlugin.js';
const lineSchema = new mongoose.Schema(
  {
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, min: 1, default: 1 },
    unitPrice: { type: Number, min: 0, required: true },
  },
  { _id: false },
);
const noteSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    internal: { type: Boolean, default: true },
  },
  { timestamps: true },
);
const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);
const schema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    tailor: { type: mongoose.Schema.Types.ObjectId, ref: 'Tailor', default: null, index: true },
    items: { type: [lineSchema], validate: (v) => v.length > 0 },
    measurement: { type: mongoose.Schema.Types.ObjectId, ref: 'Measurement', default: null },
    designImages: [{ url: String, publicId: String }],
    dueDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'PENDING', index: true },
    statusHistory: { type: [historySchema], default: [] },
    notes: { type: [noteSchema], default: [] },
    totalAmount: { type: Number, min: 0, default: 0 },
    discount: { type: Number, min: 0, default: 0 },
    tax: { type: Number, min: 0, default: 0 },
    finalAmount: { type: Number, min: 0, default: 0 },
    paidAmount: { type: Number, min: 0, default: 0 },
    refundedAmount: { type: Number, min: 0, default: 0 },
    remainingAmount: { type: Number, min: 0, default: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'UNPAID', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);
schema.pre('validate', function () {
  for (const item of this.items || []) item.unitPrice = roundMoney(item.unitPrice);
  this.discount = roundMoney(this.discount || 0);
  this.tax = roundMoney(this.tax || 0);
  this.paidAmount = roundMoney(this.paidAmount || 0);
  this.refundedAmount = roundMoney(this.refundedAmount || 0);
  this.totalAmount = roundMoney(
    (this.items || []).reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );
  if (this.discount > this.totalAmount)
    this.invalidate('discount', 'Discount cannot exceed the order subtotal');
  this.finalAmount = roundMoney(Math.max(0, this.totalAmount - this.discount + this.tax));
  this.remainingAmount = roundMoney(Math.max(0, this.finalAmount - this.paidAmount));
  this.paymentStatus =
    this.paidAmount <= 0
      ? this.refundedAmount > 0
        ? 'REFUNDED'
        : 'UNPAID'
      : this.paidAmount >= this.finalAmount
        ? 'PAID'
        : 'PARTIAL';
});
schema.index({ status: 1, dueDate: 1 });
schema.index({ customer: 1, createdAt: -1 });
schema.index({ tailor: 1, dueDate: 1, status: 1 });
schema.index({ tailor: 1, status: 1, customer: 1 });
schema.index({ createdAt: -1 });
schema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });
schema.plugin(tenantPlugin);
export default mongoose.model('Order', schema);
