import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import {
  adminLogin,
  tailorLogin,
  customerLogin,
  registerCustomer,
  registerTailor,
  logout,
  me,
  getCsrfToken,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import { loginRules } from '../validators/authValidators.js';

const router = Router();
const phoneRule = body('phone').trim().notEmpty().isLength({ max: 30 });
const passwordRule = body('password').isString().isLength({ min: 8, max: 128 });
const attemptLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler(_req, res) {
    res.status(429).json({
      success: false,
      message: 'Too many account attempts. Please wait before trying again.',
    });
  },
});
const registrationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler(_req, res) {
    res.status(429).json({
      success: false,
      message: 'Too many registration attempts. Please wait before trying again.',
    });
  },
});
router.get('/csrf', getCsrfToken);
router.post('/login', attemptLimit, loginRules, validate, adminLogin);
router.post('/admin/login', attemptLimit, loginRules, validate, adminLogin);
router.post('/customer/login', attemptLimit, phoneRule, passwordRule, validate, customerLogin);
router.post(
  '/customer/register',
  registrationLimit,
  phoneRule,
  passwordRule,
  body('name').trim().isLength({ min: 2, max: 120 }),
  body('email').optional({ values: 'falsy' }).trim().isEmail().normalizeEmail(),
  validate,
  registerCustomer,
);
router.post('/tailor/login', attemptLimit, phoneRule, passwordRule, validate, tailorLogin);
router.post(
  '/tailor/register',
  registrationLimit,
  phoneRule,
  passwordRule,
  body('name').trim().isLength({ min: 2, max: 120 }),
  body('email').optional({ values: 'falsy' }).trim().isEmail().normalizeEmail(),
  body('specialties').optional().isArray({ max: 20 }),
  validate,
  registerTailor,
);
router.post('/logout', protect, logout);
router.get('/me', protect, me);
export default router;
