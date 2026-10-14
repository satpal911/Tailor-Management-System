import { Router } from 'express';
import { body, param } from 'express-validator';
import { listUsers, createStaff, updateUser } from '../controllers/catalogController.js';
import { updateProfile } from '../controllers/profileController.js';
import { protect, allowRoles } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
const r = Router();
r.use(protect);
r.get('/', allowRoles('ADMIN'), listUsers);
r.post(
  '/',
  allowRoles('ADMIN'),
  body('name').trim().isLength({ min: 2, max: 120 }),
  body('email').optional({ values: 'falsy' }).trim().isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ max: 30 }),
  body('password').isLength({ min: 8, max: 128 }),
  body('role').isIn(['ADMIN', 'TAILOR']),
  validate,
  createStaff,
);
r.patch(
  '/me',
  body('name').optional().trim().notEmpty().isLength({ max: 120 }),
  body('phone').optional().trim().isLength({ max: 30 }),
  body('password').optional().isLength({ min: 8, max: 128 }),
  body('currentPassword').optional().isString().isLength({ min: 1, max: 128 }),
  validate,
  updateProfile,
);
r.patch(
  '/:id',
  allowRoles('ADMIN'),
  param('id').isMongoId(),
  body('accountStatus').optional().isIn(['PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED']),
  body('isActive').optional().isBoolean().toBoolean(),
  body('role').optional().isIn(['ADMIN', 'TAILOR', 'CUSTOMER']),
  validate,
  updateUser,
);
export default r;
