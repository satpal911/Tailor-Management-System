import { Router } from 'express';
import { body } from 'express-validator';
import { getSettings, updateSettings } from '../controllers/settingsController.js';
import { protect, allowRoles } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
const r = Router();
r.use(protect, allowRoles('ADMIN'));
r.get('/', getSettings);
r.patch(
  '/',
  body('taxRate').optional().isFloat({ min: 0, max: 100 }),
  body('currency').optional().isIn(['INR']),
  validate,
  updateSettings,
);
export default r;
