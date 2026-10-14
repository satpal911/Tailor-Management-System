import { Router } from 'express';
import { body, param } from 'express-validator';
import { categories, services } from '../controllers/catalogController.js';
import { protect, allowRoles } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
function build(controller, createRules = []) {
  const r = Router();
  r.use(protect);
  r.get('/', controller.list);
  r.post(
    '/',
    allowRoles('ADMIN'),
    body('name').trim().isLength({ min: 1, max: 120 }),
    ...createRules,
    validate,
    controller.create,
  );
  r.patch('/:id', allowRoles('ADMIN'), param('id').isMongoId(), validate, controller.update);
  r.delete('/:id', allowRoles('ADMIN'), param('id').isMongoId(), validate, controller.archive);
  return r;
}
export const categoryRoutes = build(categories);
export const serviceRoutes = build(services, [
  body('category').isMongoId(),
  body('basePrice').isFloat({ min: 0 }),
  body('estimatedDays').optional().isInt({ min: 1, max: 365 }),
]);
