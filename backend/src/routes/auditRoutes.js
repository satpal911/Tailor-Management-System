import { Router } from 'express';
import { query } from 'express-validator';
import { listAuditLogs } from '../controllers/auditController.js';
import { protect, allowRoles } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.get(
  '/',
  protect,
  allowRoles('ADMIN'),
  query('actor').optional().isMongoId(),
  query('entity').optional().isString().isLength({ max: 80 }),
  query('action').optional().isString().isLength({ max: 80 }),
  validate,
  listAuditLogs,
);
export default router;
