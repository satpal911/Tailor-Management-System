import Appointment from '../models/Appointment.js';
import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import Tailor from '../models/Tailor.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notifyRole, notifyUser, pushNotification } from '../services/notificationService.js';

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
    if (!tailor) filter._id = null;
    else filter.$or = [{ tailor: tailor._id }, { tailor: null, status: 'PENDING' }];
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
    const customer = await Customer.findOne({ user: req.user._id, isActive: true }).select('_id');
    if (!customer)
      throw Object.assign(new Error('Customer profile not found'), { statusCode: 404 });
    customerId = customer._id;
  } else if (!(await Customer.exists({ _id: customerId, isActive: true }))) {
    throw Object.assign(new Error('Active customer not found'), { statusCode: 404 });
  }
  const tailorId = req.user.role === 'ADMIN' ? req.body.tailor || null : null;
  if (tailorId) {
    const tailor = await Tailor.findOne({
      _id: tailorId,
      status: 'ACTIVE',
      isAvailable: true,
    }).select('user');
    if (
      !tailor ||
      !(await User.exists({ _id: tailor.user, isActive: true, accountStatus: 'ACTIVE' }))
    )
      throw Object.assign(new Error('Choose an active tailor for this appointment'), {
        statusCode: 400,
      });
  }
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
    status: req.user.role === 'CUSTOMER' ? 'PENDING' : 'SCHEDULED',
    createdBy: req.user._id,
  });
  const io = req.app.get('io');
  if (req.user.role === 'CUSTOMER') {
    await notifyRole(
      'ADMIN',
      'Appointment request',
      `${req.user.name} requested ${doc.title}.`,
      'INFO',
      '/app/appointments',
      io,
    );
    io?.to(`tenant:${doc.tenantId}:role:ADMIN`).emit('appointment:updated', {
      id: String(doc._id),
    });
    io?.to(`tenant:${doc.tenantId}:role:TAILOR`).emit('appointment:updated', {
      id: String(doc._id),
    });
  } else {
    const customer = await Customer.findById(customerId).select('user');
    if (customer?.user) {
      const notification = await notifyUser(
        customer.user,
        'Appointment scheduled',
        `Your ${doc.title} appointment has been scheduled.`,
        'INFO',
        '/app/appointments',
      );
      pushNotification(io, notification);
    }
    if (tailorId) {
      const tailor = await Tailor.findById(tailorId).select('user');
      if (tailor?.user)
        io?.to(`tenant:${doc.tenantId}:user:${tailor.user}`).emit('appointment:updated', {
          id: String(doc._id),
        });
    }
  }
  res.status(201).json({
    success: true,
    data: await doc.populate([
      { path: 'customer', select: 'name phone' },
      { path: 'tailor', populate: { path: 'user', select: 'name' } },
    ]),
  });
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
    if (doc.status !== 'PENDING')
      throw Object.assign(new Error('Only pending appointment requests can be changed'), {
        statusCode: 409,
      });
  }
  let assignedTailor;
  if (req.user.role === 'TAILOR') {
    const tailor = await Tailor.findOne({ user: req.user._id }).select('_id');
    if (!tailor) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
    if (doc.status === 'PENDING' && !doc.tailor) {
      if (!['SCHEDULED', 'REJECTED'].includes(req.body.status))
        throw Object.assign(new Error('Choose approve or reject for this request'), {
          statusCode: 400,
        });
      if (req.body.status === 'SCHEDULED') {
        doc.tailor = tailor._id;
        assignedTailor = tailor._id;
      }
    } else if (String(tailor._id) !== String(doc.tailor)) {
      throw Object.assign(new Error('Appointment not found'), { statusCode: 404 });
    }
  }
  if (req.user.role === 'ADMIN' && req.body.tailor) {
    const tailor = await Tailor.findOne({
      _id: req.body.tailor,
      status: 'ACTIVE',
      isAvailable: true,
    }).select('user');
    if (
      !tailor ||
      !(await User.exists({ _id: tailor.user, isActive: true, accountStatus: 'ACTIVE' }))
    )
      throw Object.assign(new Error('Choose an active tailor for this appointment'), {
        statusCode: 400,
      });
    doc.tailor = tailor._id;
    assignedTailor = tailor._id;
  }
  if (
    req.user.role === 'ADMIN' &&
    doc.status === 'PENDING' &&
    req.body.status === 'SCHEDULED' &&
    !doc.tailor
  )
    throw Object.assign(new Error('Assign a tailor before approving this appointment'), {
      statusCode: 400,
    });
  if (req.body.status === 'REJECTED' && doc.status !== 'PENDING')
    throw Object.assign(new Error('Only pending appointment requests can be rejected'), {
      statusCode: 409,
    });
  for (const key of ['scheduledAt', 'durationMinutes', 'status', 'notes', 'title'])
    if (req.body[key] !== undefined) doc[key] = req.body[key];
  await doc.save();
  if (['SCHEDULED', 'REJECTED'].includes(req.body.status)) {
    const customer = await Customer.findById(doc.customer).select('user');
    if (customer?.user) {
      const tailor = assignedTailor ? await Tailor.findById(assignedTailor).select('name') : null;
      const message =
        req.body.status === 'SCHEDULED'
          ? `Your ${doc.title} appointment was approved${tailor ? ` with ${tailor.name}` : ''}.`
          : `Your ${doc.title} appointment request was not approved.`;
      const notification = await notifyUser(
        customer.user,
        req.body.status === 'SCHEDULED' ? 'Appointment approved' : 'Appointment not approved',
        message,
        'INFO',
        '/app/appointments',
      );
      pushNotification(req.app.get('io'), notification);
    }
  }
  const io = req.app.get('io');
  const customer = await Customer.findById(doc.customer).select('user');
  if (customer?.user)
    io?.to(`tenant:${doc.tenantId}:user:${customer.user}`).emit('appointment:updated', {
      id: String(doc._id),
    });
  if (assignedTailor) {
    const tailor = await Tailor.findById(assignedTailor).select('user');
    if (tailor?.user)
      io?.to(`tenant:${doc.tenantId}:user:${tailor.user}`).emit('appointment:updated', {
        id: String(doc._id),
      });
  }
  io?.to(`tenant:${doc.tenantId}:role:ADMIN`).emit('appointment:updated', {
    id: String(doc._id),
  });
  res.json({
    success: true,
    data: await doc.populate([
      { path: 'customer', select: 'name phone' },
      { path: 'tailor', populate: { path: 'user', select: 'name' } },
    ]),
  });
});
