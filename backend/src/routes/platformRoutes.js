import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, query } from 'express-validator';
import {
  approveApplication,
  listApplications,
  platformLogin,
  platformLogout,
  regenerateActivationLink,
  updateApplication,
} from '../controllers/platformController.js';
import { issueCsrfToken } from '../controllers/authController.js';
import { protectPlatformAdmin } from '../middleware/platformAdminMiddleware.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts. Please try again later.' },
});

router.get('/auth/csrf', (_req, res) =>
  res.json({ success: true, data: { csrfToken: issueCsrfToken(res) } }),
);
router.post(
  '/auth/login',
  loginLimit,
  body('email').isString().trim().isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 1, max: 128 }),
  validate,
  platformLogin,
);
router.get('/auth/me', protectPlatformAdmin, (req, res) =>
  res.json({
    success: true,
    data: { admin: { id: String(req.platformAdmin._id), name: req.platformAdmin.name, email: req.platformAdmin.email } },
  }),
);
router.post('/auth/logout', protectPlatformAdmin, platformLogout);

router.use(protectPlatformAdmin);
router.get(
  '/applications',
  query('status').optional().isIn(['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'APPROVED', 'REJECTED']),
  query('q').optional().trim().isLength({ max: 120 }),
  validate,
  listApplications,
);
router.patch(
  '/applications/:id',
  param('id').isMongoId(),
  body('status')
    .optional()
    .isIn(['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'REJECTED']),
  body('internalNotes').optional().isString().trim().isLength({ max: 5000 }),
  body('paymentStatus')
    .optional()
    .isIn(['NOT_STARTED', 'PENDING', 'VERIFIED', 'NOT_REQUIRED']),
  body().custom((_value, { req }) =>
    ['status', 'internalNotes', 'paymentStatus'].some((key) => req.body[key] !== undefined),
  ),
  validate,
  updateApplication,
);
router.post(
  '/applications/:id/approve',
  param('id').isMongoId(),
  validate,
  approveApplication,
);
router.post(
  '/applications/:id/activation-link',
  param('id').isMongoId(),
  validate,
  regenerateActivationLink,
);

export default router;
