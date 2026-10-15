import { Router } from 'express';
import { body, param } from 'express-validator';
import { protect, allowRoles } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  listAppointments,
  createAppointment,
  updateAppointment,
} from '../controllers/appointmentController.js';
const r = Router();
r.use(protect);
r.get('/', listAppointments);
r.post(
  '/',
  allowRoles('ADMIN', 'CUSTOMER'),
  body('customer')
    .if((_value, { req }) => req.user?.role === 'ADMIN')
    .isMongoId(),
  body('tailor').optional().isMongoId(),
  body('title').trim().notEmpty(),
  body('scheduledAt').isISO8601(),
  body('durationMinutes').optional().isInt({ min: 5, max: 480 }),
  body('type').optional().isIn(['FITTING', 'MEASUREMENT', 'PICKUP', 'CONSULTATION', 'OTHER']),
  body('notes').optional().isString().isLength({ max: 1000 }),
  validate,
  createAppointment,
);
r.patch(
  '/:id',
  param('id').isMongoId(),
  body('status').optional().isIn(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'REJECTED']),
  body('tailor').optional().isMongoId(),
  validate,
  updateAppointment,
);
export default r;
