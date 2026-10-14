import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Tailor from '../models/Tailor.js';
import Shop from '../models/Shop.js';
import { hostname, isShopOrigin } from '../middleware/tenantMiddleware.js';
import { runWithTenant } from '../services/tenantContext.js';
function cookieToken(header = '') {
  const raw = header
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('tailor_token='));
  return raw ? decodeURIComponent(raw.slice('tailor_token='.length)) : null;
}
export function attachSockets(httpServer) {
  const allowedOrigins = new Set(
    (process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5174')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  const io = new Server(httpServer, {
    cors: {
      async origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        try {
          callback(null, await isShopOrigin(origin));
        } catch {
          callback(null, false);
        }
      },
      credentials: true,
    },
  });
  io.use(async (socket, next) => {
    try {
      const host =
        hostname(socket.handshake.headers.origin) || hostname(socket.handshake.headers.host);
      let shop = host ? await Shop.findOne({ domains: host, isActive: true }) : null;
      if (!shop && ['localhost', '127.0.0.1', '::1'].includes(host))
        shop = await Shop.findOne({
          slug: process.env.DEFAULT_SHOP_SLUG || 'main',
          isActive: true,
        });
      if (!shop) return next(new Error('Shop unavailable'));
      const token = cookieToken(socket.handshake.headers.cookie);
      if (!token) return next(new Error('Unauthorized'));
      const { sub, tid } = jwt.verify(token, process.env.JWT_SECRET);
      if (String(shop._id) !== String(tid)) return next(new Error('Unauthorized'));
      runWithTenant(shop._id, async () => {
        const user = await User.findById(sub).select('_id role isActive accountStatus');
        if (!user?.isActive || user.accountStatus !== 'ACTIVE')
          return next(new Error('Unauthorized'));
        socket.tenantId = String(shop._id);
        socket.userId = String(user._id);
        socket.role = user.role;
        next();
      });
    } catch {
      next(new Error('Unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    socket.join(`tenant:${socket.tenantId}:user:${socket.userId}`);
    socket.join(`tenant:${socket.tenantId}:role:${socket.role}`);
  });
  return io;
}
export async function publishOrder(io, event, order) {
  if (!io || !order) return;
  const [customer, tailor] = await Promise.all([
    Customer.findById(order.customer).select('user'),
    Tailor.findById(order.tailor).select('user'),
  ]);
  const tenantId = String(order.tenantId);
  const rooms = new Set([
    `tenant:${tenantId}:role:ADMIN`,
    `tenant:${tenantId}:user:${order.createdBy}`,
  ]);
  if (customer?.user) rooms.add(`tenant:${tenantId}:user:${customer.user}`);
  if (tailor?.user) rooms.add(`tenant:${tenantId}:user:${tailor.user}`);
  const payload = { id: String(order._id), orderNumber: order.orderNumber, status: order.status };
  for (const room of rooms) {
    io.to(room).emit(event, payload);
    if (event === 'order:updated') io.to(room).emit('order_status_updated', payload);
  }
}
