import { Router } from 'express';
import { query } from 'express-validator';
import { reports, summary } from '../controllers/dashboardController.js';
import { protect, allowRoles } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
const r = Router();
r.get('/summary', protect, summary);
r.get(
  '/reports',
  protect,
  allowRoles('ADMIN'),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('status')
    .optional()
    .isIn([
      'PENDING',
      'CONFIRMED',
      'ASSIGNED',
      'CUTTING',
      'STITCHING',
      'QUALITY_CHECK',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
    ]),
  query('tailor').optional().isMongoId(),
  query('customer').optional().isMongoId(),
  query('paymentStatus').optional().isIn(['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED']),
  validate,
  reports,
);
export default r;
