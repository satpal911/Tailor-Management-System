import { Router } from 'express';
import { body, param } from 'express-validator';
import { listPayments, createPayment, refundPayment } from '../controllers/paymentController.js';
import { protect, allowRoles } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
const r = Router();
r.use(protect);
r.get('/', listPayments);
r.post(
  '/',
  allowRoles('ADMIN'),
  body('order').isMongoId(),
  body('amount').isFloat({ gt: 0 }),
  body('method').optional().isIn(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']),
  validate,
  createPayment,
);
r.post(
  '/:id/refund',
  allowRoles('ADMIN'),
  param('id').isMongoId(),
  body('amount').optional().isFloat({ gt: 0 }),
  validate,
  refundPayment,
);
export default r;
