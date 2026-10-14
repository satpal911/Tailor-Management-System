import bcrypt from 'bcryptjs';
import Category from '../models/Category.js';
import Service from '../models/Service.js';
import Customer from '../models/Customer.js';
import Tailor from '../models/Tailor.js';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex, pageOptions, pagination } from '../utils/query.js';
import { audit } from '../services/auditService.js';
import { normalizePhone } from '../utils/phone.js';
import { notifyUser, pushNotification } from '../services/notificationService.js';

function crud(Model, searchFields, allowedFields) {
  return {
    list: asyncHandler(async (req, res) => {
      const { page, limit, skip, sort } = pageOptions(req);
      const filter = {};
      if (req.query.search)
        filter.$or = searchFields.map((field) => ({
          [field]: new RegExp(escapeRegex(req.query.search), 'i'),
        }));
      // Public catalog consumers must never receive archived items.
      if (req.user.role !== ROLES.ADMIN) filter.isActive = true;
      else if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
      const [data, total] = await Promise.all([
        Model.find(filter).sort(sort).skip(skip).limit(limit),
        Model.countDocuments(filter),
      ]);
      res.json({ success: true, data, meta: pagination(page, limit, total) });
    }),
    create: asyncHandler(async (req, res) => {
      const fields = {};
      for (const key of allowedFields) if (req.body[key] !== undefined) fields[key] = req.body[key];
      const doc = await Model.create(fields);
      res.status(201).json({ success: true, data: doc });
    }),
    update: asyncHandler(async (req, res) => {
      const fields = {};
      for (const key of allowedFields) if (req.body[key] !== undefined) fields[key] = req.body[key];
      const doc = await Model.findByIdAndUpdate(req.params.id, fields, {
        new: true,
        runValidators: true,
      });
      if (!doc) throw Object.assign(new Error('Record not found'), { statusCode: 404 });
      res.json({ success: true, data: doc });
    }),
    archive: asyncHandler(async (req, res) => {
      const doc = await Model.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
      if (!doc) throw Object.assign(new Error('Record not found'), { statusCode: 404 });
      res.json({ success: true, data: doc });
    }),
  };
}

export const categories = crud(Category, ['name'], ['name', 'description', 'isActive']);
export const services = crud(
  Service,
  ['name', 'description'],
  ['name', 'category', 'description', 'basePrice', 'estimatedDays', 'isActive'],
);

export const listTailors = asyncHandler(async (_req, res) => {
  const rows = await Tailor.find()
    .populate('user', 'name email phone isActive accountStatus')
    .sort({ name: 1 });
  res.json({ success: true, data: rows });
});

export const createTailor = asyncHandler(async (req, res) => {
  const { name, email, password, phone, specialties, capacity } = req.body;
  if (await User.exists({ phoneNormalized: normalizePhone(phone) }))
    throw Object.assign(new Error('A user already uses this phone number'), { statusCode: 409 });
  const user = await User.create({
    name,
    email: email || undefined,
    password: await bcrypt.hash(password, 12),
    phone,
    role: ROLES.TAILOR,
    accountStatus: 'ACTIVE',
    isActive: true,
  });
  const tailor = await Tailor.create({
    user: user._id,
    name,
    phone,
    specialties,
    capacity,
    status: 'ACTIVE',
    isAvailable: true,
  });
  await audit(req.user._id, 'CREATE', 'Tailor', tailor._id, { user: user._id }, req.ip);
  res.status(201).json({ success: true, data: { ...tailor.toObject(), user: user.toSafeJSON() } });
});

export const updateTailor = asyncHandler(async (req, res) => {
  const fields = {};
  for (const key of ['name', 'phone', 'specialties', 'capacity', 'isAvailable', 'notes'])
    if (req.body[key] !== undefined) fields[key] = req.body[key];
  const doc = await Tailor.findByIdAndUpdate(req.params.id, fields, {
    new: true,
    runValidators: true,
  }).populate('user', 'name email phone isActive accountStatus');
  if (!doc) throw Object.assign(new Error('Tailor not found'), { statusCode: 404 });
  res.json({ success: true, data: doc });
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = pageOptions(req);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.accountStatus) filter.accountStatus = req.query.accountStatus;
  if (req.query.search)
    filter.$or = ['name', 'email', 'phoneNormalized'].map((key) => ({
      [key]: new RegExp(escapeRegex(req.query.search), 'i'),
    }));
  const [data, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: data.map((user) => user.toSafeJSON()),
    meta: pagination(page, limit, total),
  });
});

export const createStaff = asyncHandler(async (req, res) => {
  if (![ROLES.TAILOR, ROLES.ADMIN].includes(req.body.role))
    throw Object.assign(new Error('Staff role must be ADMIN or TAILOR'), { statusCode: 400 });
  if (req.body.role === ROLES.TAILOR && !req.body.phone)
    throw Object.assign(new Error('A phone number is required for tailor sign-in'), {
      statusCode: 400,
    });
  if (req.body.role === ROLES.TAILOR) req.body.phoneNormalized = normalizePhone(req.body.phone);
  const user = await User.create({
    ...req.body,
    password: await bcrypt.hash(req.body.password, 12),
  });
  if (user.role === ROLES.TAILOR)
    await Tailor.create({
      user: user._id,
      name: user.name,
      phone: user.phone,
      status: user.accountStatus,
    });
  await audit(req.user._id, 'CREATE', 'User', user._id, { role: user.role }, req.ip);
  res.status(201).json({ success: true, data: user.toSafeJSON() });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  const fields = {};
  for (const key of ['name', 'phone', 'role'])
    if (req.body[key] !== undefined) {
      user[key] = req.body[key];
      fields[key] = req.body[key];
    }
  if (req.body.accountStatus !== undefined) {
    user.accountStatus = req.body.accountStatus;
    user.isActive = req.body.accountStatus === 'ACTIVE';
    fields.accountStatus = user.accountStatus;
    fields.isActive = user.isActive;
  } else if (req.body.isActive !== undefined) {
    user.isActive = req.body.isActive;
    user.accountStatus = req.body.isActive ? 'ACTIVE' : 'INACTIVE';
    fields.isActive = user.isActive;
    fields.accountStatus = user.accountStatus;
  }
  await user.save();
  if (user.role === ROLES.TAILOR) {
    await Tailor.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          name: user.name,
          phone: user.phone,
          isAvailable: user.isActive && user.accountStatus === 'ACTIVE',
          status: user.accountStatus,
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  } else {
    await Tailor.updateOne({ user: user._id }, { $set: { isAvailable: false } });
  }
  if (user.role === ROLES.CUSTOMER && (fields.name !== undefined || fields.phone !== undefined)) {
    const customer = await Customer.findOne({ user: user._id });
    if (customer) {
      if (fields.name !== undefined) customer.name = user.name;
      if (fields.phone !== undefined) customer.phone = user.phone;
      await customer.save();
    }
  }
  await audit(
    req.user._id,
    'UPDATE',
    'User',
    user._id,
    { changedFields: Object.keys(fields), accountStatus: user.accountStatus },
    req.ip,
  );
  if (user.role === ROLES.TAILOR && fields.accountStatus) {
    const notification = await notifyUser(
      user._id,
      `Tailor account ${user.accountStatus.toLowerCase()}`,
      user.accountStatus === 'ACTIVE'
        ? 'Your staff account is approved. You can now sign in.'
        : `Your staff account status is ${user.accountStatus.toLowerCase()}.`,
      'SYSTEM',
      '/tailor/login',
    );
    pushNotification(req.app.get('io'), notification);
  }
  res.json({ success: true, data: user.toSafeJSON() });
});
