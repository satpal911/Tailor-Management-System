import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import tailorRoutes from './routes/tailorRoutes.js';
import { categoryRoutes, serviceRoutes } from './routes/catalogRoutes.js';
import measurementRoutes from './routes/measurementRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { csrfProtection } from './middleware/csrfMiddleware.js';
import salaryRoutes from './routes/salaryRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import { isShopOrigin, resolveTenant } from './middleware/tenantMiddleware.js';
import { getPublicShop } from './controllers/shopController.js';

const app = express();
app.disable('x-powered-by');
const proxyHops = process.env.TRUST_PROXY_HOPS;
app.set('trust proxy', proxyHops ? Math.max(0, Number.parseInt(proxyHops, 10) || 0) : false);
app.use(helmet());
const allowedOrigins = new Set(
  (process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
app.use(
  cors({
    async origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      try {
        callback(null, await isShopOrigin(origin));
      } catch {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
app.use(csrfProtection);
if (process.env.NODE_ENV !== 'test') app.use(morgan(':method :status :response-time ms'));
app.get('/api/v1/health', (_req, res) =>
  res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } }),
);
app.use(
  '/api/v1',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }),
);
app.use('/api/v1', resolveTenant);
app.get('/api/v1/shop', getPublicShop);
app.use(
  '/api/v1/auth',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }),
  authRoutes,
);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/tailors', tailorRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/measurements', measurementRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/salaries', salaryRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use(notFound);
app.use(errorHandler);
export default app;
