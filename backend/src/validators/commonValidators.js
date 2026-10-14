import { param, query } from 'express-validator';
export const idParam = [param('id').isMongoId().withMessage('Valid record ID required')];
export const listQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('order').optional().isIn(['asc', 'desc']),
];
