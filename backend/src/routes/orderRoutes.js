import { Router } from 'express';
import { body, param } from 'express-validator';
import { createOrderRules } from '../validators/orderValidators.js';
import { validate } from '../middleware/validate.js';
import { protect, allowRoles } from '../middleware/authMiddleware.js';
import { imageUpload } from '../middleware/upload.js';
import {
  listOrders,
  createOrder,
  getOrder,
  updateStatus,
  assignTailor,
  addOrderNote,
  addOrderImages,
} from '../controllers/orderController.js';
function parseItems(req, res, next) {
  if (typeof req.body.items === 'string') {
    try {
      req.body.items = JSON.parse(req.body.items);
    } catch {
      return res.status(400).json({ success: false, message: 'Order items are invalid' });
    }
  }
  next();
}
const r = Router();
r.use(protect);
r.get('/', listOrders);
r.post(
  '/',
  allowRoles('ADMIN', 'CUSTOMER'),
  imageUpload.array('images', 5),
  parseItems,
  createOrderRules,
  validate,
  createOrder,
);
r.get('/:id', [param('id').isMongoId()], validate, getOrder);
r.patch(
  '/:id/status',
  allowRoles('ADMIN', 'TAILOR'),
  param('id').isMongoId(),
  body('status').notEmpty(),
  validate,
  updateStatus,
);
r.patch(
  '/:id/assign',
  allowRoles('ADMIN'),
  param('id').isMongoId(),
  body('tailor').isMongoId(),
  validate,
  assignTailor,
);
r.post(
  '/:id/notes',
  param('id').isMongoId(),
  body('text').trim().isLength({ min: 1, max: 2000 }),
  body('internal').optional().isBoolean().toBoolean(),
  validate,
  addOrderNote,
);
r.post(
  '/:id/images',
  param('id').isMongoId(),
  validate,
  imageUpload.array('images', 5),
  addOrderImages,
);
export default r;
