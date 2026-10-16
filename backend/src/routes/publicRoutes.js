import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body, param } from 'express-validator';
import { activateOwner, createApplication } from '../controllers/platformController.js';
import { normalizePhone } from '../utils/phone.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const applicationLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many applications from this connection. Please try again later.',
  },
});
const activationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many activation attempts. Please try again later.' },
});

router.post(
  '/applications',
  applicationLimit,
  body('ownerName').isString().trim().isLength({ min: 2, max: 120 }),
  body('shopName').isString().trim().isLength({ min: 2, max: 120 }),
  body('email').isString().trim().isEmail().normalizeEmail().isLength({ max: 254 }),
  body('phone')
    .isString()
    .trim()
    .isLength({ min: 7, max: 30 })
    .custom((value) => {
      try {
        normalizePhone(value);
        return true;
      } catch {
        return false;
      }
    })
    .withMessage('Enter a valid phone number'),
  body('city').isString().trim().isLength({ min: 2, max: 120 }),
  body('businessDetails').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }),
  body('plan').isIn(['STARTER', 'GROWTH', 'STUDIO']),
  body('customDomain').isBoolean().toBoolean(),
  body('website').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
  validate,
  createApplication,
);

router.post(
  '/applications/:id/activate',
  activationLimit,
  param('id').isMongoId(),
  body('token').isString().isLength({ min: 40, max: 100 }),
  body('password').isString().isLength({ min: 12, max: 128 }),
  validate,
  activateOwner,
);

export default router;
