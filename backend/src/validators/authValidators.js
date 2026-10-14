import { body } from 'express-validator';
export const loginRules = [
  body('email').trim().isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 1, max: 128 }),
];
