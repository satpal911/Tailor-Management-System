import { body } from 'express-validator';
export const createOrderRules = [
  body('customer')
    .if((_value, { req }) => req.user?.role !== 'CUSTOMER')
    .isMongoId(),
  body('items').isArray({ min: 1 }),
  body('items.*.description')
    .if((_value, { req }) => req.user?.role !== 'CUSTOMER')
    .trim()
    .notEmpty(),
  body('items.*.service')
    .if((_value, { req }) => req.user?.role === 'CUSTOMER')
    .isMongoId(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('items.*.unitPrice')
    .if((_value, { req }) => req.user?.role !== 'CUSTOMER')
    .isFloat({ min: 0 }),
  body('dueDate').isISO8601(),
  body('discount').optional().isFloat({ min: 0 }),
  body('tax').optional().isFloat({ min: 0 }),
];
