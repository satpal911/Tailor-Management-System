import { randomBytes } from 'node:crypto';
import Order from '../models/Order.js';
import Customer from '../models/Customer.js';
import User from '../models/User.js';
import Tailor from '../models/Tailor.js';
import Service from '../models/Service.js';
import Measurement from '../models/Measurement.js';
import Payment from '../models/Payment.js';
import Appointment from '../models/Appointment.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { buildQuery, pageOptions, pagination } from '../utils/query.js';
import { allowedTransitions } from '../constants/orderStatuses.js';
import { uploadImages, deleteUploadedImages } from '../services/uploadService.js';
import { audit } from '../services/auditService.js';
import { publishOrder } from '../sockets/index.js';
import { notifyRole, notifyUser, pushNotification } from '../services/notificationService.js';

const populated = [
  { path: 'customer', select: 'name phone' },
  { path: 'tailor', populate: { path: 'user', select: 'name' } },
  { path: 'measurement', select: 'name garmentType values customMeasurements notes unit' },
];

async function customerForUser(user) {
  return Customer.findOne({ user: user._id, isActive: true }).select('_id user');
}

export const listOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip, sort } = pageOptions(req);
  const filter = buildQuery(req, ['orderNumber']);
  if (req.user.role === 'CUSTOMER') {
    const customer = await customerForUser(req.user);
    if (!customer) return res.json({ success: true, data: [], meta: pagination(page, limit, 0) });
    filter.customer = customer._id;
  }
  if (req.user.role === 'TAILOR') {
    const tailor = await Tailor.findOne({ user: req.user._id }).select('_id');
    if (!tailor) return res.json({ success: true, data: [], meta: pagination(page, limit, 0) });
    filter.tailor = tailor._id;
  }
  const [data, total] = await Promise.all([
    Order.find(filter).populate(populated).sort(sort).skip(skip).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, data, meta: pagination(page, limit, total) });
});

export const createOrder = asyncHandler(async (req, res) => {
  let customerId = req.body.customer;
  let items = req.body.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      throw Object.assign(new Error('Order items are invalid'), { statusCode: 400 });
    }
  }
  if (!Array.isArray(items) || !items.length)
    throw Object.assign(new Error('At least one order item is required'), { statusCode: 400 });
  if (req.user.role === 'CUSTOMER') {
    const customer = await customerForUser(req.user);
    if (!customer)
      throw Object.assign(new Error('Customer profile is missing'), { statusCode: 409 });
    customerId = customer._id;
    if (items.some((item) => !item.service))
      throw Object.assign(new Error('Choose a listed service for customer orders'), {
        statusCode: 400,
      });
    for (const item of items) {
      const service = await Service.findOne({ _id: item.service, isActive: true });
      if (!service)
        throw Object.assign(new Error('A selected service is unavailable'), { statusCode: 400 });
      item.description = service.name;
      item.unitPrice = service.basePrice;
    }
  } else if (!(await Customer.exists({ _id: customerId, isActive: true }))) {
    throw Object.assign(new Error('Active customer not found'), { statusCode: 404 });
  }
  if (
    req.body.measurement &&
    !(await Measurement.exists({ _id: req.body.measurement, customer: customerId }))
  ) {
    throw Object.assign(new Error('Measurement profile does not belong to this customer'), {
      statusCode: 400,
    });
  }
  const images = await uploadImages(req.files);
  const isAdmin = req.user.role === 'ADMIN';
  const order = new Order({
    items,
    customer: customerId,
    createdBy: req.user._id,
    designImages: images,
    dueDate: req.body.dueDate,
    measurement: req.body.measurement || null,
    status: 'PENDING',
    tailor: null,
    paidAmount: 0,
    discount: isAdmin ? Number(req.body.discount || 0) : 0,
    tax: isAdmin ? Number(req.body.tax || 0) : 0,
  });
  order.orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
  order.statusHistory.push({ status: 'PENDING', changedBy: req.user._id, note: 'Order created' });
  try {
    await order.save();
  } catch (error) {
    await deleteUploadedImages(images);
    throw error;
  }
  const response = await Order.findById(order._id).populate(populated);
  await audit(
    req.user._id,
    'CREATE',
    'Order',
    order._id,
    { orderNumber: order.orderNumber },
    req.ip,
  );
  const io = req.app.get('io');
  await publishOrder(io, 'order:created', order);
  const customer = await Customer.findById(customerId).select('user');
  if (customer?.user) {
    const notification = await notifyUser(
      customer.user,
      'Order received',
      `Your order ${order.orderNumber} has been created.`,
      'ORDER',
      `/app/my-orders/${order._id}`,
    );
    pushNotification(io, notification);
    await notifyRole(
      'ADMIN',
      'New order created',
      `Order ${order.orderNumber} was created.`,
      'ORDER',
      `/app/orders/${order._id}`,
      io,
    );
  } else {
    await notifyRole(
      'ADMIN',
      'New order created',
      `Order ${order.orderNumber} was created.`,
      'ORDER',
      `/app/orders/${order._id}`,
      io,
    );
  }
  res.status(201).json({ success: true, data: response });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate([
    ...populated,
    { path: 'statusHistory.changedBy', select: 'name role' },
    { path: 'notes.author', select: 'name role' },
    { path: 'createdBy', select: 'name' },
  ]);
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (req.user.role === 'CUSTOMER') {
    const customer = await customerForUser(req.user);
    if (!customer || String(customer._id) !== String(order.customer._id))
      throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }
  if (req.user.role === 'TAILOR') {
    const tailor = await Tailor.findOne({ user: req.user._id });
    if (!tailor || String(tailor._id) !== String(order.tailor?._id))
      throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }
  if (req.user.role === 'CUSTOMER') {
    order.notes = order.notes.filter((note) => !note.internal);
    order.statusHistory = order.statusHistory.map(({ status, createdAt }) => ({
      status,
      createdAt,
    }));
  }
  const [paymentHistory, appointments] = await Promise.all([
    Payment.find({ order: order._id })
      .select('amount method type reference createdAt')
      .sort({ createdAt: 1 }),
    Appointment.find({ order: order._id, customer: order.customer._id })
      .select('title type scheduledAt status durationMinutes')
      .sort({ scheduledAt: 1 }),
  ]);
  const response = order.toObject();
  response.paymentHistory = paymentHistory;
  response.appointments = appointments;
  res.json({ success: true, data: response });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (req.user.role === 'TAILOR') {
    const tailor = await Tailor.findOne({ user: req.user._id });
    if (!tailor || String(tailor._id) !== String(order.tailor))
      throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }
  const next = req.body.status;
  if (next === 'ASSIGNED' && !order.tailor)
    throw Object.assign(new Error('Assign a tailor before moving this order to assigned'), {
      statusCode: 409,
    });
  if (!['CONFIRMED', 'CANCELLED'].includes(next) && !order.tailor && next !== 'PENDING')
    throw Object.assign(new Error('Assign a tailor before starting work'), { statusCode: 409 });
  if (!allowedTransitions[order.status]?.includes(next))
    throw Object.assign(new Error(`Cannot move an order from ${order.status} to ${next}`), {
      statusCode: 409,
    });
  order.status = next;
  order.statusHistory.push({ status: next, changedBy: req.user._id, note: req.body.note || '' });
  if (req.body.dueDate && req.user.role === 'ADMIN') order.dueDate = req.body.dueDate;
  await order.save();
  await audit(req.user._id, 'STATUS_CHANGE', 'Order', order._id, { status: next }, req.ip);
  const io = req.app.get('io');
  await publishOrder(io, 'order:updated', order);
  const customer = await Customer.findById(order.customer).select('user');
  if (customer?.user) {
    const notification = await notifyUser(
      customer.user,
      'Order update',
      `Order ${order.orderNumber} moved to ${next.replaceAll('_', ' ').toLowerCase()}.`,
      'ORDER',
      `/app/my-orders/${order._id}`,
    );
    pushNotification(io, notification);
  }
  res.json({ success: true, data: await Order.findById(order._id).populate(populated) });
});

export const assignTailor = asyncHandler(async (req, res) => {
  const [order, tailor] = await Promise.all([
    Order.findById(req.params.id),
    Tailor.findOne({ _id: req.body.tailor, isAvailable: true, status: { $in: ['ACTIVE', null] } }),
  ]);
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (
    !tailor ||
    !(await User.exists({ _id: tailor.user, isActive: true, accountStatus: 'ACTIVE' }))
  )
    throw Object.assign(new Error('Available tailor not found'), { statusCode: 404 });
  const activeAssignments = await Order.countDocuments({
    tailor: tailor._id,
    _id: { $ne: order._id },
    status: { $nin: ['COMPLETED', 'CANCELLED'] },
  });
  if (activeAssignments >= tailor.capacity)
    throw Object.assign(new Error('This tailor has reached their active order capacity'), {
      statusCode: 409,
    });
  if (!['CONFIRMED', 'ASSIGNED'].includes(order.status))
    throw Object.assign(new Error('Only confirmed orders can be assigned'), { statusCode: 409 });
  const previousTailorId = order.tailor;
  order.tailor = tailor._id;
  order.status = 'ASSIGNED';
  order.statusHistory.push({
    status: 'ASSIGNED',
    changedBy: req.user._id,
    note: 'Tailor assigned',
  });
  await order.save();
  await audit(req.user._id, 'ASSIGN_TAILOR', 'Order', order._id, { tailor: tailor._id }, req.ip);
  await publishOrder(req.app.get('io'), 'order:updated', order);
  const tailorUser = await (
    await Tailor.findById(tailor._id).select('user')
  ).populate('user', '_id');
  if (tailorUser?.user?._id) {
    const notification = await notifyUser(
      tailorUser.user._id,
      'Order assigned',
      `Order ${order.orderNumber} has been assigned to you.`,
      'ORDER',
      `/app/assigned/${order._id}`,
    );
    pushNotification(req.app.get('io'), notification);
  }
  if (previousTailorId && String(previousTailorId) !== String(tailor._id)) {
    const previousTailor = await Tailor.findById(previousTailorId).select('user');
    if (previousTailor?.user) {
      const notification = await notifyUser(
        previousTailor.user,
        'Order reassigned',
        `Order ${order.orderNumber} has been reassigned.`,
        'ORDER',
        '/app/assigned',
      );
      pushNotification(req.app.get('io'), notification);
    }
  }
  res.json({ success: true, data: await Order.findById(order._id).populate(populated) });
});

export const addOrderNote = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (req.user.role === 'TAILOR') {
    const tailor = await Tailor.findOne({ user: req.user._id });
    if (!tailor || String(tailor._id) !== String(order.tailor))
      throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }
  if (req.user.role === 'CUSTOMER') {
    const customer = await customerForUser(req.user);
    if (!customer || String(customer._id) !== String(order.customer))
      throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }
  const internal = req.user.role !== 'CUSTOMER' && req.body.internal === true;
  order.notes.push({
    author: req.user._id,
    text: req.body.text,
    internal,
  });
  await order.save();
  const io = req.app.get('io');
  const customer = await Customer.findById(order.customer).select('user');
  const tailor = order.tailor ? await Tailor.findById(order.tailor).select('user') : null;
  const excerpt = req.body.text.length > 120 ? `${req.body.text.slice(0, 117)}…` : req.body.text;
  const messageRooms = new Set();

  if (req.user.role === 'CUSTOMER') {
    messageRooms.add(`tenant:${order.tenantId}:role:ADMIN`);
    await notifyRole(
      'ADMIN',
      'New customer message',
      `${req.user.name}: ${excerpt}`,
      'ORDER',
      `/app/orders/${order._id}`,
      io,
    );
    if (tailor?.user) messageRooms.add(`tenant:${order.tenantId}:user:${tailor.user}`);
  } else if (!internal && customer?.user) {
    messageRooms.add(`tenant:${order.tenantId}:user:${customer.user}`);
    const notification = await notifyUser(
      customer.user,
      'New message from the atelier',
      excerpt,
      'ORDER',
      `/app/my-orders/${order._id}`,
    );
    pushNotification(io, notification);
  } else if (req.user.role === 'TAILOR') {
    messageRooms.add(`tenant:${order.tenantId}:role:ADMIN`);
  } else if (tailor?.user) {
    messageRooms.add(`tenant:${order.tenantId}:user:${tailor.user}`);
  }
  for (const room of messageRooms) io?.to(room).emit('order:message', { id: String(order._id) });
  res.status(201).json({ success: true, data: order.notes.at(-1) });
});

export const addOrderImages = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  if (req.user.role === 'CUSTOMER') {
    const customer = await customerForUser(req.user);
    if (!customer || String(customer._id) !== String(order.customer))
      throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }
  if (req.user.role === 'TAILOR') {
    const tailor = await Tailor.findOne({ user: req.user._id });
    if (!tailor || String(tailor._id) !== String(order.tailor))
      throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  }
  const images = await uploadImages(req.files);
  order.designImages.push(...images);
  try {
    await order.save();
  } catch (error) {
    await deleteUploadedImages(images);
    throw error;
  }
  res.json({ success: true, data: order.designImages });
});
