import { Router } from 'express';
import { body, param } from 'express-validator';
import { listTailors, createTailor, updateTailor } from '../controllers/catalogController.js';
import { protect, allowRoles } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
const r = Router();
r.use(protect, allowRoles('ADMIN'));
r.get('/', listTailors);
r.post(
  '/',
  body('name').trim().isLength({ min: 2, max: 120 }),
  body('email').optional({ values: 'falsy' }).trim().isEmail().normalizeEmail(),
  body('phone').trim().notEmpty().isLength({ max: 30 }),
  body('password').isLength({ min: 8, max: 128 }),
  body('specialties').optional().isArray({ max: 20 }),
  body('capacity').optional().isInt({ min: 1, max: 200 }),
  validate,
  createTailor,
);
r.patch('/:id', [param('id').isMongoId()], validate, updateTailor);
export default r;
