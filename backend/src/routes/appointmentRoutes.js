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
  body('title').trim().notEmpty(),
  body('scheduledAt').isISO8601(),
  body('type').optional().isIn(['FITTING', 'MEASUREMENT', 'PICKUP', 'CONSULTATION', 'OTHER']),
  validate,
  createAppointment,
);
r.patch(
  '/:id',
  param('id').isMongoId(),
  body('status').optional().isIn(['SCHEDULED', 'COMPLETED', 'CANCELLED']),
  validate,
  updateAppointment,
);
export default r;
