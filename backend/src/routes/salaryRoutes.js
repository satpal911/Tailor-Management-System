import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { protect, allowRoles } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  createSalary,
  listSalaries,
  recordSalaryPayment,
  setBaseSalary,
  updateSalary,
} from '../controllers/salaryController.js';

const router = Router();
router.use(protect);
router.get('/mine', allowRoles('TAILOR'), listSalaries);
router.get(
  '/',
  allowRoles('ADMIN'),
  query('employee').optional().isMongoId(),
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('year').optional().isInt({ min: 2000, max: 2200 }),
  query('paymentStatus').optional().isIn(['PENDING', 'PARTIALLY_PAID', 'PAID']),
  validate,
  listSalaries,
);
router.patch(
  '/base-salary',
  allowRoles('ADMIN'),
  body('employee').isMongoId(),
  body('baseSalary').isFloat({ min: 0 }),
  validate,
  setBaseSalary,
);
router.post(
  '/',
  allowRoles('ADMIN'),
  body('employee').isMongoId(),
  body('month').isInt({ min: 1, max: 12 }),
  body('year').isInt({ min: 2000, max: 2200 }),
  body('baseSalary').optional().isFloat({ min: 0 }),
  body('bonuses').optional().isFloat({ min: 0 }),
  body('overtime').optional().isFloat({ min: 0 }),
  body('deductions').optional().isFloat({ min: 0 }),
  body('advance').optional().isFloat({ min: 0 }),
  body('notes').optional().isString().isLength({ max: 2000 }),
  validate,
  createSalary,
);
router.patch(
  '/:id',
  allowRoles('ADMIN'),
  param('id').isMongoId(),
  body('baseSalary').optional().isFloat({ min: 0 }),
  body('bonuses').optional().isFloat({ min: 0 }),
  body('overtime').optional().isFloat({ min: 0 }),
  body('deductions').optional().isFloat({ min: 0 }),
  body('advance').optional().isFloat({ min: 0 }),
  body('notes').optional().isString().isLength({ max: 2000 }),
  validate,
  updateSalary,
);
router.post(
  '/:id/payments',
  allowRoles('ADMIN'),
  param('id').isMongoId(),
  body('amount').optional().isFloat({ gt: 0 }),
  body('method').optional().isIn(['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER']),
  body('reference').optional().isString().isLength({ max: 120 }),
  validate,
  recordSalaryPayment,
);
export default router;
