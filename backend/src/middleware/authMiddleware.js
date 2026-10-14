import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
export const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.tailor_token;
  if (!token) throw Object.assign(new Error('Please sign in to continue'), { statusCode: 401 });
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (!req.tenant || String(req.tenant._id) !== String(decoded.tid))
    throw Object.assign(new Error('This account belongs to a different shop'), { statusCode: 401 });
  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive || user.accountStatus !== 'ACTIVE')
    throw Object.assign(new Error('Account is unavailable'), { statusCode: 401 });
  req.user = user;
  next();
});
export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return next(
        Object.assign(new Error('You do not have permission to perform this action'), {
          statusCode: 403,
        }),
      );
    next();
  };
}
export const authenticate = protect;
export const authorizeRoles = allowRoles;
