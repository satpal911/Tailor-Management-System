import { Router } from 'express';
import { body } from 'express-validator';
import { listMeasurements, createMeasurement } from '../controllers/customerController.js';
import { updateMeasurement, deleteMeasurement } from '../controllers/measurementController.js';
import { protect, allowRoles } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/commonValidators.js';

const r = Router();
const validValues = (values) =>
  Object.entries(values).every(
    ([key, value]) =>
      key.trim().length > 0 &&
      key.length <= 80 &&
      !key.includes('.') &&
      !key.startsWith('$') &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0,
  );
r.use(protect);
r.get('/', listMeasurements);
r.post(
  '/',
  allowRoles('ADMIN', 'TAILOR', 'CUSTOMER'),
  body('customer')
    .if((_value, { req }) => req.user?.role !== 'CUSTOMER')
    .isMongoId(),
  body('name').trim().notEmpty().isLength({ max: 80 }),
  body('garmentType').trim().notEmpty().isLength({ max: 80 }),
  body('values').isObject().bail().custom(validValues),
  body('unit').optional().isIn(['cm', 'in']),
  body('customMeasurements').optional().isArray({ max: 50 }),
  body('customMeasurements.*.name').optional().trim().notEmpty().isLength({ max: 80 }),
  body('customMeasurements.*.value').optional().isFloat({ min: 0 }),
  body('notes').optional().isString().isLength({ max: 1000 }),
  validate,
  createMeasurement,
);
r.patch(
  '/:id',
  idParam,
  body('name').optional().trim().notEmpty().isLength({ max: 80 }),
  body('garmentType').optional().trim().notEmpty().isLength({ max: 80 }),
  body('unit').optional().isIn(['cm', 'in']),
  body('values').optional().isObject().bail().custom(validValues),
  body('customMeasurements').optional().isArray({ max: 50 }),
  body('customMeasurements.*.name').optional().trim().notEmpty().isLength({ max: 80 }),
  body('customMeasurements.*.value').optional().isFloat({ min: 0 }),
  body('notes').optional().isString().isLength({ max: 1000 }),
  validate,
  updateMeasurement,
);
r.delete('/:id', idParam, validate, deleteMeasurement);
export default r;
