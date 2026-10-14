import mongoose from 'mongoose';
import { roundMoney } from '../utils/money.js';
import tenantPlugin from './tenantPlugin.js';

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0.01 },
    method: {
      type: String,
      enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER'],
      default: 'BANK_TRANSFER',
    },
    paidAt: { type: Date, default: Date.now },
    reference: { type: String, trim: true, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: true },
);

const schema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000, max: 2200 },
    baseSalary: { type: Number, required: true, min: 0 },
    bonuses: { type: Number, min: 0, default: 0 },
    overtime: { type: Number, min: 0, default: 0 },
    deductions: { type: Number, min: 0, default: 0 },
    advance: { type: Number, min: 0, default: 0 },
    netSalary: { type: Number, min: 0, default: 0 },
    amountPaid: { type: Number, min: 0, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PARTIALLY_PAID', 'PAID'],
      default: 'PENDING',
      index: true,
    },
    payments: { type: [paymentSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);

schema.index({ tenantId: 1, employee: 1, year: -1, month: -1 }, { unique: true });
schema.index({ year: 1, month: 1, paymentStatus: 1 });
schema.pre('validate', function calculateSalary() {
  for (const key of ['baseSalary', 'bonuses', 'overtime', 'deductions', 'advance', 'amountPaid'])
    this[key] = roundMoney(this[key] || 0);
  this.netSalary = roundMoney(
    Math.max(0, this.baseSalary + this.bonuses + this.overtime - this.deductions - this.advance),
  );
  this.amountPaid = roundMoney(
    (this.payments || []).reduce((sum, payment) => sum + payment.amount, 0),
  );
  if (this.amountPaid > this.netSalary)
    this.invalidate('amountPaid', 'Salary payments cannot exceed net salary');
  this.paymentStatus =
    this.amountPaid >= this.netSalary && this.netSalary > 0
      ? 'PAID'
      : this.amountPaid > 0
        ? 'PARTIALLY_PAID'
        : 'PENDING';
});

schema.plugin(tenantPlugin);
export default mongoose.model('Salary', schema);
