import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Customer from '../models/Customer.js';
import Tailor from '../models/Tailor.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import Salary from '../models/Salary.js';
import Appointment from '../models/Appointment.js';
import Notification from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const startOfDay = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};
const startOfMonth = (value = new Date()) => new Date(value.getFullYear(), value.getMonth(), 1);
const netPayments = async (match) => {
  const [result] = await Payment.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $cond: [{ $eq: ['$type', 'REFUND'] }, { $multiply: ['$amount', -1] }, '$amount'],
          },
        },
      },
    },
  ]);
  return result?.total || 0;
};

export const summary = asyncHandler(async (req, res) => {
  const now = new Date();
  const today = startOfDay(now);
  const monthStart = startOfMonth(now);
  if (req.user.role === 'CUSTOMER') {
    const customer = await Customer.findOne({ user: req.user._id, isActive: true }).select('_id');
    if (!customer)
      return res.json({
        success: true,
        data: {
          totalOrders: 0,
          activeOrders: 0,
          balanceDue: 0,
          recentOrders: [],
          recentPayments: [],
          upcomingAppointments: [],
          notifications: [],
        },
      });
    const [
      totalOrders,
      activeOrders,
      balance,
      recentOrders,
      recentPayments,
      upcomingAppointments,
      notifications,
    ] = await Promise.all([
      Order.countDocuments({ customer: customer._id }),
      Order.countDocuments({
        customer: customer._id,
        status: { $nin: ['COMPLETED', 'CANCELLED'] },
      }),
      Order.aggregate([
        { $match: { customer: customer._id, status: { $ne: 'CANCELLED' } } },
        { $group: { _id: null, total: { $sum: '$remainingAmount' } } },
      ]),
      Order.find({ customer: customer._id })
        .sort({ createdAt: -1 })
        .limit(8)
        .select(
          'orderNumber status dueDate finalAmount paymentStatus paidAmount remainingAmount items statusHistory',
        ),
      Payment.find({ customer: customer._id })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('order', 'orderNumber'),
      Appointment.find({ customer: customer._id, status: 'SCHEDULED', scheduledAt: { $gte: now } })
        .sort({ scheduledAt: 1 })
        .limit(4)
        .populate('order', 'orderNumber'),
      Notification.find({ recipient: req.user._id, readAt: null }).sort({ createdAt: -1 }).limit(5),
    ]);
    return res.json({
      success: true,
      data: {
        totalOrders,
        activeOrders,
        balanceDue: balance[0]?.total || 0,
        recentOrders,
        recentPayments,
        upcomingAppointments,
        notifications,
      },
    });
  }

  if (req.user.role === 'TAILOR') {
    const tailor = await Tailor.findOne({ user: req.user._id }).select('_id');
    if (!tailor)
      return res.json({
        success: true,
        data: {
          assignedOrders: 0,
          recentOrders: [],
          statusCounts: [],
          currentSalary: null,
          notifications: [],
        },
      });
    const activeFilter = { tailor: tailor._id, status: { $nin: ['COMPLETED', 'CANCELLED'] } };
    const [
      assignedOrders,
      recentOrders,
      statusCounts,
      completedOrders,
      todayWork,
      currentSalary,
      notifications,
    ] = await Promise.all([
      Order.countDocuments(activeFilter),
      Order.find(activeFilter).populate('customer', 'name phone').sort({ dueDate: 1 }).limit(12),
      Order.aggregate([
        { $match: { tailor: tailor._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Order.countDocuments({ tailor: tailor._id, status: { $in: ['COMPLETED', 'DELIVERED'] } }),
      Order.countDocuments({
        ...activeFilter,
        dueDate: { $gte: today, $lt: new Date(today.getTime() + 86400000) },
      }),
      Salary.findOne({
        employee: req.user._id,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      }).select('netSalary amountPaid paymentStatus payments'),
      Notification.find({ recipient: req.user._id, readAt: null }).sort({ createdAt: -1 }).limit(5),
    ]);
    return res.json({
      success: true,
      data: {
        assignedOrders,
        recentOrders,
        statusCounts,
        completedOrders,
        todayWork,
        currentSalary,
        notifications,
      },
    });
  }

  const adminIds = await User.find({ role: 'ADMIN', isActive: true }).distinct('_id');
  const [
    customers,
    tailors,
    totalOrders,
    pendingOrders,
    activeOrders,
    deliveredOrders,
    completedOrders,
    revenue,
    pendingPayments,
    recentOrders,
    recentPayments,
    monthly,
    monthlyOrders,
    pendingTailorApprovals,
    todayAppointments,
    todayRevenue,
    monthlyRevenue,
    payrollTotals,
    recentNotifications,
  ] = await Promise.all([
    Customer.countDocuments({ isActive: true }),
    Tailor.countDocuments({ status: 'ACTIVE', isAvailable: true }),
    Order.countDocuments(),
    Order.countDocuments({ status: 'PENDING' }),
    Order.countDocuments({
      status: {
        $in: [
          'CONFIRMED',
          'ASSIGNED',
          'CUTTING',
          'STITCHING',
          'QUALITY_CHECK',
          'READY',
          'OUT_FOR_DELIVERY',
        ],
      },
    }),
    Order.countDocuments({ status: 'DELIVERED' }),
    Order.countDocuments({ status: 'COMPLETED' }),
    netPayments({ type: { $in: ['PAYMENT', 'REFUND'] } }),
    Order.aggregate([
      { $match: { remainingAmount: { $gt: 0 }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, total: { $sum: '$remainingAmount' }, count: { $sum: 1 } } },
    ]),
    Order.find().populate('customer', 'name phone').sort({ createdAt: -1 }).limit(6),
    Payment.find({ type: { $in: ['PAYMENT', 'REFUND'] } })
      .populate('customer', 'name')
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 })
      .limit(6),
    Payment.aggregate([
      {
        $match: {
          type: { $in: ['PAYMENT', 'REFUND'] },
          createdAt: { $gte: new Date(now.getTime() - 180 * 86400000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          revenue: {
            $sum: {
              $cond: [{ $eq: ['$type', 'REFUND'] }, { $multiply: ['$amount', -1] }, '$amount'],
            },
          },
          count: { $sum: { $cond: [{ $eq: ['$type', 'PAYMENT'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: new Date(now.getTime() - 180 * 86400000) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    User.countDocuments({ role: 'TAILOR', accountStatus: 'PENDING' }),
    Appointment.countDocuments({
      scheduledAt: { $gte: today, $lt: new Date(today.getTime() + 86400000) },
      status: 'SCHEDULED',
    }),
    netPayments({ type: { $in: ['PAYMENT', 'REFUND'] }, createdAt: { $gte: today } }),
    netPayments({ type: { $in: ['PAYMENT', 'REFUND'] }, createdAt: { $gte: monthStart } }),
    Salary.aggregate([
      { $match: { month: now.getMonth() + 1, year: now.getFullYear() } },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountPaid' },
          pending: { $sum: { $subtract: ['$netSalary', '$amountPaid'] } },
          pendingCount: { $sum: { $cond: [{ $ne: ['$paymentStatus', 'PAID'] }, 1, 0] } },
        },
      },
    ]),
    adminIds.length
      ? Notification.find({ recipient: { $in: adminIds }, readAt: null })
          .sort({ createdAt: -1 })
          .limit(8)
      : [],
  ]);
  const payroll = payrollTotals[0] || {};
  res.json({
    success: true,
    data: {
      customers,
      tailors,
      totalOrders,
      pendingOrders,
      activeOrders,
      deliveredOrders,
      completedOrders,
      revenue,
      pendingPayments: pendingPayments[0]?.total || 0,
      pendingPaymentOrders: pendingPayments[0]?.count || 0,
      recentOrders,
      recentPayments,
      monthly,
      monthlyOrders,
      pendingTailorApprovals,
      todayAppointments,
      todayRevenue,
      monthlyRevenue,
      payrollExpenses: payroll.total || 0,
      pendingSalaries: payroll.pending || 0,
      pendingSalaryCount: payroll.pendingCount || 0,
      recentNotifications,
    },
  });
});

export const reports = asyncHandler(async (req, res) => {
  const orderFilter = {};
  if (req.query.status) orderFilter.status = req.query.status;
  if (req.query.tailor) orderFilter.tailor = new mongoose.Types.ObjectId(req.query.tailor);
  if (req.query.customer) orderFilter.customer = new mongoose.Types.ObjectId(req.query.customer);
  if (req.query.paymentStatus) orderFilter.paymentStatus = req.query.paymentStatus;
  if (req.query.from || req.query.to) {
    orderFilter.createdAt = {};
    if (req.query.from) orderFilter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) {
      const end = new Date(req.query.to);
      end.setHours(23, 59, 59, 999);
      orderFilter.createdAt.$lte = end;
    }
  }
  const [stages, orderIds, customerIds] = await Promise.all([
    Order.aggregate([
      { $match: orderFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          finalAmount: { $sum: '$finalAmount' },
          remainingAmount: { $sum: '$remainingAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.distinct('_id', orderFilter),
    Order.distinct('customer', orderFilter),
  ]);
  const paymentFilter = { order: { $in: orderIds }, type: { $in: ['PAYMENT', 'REFUND'] } };
  if (req.query.from || req.query.to) {
    paymentFilter.createdAt = {};
    if (req.query.from) paymentFilter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) {
      const end = new Date(req.query.to);
      end.setHours(23, 59, 59, 999);
      paymentFilter.createdAt.$lte = end;
    }
  }
  const [payments, monthly] = await Promise.all([
    Payment.aggregate([
      { $match: paymentFilter },
      { $group: { _id: '$type', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: paymentFilter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          revenue: {
            $sum: {
              $cond: [{ $eq: ['$type', 'REFUND'] }, { $multiply: ['$amount', -1] }, '$amount'],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const paid = payments.find((row) => row._id === 'PAYMENT')?.amount || 0;
  const refunded = payments.find((row) => row._id === 'REFUND')?.amount || 0;
  res.json({
    success: true,
    data: {
      stages,
      orders: stages.reduce((sum, row) => sum + row.count, 0),
      customers: customerIds.length,
      revenue: paid - refunded,
      payments,
      monthly,
      filters: req.query,
    },
  });
});
