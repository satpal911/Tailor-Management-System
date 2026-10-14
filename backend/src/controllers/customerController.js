import bcrypt from 'bcryptjs';
import Customer from '../models/Customer.js';
import Measurement from '../models/Measurement.js';
import Order from '../models/Order.js';
import Tailor from '../models/Tailor.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildQuery, pageOptions, pagination } from '../utils/query.js';
import { audit } from '../services/auditService.js';
import { normalizePhone } from '../utils/phone.js';
export const listCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = pageOptions(req);
  const q = buildQuery(req, ['name', 'email', 'phone']);
  if (req.user.role === 'TAILOR') {
    const t = await Tailor.findOne({ user: req.user._id });
    const assigned = t
      ? await Order.distinct('customer', {
          tailor: t._id,
          status: { $nin: ['COMPLETED', 'CANCELLED'] },
        })
      : [];
    q._id = { $in: assigned };
  }
  const [data, total] = await Promise.all([
    Customer.find(q).sort(sort).skip(skip).limit(limit).lean(),
    Customer.countDocuments(q),
  ]);
  res.json({ success: true, data, meta: pagination(page, limit, total) });
});
export const createCustomer = asyncHandler(async (req, res) => {
  const fields = {};
  for (const key of ['name', 'email', 'phone', 'address', 'notes'])
    if (req.body[key] !== undefined) fields[key] = req.body[key];
  const doc = await Customer.create(fields);
  await audit(req.user._id, 'CREATE', 'Customer', doc._id, {}, req.ip);
  res.status(201).json({ success: true, data: doc });
});
export const setCustomerPassword = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  if (!customer.isActive)
    throw Object.assign(new Error('Archived customers cannot sign in'), { statusCode: 409 });
  if (!customer.phone)
    throw Object.assign(new Error('Add a phone number before setting up sign-in'), {
      statusCode: 409,
    });
  let user = customer.user ? await User.findById(customer.user).select('+password') : null;
  let created = false;
  if (user && user.role !== 'CUSTOMER')
    throw Object.assign(new Error('Customer account does not have a customer role'), {
      statusCode: 409,
    });
  if (!user) {
    const phoneNormalized = normalizePhone(customer.phone);
    user = await User.findOne({ phoneNormalized });
    if (user && user.role !== 'CUSTOMER')
      throw Object.assign(new Error('This phone belongs to a different account type'), {
        statusCode: 409,
      });
    if (user && (await Customer.exists({ user: user._id, _id: { $ne: customer._id } })))
      throw Object.assign(new Error('This account is already linked to another customer profile'), {
        statusCode: 409,
      });
    if (!user) {
      user = new User({
        name: customer.name,
        email: customer.email || undefined,
        phone: customer.phone,
        phoneNormalized,
        role: 'CUSTOMER',
      });
      created = true;
    }
  }
  if (user && !created && (!user.isActive || user.accountStatus !== 'ACTIVE'))
    throw Object.assign(new Error('Customer account is unavailable'), { statusCode: 409 });
  user.password = await bcrypt.hash(req.body.password, 12);
  await user.save();
  customer.user = user._id;
  try {
    await customer.save();
  } catch (error) {
    if (created) await User.deleteOne({ _id: user._id });
    throw error;
  }
  await audit(
    req.user._id,
    'SET_PASSWORD',
    'Customer',
    customer._id,
    { accountUser: String(user._id) },
    req.ip,
  );
  res.json({ success: true, data: { message: 'Customer sign-in is ready' } });
});
export const getCustomer = asyncHandler(async (req, res) => {
  const doc = await Customer.findById(req.params.id);
  if (!doc) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  const own = doc.user?.toString() === req.user.id;
  let tailorOwn = false;
  if (req.user.role === 'TAILOR') {
    const t = await Tailor.findOne({ user: req.user._id });
    tailorOwn = Boolean(
      t &&
      (await Order.exists({
        tailor: t._id,
        customer: doc._id,
        status: { $nin: ['COMPLETED', 'CANCELLED'] },
      })),
    );
  }
  if (req.user.role !== 'ADMIN' && !own && !tailorOwn)
    throw Object.assign(new Error('You cannot access this customer'), { statusCode: 403 });
  res.json({ success: true, data: doc });
});
export const updateCustomer = asyncHandler(async (req, res) => {
  const doc = await Customer.findById(req.params.id);
  if (!doc) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  const fields = {};
  for (const key of ['name', 'email', 'phone', 'address', 'notes', 'isActive'])
    if (req.body[key] !== undefined) {
      doc[key] = req.body[key];
      fields[key] = req.body[key];
    }
  if (doc.user) {
    const linked = await User.findById(doc.user);
    if (linked) {
      if (fields.isActive !== undefined) {
        linked.isActive = doc.isActive;
        linked.accountStatus = doc.isActive ? 'ACTIVE' : 'INACTIVE';
      }
      if (fields.name !== undefined) linked.name = doc.name;
      if (fields.phone !== undefined) linked.phone = doc.phone;
      await linked.save();
    }
  }
  await doc.save();
  await audit(req.user._id, 'UPDATE', 'Customer', doc._id, {}, req.ip);
  res.json({ success: true, data: doc });
});
export const deleteCustomer = asyncHandler(async (req, res) => {
  const linked = await Order.exists({
    customer: req.params.id,
    status: { $nin: ['COMPLETED', 'CANCELLED'] },
  });
  if (linked)
    throw Object.assign(new Error('Customer has active orders and cannot be archived'), {
      statusCode: 409,
    });
  const doc = await Customer.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!doc) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  if (doc.user)
    await User.updateOne(
      { _id: doc.user },
      { $set: { isActive: false, accountStatus: 'INACTIVE' } },
    );
  res.json({ success: true, data: doc });
});
export const listMeasurements = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === 'CUSTOMER') {
    const c = await Customer.findOne({ user: req.user._id }).select('_id');
    filter.customer = c?._id || null;
  } else if (req.user.role === 'TAILOR') {
    const t = await Tailor.findOne({ user: req.user._id });
    const assigned = t
      ? await Order.distinct('customer', {
          tailor: t._id,
          status: { $nin: ['COMPLETED', 'CANCELLED'] },
        })
      : [];
    filter.customer = { $in: assigned };
  }
  if (req.query.customer) {
    if (req.user.role === 'CUSTOMER' && String(filter.customer) !== req.query.customer)
      throw Object.assign(new Error('You can only view your own measurements'), {
        statusCode: 403,
      });
    if (
      req.user.role === 'TAILOR' &&
      !(filter.customer.$in || []).some((x) => String(x) === req.query.customer)
    )
      throw Object.assign(new Error('Measurement access denied'), { statusCode: 403 });
    filter.customer = req.query.customer;
  }
  const data = await Measurement.find(filter).sort({ updatedAt: -1 }).limit(100);
  res.json({ success: true, data });
});
export const createMeasurement = asyncHandler(async (req, res) => {
  if (req.user.role === 'CUSTOMER') {
    const c = await Customer.findOne({ user: req.user._id });
    if (!c) throw Object.assign(new Error('Customer profile not found'), { statusCode: 404 });
    req.body.customer = String(c._id);
  }
  if (req.user.role === 'TAILOR') {
    const t = await Tailor.findOne({ user: req.user._id });
    if (
      !t ||
      !(await Order.exists({
        tailor: t._id,
        customer: req.body.customer,
        status: { $nin: ['COMPLETED', 'CANCELLED'] },
      }))
    )
      throw Object.assign(new Error('Measurement access denied'), { statusCode: 403 });
  } else if (
    req.user.role === 'ADMIN' &&
    !(await Customer.exists({ _id: req.body.customer, isActive: true }))
  )
    throw Object.assign(new Error('Active customer not found'), { statusCode: 404 });
  const doc = await Measurement.create({ ...req.body, recordedBy: req.user._id });
  res.status(201).json({ success: true, data: doc });
});
