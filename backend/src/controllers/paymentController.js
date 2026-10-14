import Order from '../models/Order.js';
import Customer from '../models/Customer.js';
import Payment from '../models/Payment.js';
import Tailor from '../models/Tailor.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { money, roundMoney } from '../utils/money.js';
import { pageOptions, pagination } from '../utils/query.js';
import { audit } from '../services/auditService.js';
import { notifyUser, pushNotification, notifyRole } from '../services/notificationService.js';

export const listPayments = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = pageOptions(req);
  const filter = {};
  if (req.query.order) filter.order = req.query.order;
  if (req.query.method) filter.method = req.query.method;
  if (req.user.role === 'CUSTOMER') {
    const customer = await Customer.findOne({ user: req.user._id });
    filter.customer = customer?._id || null;
  } else if (req.user.role === 'TAILOR') {
    const tailor = await Tailor.findOne({ user: req.user._id });
    const ids = tailor ? await Order.distinct('_id', { tailor: tailor._id }) : [];
    filter.order = { $in: ids };
  }
  let paymentQuery = Payment.find(filter);
  if (req.user.role === 'CUSTOMER')
    paymentQuery = paymentQuery.select('order customer amount type method reference createdAt');
  else paymentQuery = paymentQuery.populate('receivedBy', 'name');
  const [data, total] = await Promise.all([
    paymentQuery
      .populate('customer', 'name')
      .populate('order', 'orderNumber')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);
  res.json({ success: true, data, meta: pagination(page, limit, total) });
});

export const createPayment = asyncHandler(async (req, res) => {
  if (req.user.role !== 'ADMIN')
    throw Object.assign(new Error('Only shop administrators can record a confirmed payment'), {
      statusCode: 403,
    });
  const order = await Order.findById(req.body.order);
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (order.status === 'CANCELLED')
    throw Object.assign(new Error('Cancelled orders cannot accept payments'), { statusCode: 409 });
  const amount = roundMoney(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0)
    throw Object.assign(new Error('Payment amount must be greater than zero'), { statusCode: 400 });
  if (amount > order.remainingAmount)
    throw Object.assign(new Error('Payment cannot exceed the remaining balance'), {
      statusCode: 409,
    });
  order.paidAmount += amount;
  await order.save();
  let payment;
  try {
    payment = await Payment.create({
      order: order._id,
      customer: order.customer,
      amount,
      method: req.body.method || 'CASH',
      type: 'PAYMENT',
      reference: req.body.reference,
      notes: req.body.notes,
      receivedBy: req.user._id,
    });
  } catch (error) {
    order.paidAmount -= amount;
    await order.save();
    throw error;
  }
  await audit(
    req.user._id,
    'PAYMENT_RECEIVED',
    'Payment',
    payment._id,
    { order: order.orderNumber, amount },
    req.ip,
  );
  try {
    const customer = await Customer.findById(order.customer).select('user');
    const io = req.app.get('io');
    if (customer?.user) {
      const notification = await notifyUser(
        customer.user,
        'Payment received',
        `${money(amount)} received for order ${order.orderNumber}.`,
        'PAYMENT',
        `/app/my-orders/${order._id}`,
      );
      pushNotification(io, notification);
    }
    await notifyRole(
      'ADMIN',
      'Payment recorded',
      `${money(amount)} received for order ${order.orderNumber}.`,
      'PAYMENT',
      `/app/orders/${order._id}`,
      io,
    );
  } catch (error) {
    console.error('Payment notification failed:', error.message);
  }
  res.status(201).json({
    success: true,
    data: {
      payment,
      order: {
        paidAmount: order.paidAmount,
        remainingAmount: order.remainingAmount,
        paymentStatus: order.paymentStatus,
      },
    },
  });
});

export const refundPayment = asyncHandler(async (req, res) => {
  const original = await Payment.findById(req.params.id);
  if (!original || original.type === 'REFUND')
    throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  const order = await Order.findById(original.order);
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  const prior = await Payment.aggregate([
    { $match: { refundedPayment: original._id, type: 'REFUND' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const refundable = roundMoney(original.amount - (prior[0]?.total || 0));
  const amount = roundMoney(req.body.amount ?? refundable);
  if (!Number.isFinite(amount) || amount <= 0 || amount > refundable || amount > order.paidAmount) {
    throw Object.assign(new Error('Refund exceeds the refundable amount'), { statusCode: 409 });
  }
  order.paidAmount -= amount;
  order.refundedAmount += amount;
  await order.save();
  let payment;
  try {
    payment = await Payment.create({
      order: order._id,
      customer: order.customer,
      refundedPayment: original._id,
      amount,
      type: 'REFUND',
      method: original.method,
      reference: req.body.reference,
      notes: req.body.notes,
      receivedBy: req.user._id,
    });
  } catch (error) {
    order.paidAmount += amount;
    order.refundedAmount -= amount;
    await order.save();
    throw error;
  }
  await audit(
    req.user._id,
    'PAYMENT_REFUNDED',
    'Payment',
    payment._id,
    { order: order.orderNumber, amount },
    req.ip,
  );
  res.status(201).json({ success: true, data: payment });
});
