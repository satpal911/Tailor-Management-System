import { Router } from 'express';
import { body } from 'express-validator';
import {
  listCustomers,
  createCustomer,
  setCustomerPassword,
  getCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customerController.js';
import { protect, allowRoles } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { idParam, listQuery } from '../validators/commonValidators.js';
const r = Router();
r.use(protect);
r.get('/', allowRoles('ADMIN', 'TAILOR'), listQuery, validate, listCustomers);
r.post(
  '/',
  allowRoles('ADMIN'),
  body('name').trim().isLength({ min: 2, max: 120 }),
  body('email').optional({ values: 'falsy' }).trim().isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ max: 30 }),
  validate,
  createCustomer,
);
r.post(
  '/:id/password',
  allowRoles('ADMIN'),
  idParam,
  body('password').isString().isLength({ min: 8, max: 128 }),
  validate,
  setCustomerPassword,
);
r.get('/:id', allowRoles('ADMIN', 'TAILOR'), idParam, validate, getCustomer);
r.patch(
  '/:id',
  allowRoles('ADMIN'),
  idParam,
  body('name').optional().trim().isLength({ min: 2, max: 120 }),
  body('email').optional({ values: 'falsy' }).trim().isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ max: 30 }),
  body('isActive').optional().isBoolean().toBoolean(),
  validate,
  updateCustomer,
);
r.delete('/:id', allowRoles('ADMIN'), idParam, validate, deleteCustomer);
export default r;
