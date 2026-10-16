import { timingSafeEqual } from 'node:crypto';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
export function csrfProtection(req, res, next) {
  if (
    safeMethods.has(req.method) ||
    (!req.cookies?.tailor_token && !req.cookies?.platform_token)
  )
    return next();
  const cookie = req.cookies.csrf_token || '';
  const header = req.get('x-csrf-token') || '';
  const left = Buffer.from(cookie);
  const right = Buffer.from(header);
  if (!left.length || left.length !== right.length || !timingSafeEqual(left, right)) {
    return res.status(403).json({ success: false, message: 'CSRF token is missing or invalid' });
  }
  next();
}
