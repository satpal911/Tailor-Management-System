import Appointment from '../models/Appointment.js';
import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import Tailor from '../models/Tailor.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listAppointments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.from || req.query.to) {
    filter.scheduledAt = {};
    if (req.query.from) filter.scheduledAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.scheduledAt.$lte = new Date(req.query.to);
  }
  if (req.user.role === 'CUSTOMER') {
    const customer = await Customer.findOne({ user: req.user._id }).select('_id');
    filter.customer = customer?._id || null;
  } else if (req.user.role === 'TAILOR') {
    const tailor = await Tailor.findOne({ user: req.user._id }).select('_id');
    filter.tailor = tailor?._id || null;
  }
  const data = await Appointment.find(filter)
    .populate('customer', 'name phone')
    .populate('order', 'orderNumber')
    .populate({ path: 'tailor', populate: { path: 'user', select: 'name' } })
    .sort({ scheduledAt: 1 })
    .limit(200);
  res.json({ success: true, data });
});

export const createAppointment = asyncHandler(async (req, res) => {
  let customerId = req.body.customer;
  if (req.user.role === 'CUSTOMER') {
    const customer = await Customer.findOne({ user: req.user._id }).select('_id');
    if (!customer)
      throw Object.assign(new Error('Customer profile not found'), { statusCode: 404 });
    customerId = customer._id;
  } else if (!(await Customer.exists({ _id: customerId, isActive: true }))) {
    throw Object.assign(new Error('Active customer not found'), { statusCode: 404 });
  }
  const tailorId = req.user.role === 'ADMIN' ? req.body.tailor || null : null;
  if (tailorId && !(await Tailor.exists({ _id: tailorId })))
    throw Object.assign(new Error('Tailor not found'), { statusCode: 404 });
  const orderId = req.user.role === 'ADMIN' ? req.body.order || null : null;
  if (
    orderId &&
    !(await Order.exists({
      _id: orderId,
      customer: customerId,
      ...(tailorId ? { tailor: tailorId } : {}),
    }))
  ) {
    throw Object.assign(new Error('Order does not belong to this customer and tailor'), {
      statusCode: 400,
    });
  }
  const doc = await Appointment.create({
    title: req.body.title,
    scheduledAt: req.body.scheduledAt,
    durationMinutes: req.body.durationMinutes,
    type: req.body.type,
    notes: req.body.notes,
    customer: customerId,
    tailor: tailorId,
    order: orderId,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, data: await doc.populate(['customer', 'tailor']) });
});

export const updateAppointment = asyncHandler(async (req, res) => {
  const doc = await Appointment.findById(req.params.id);
  if (!doc) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
  if (req.user.role === 'CUSTOMER') {
    const customer = await Customer.findOne({ user: req.user._id }).select('_id');
    if (!customer || String(customer._id) !== String(doc.customer))
      throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
    if (req.body.status !== undefined)
      throw Object.assign(new Error('Customers cannot change appointment status'), {
        statusCode: 403,
      });
  }
  if (req.user.role === 'TAILOR') {
    const tailor = await Tailor.findOne({ user: req.user._id }).select('_id');
    if (!tailor || String(tailor._id) !== String(doc.tailor))
      throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
  }
  for (const key of ['scheduledAt', 'durationMinutes', 'status', 'notes', 'title'])
    if (req.body[key] !== undefined) doc[key] = req.body[key];
  await doc.save();
  res.json({ success: true, data: doc });
});
