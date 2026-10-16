import jwt from 'jsonwebtoken';
import PlatformAdmin from '../models/PlatformAdmin.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const protectPlatformAdmin = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.platform_token;
  if (!token)
    throw Object.assign(new Error('Platform administrator sign-in required'), { statusCode: 401 });

  const decoded = jwt.verify(token, process.env.JWT_SECRET, { audience: 'platform-admin' });
  if (decoded.scope !== 'platform-admin')
    throw Object.assign(new Error('Platform administrator sign-in required'), { statusCode: 401 });

  const admin = await PlatformAdmin.findById(decoded.sub);
  if (!admin || !admin.isActive)
    throw Object.assign(new Error('Platform administrator account is unavailable'), {
      statusCode: 401,
    });

  req.platformAdmin = admin;
  next();
});
