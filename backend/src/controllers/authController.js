import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Tailor from '../models/Tailor.js';
import { ROLES } from '../constants/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { normalizePhone } from '../utils/phone.js';
import { audit } from '../services/auditService.js';
import { notifyRole } from '../services/notificationService.js';

function sessionMaxAgeMs() {
  const value = process.env.JWT_EXPIRES_IN || '7d';
  const match = String(value)
    .trim()
    .match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d|w|y)?$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const units = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    y: 31_557_600_000,
  };
  return Math.max(1, Number(match[1]) * units[(match[2] || 'ms').toLowerCase()]);
}
const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_SAME_SITE || 'lax',
  path: '/',
  maxAge: sessionMaxAgeMs(),
});
const csrfOptions = () => ({ ...cookieOptions(), httpOnly: false });
export const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email || null,
  role: user.role,
  phone: user.phone,
  accountStatus: user.accountStatus,
  isActive: user.isActive,
});

export function issueSession(res, user) {
  const token = jwt.sign(
    { sub: user.id, role: user.role, tid: String(user.tenantId) },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
  );
  const csrfToken = issueCsrfToken(res);
  res.cookie('tailor_token', token, cookieOptions());
  return csrfToken;
}

export function issueCsrfToken(res) {
  const csrfToken = randomBytes(32).toString('base64url');
  res.cookie('csrf_token', csrfToken, csrfOptions());
  return csrfToken;
}

export const getCsrfToken = asyncHandler(async (_req, res) => {
  const csrfToken = issueCsrfToken(res);
  res.json({ success: true, data: { csrfToken } });
});

async function finishLogin(req, res, user) {
  user.lastLoginAt = new Date();
  await user.save();
  const csrfToken = issueSession(res, user);
  await audit(user._id, 'LOGIN', 'User', user._id, {}, req.ip);
  res.json({ success: true, data: { user: safeUser(user), csrfToken } });
}

export const adminLogin = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, role: ROLES.ADMIN }).select('+password');
  if (!user || !user.password || !(await bcrypt.compare(req.body.password, user.password)))
    throw Object.assign(new Error('Email or password is incorrect'), { statusCode: 401 });
  if (!user.isActive || user.accountStatus !== 'ACTIVE')
    throw Object.assign(new Error('Account is unavailable'), { statusCode: 403 });
  await finishLogin(req, res, user);
});

export const tailorLogin = asyncHandler(async (req, res) => {
  const phoneNormalized = normalizePhone(req.body.phone);
  const user = await User.findOne({ phoneNormalized, role: ROLES.TAILOR }).select('+password');
  if (!user || !user.password || !(await bcrypt.compare(req.body.password, user.password)))
    throw Object.assign(new Error('Phone number or password is incorrect'), { statusCode: 401 });
  if (user.accountStatus === 'PENDING')
    throw Object.assign(new Error('Your account is waiting for shop approval'), {
      statusCode: 403,
    });
  if (!user.isActive || user.accountStatus !== 'ACTIVE')
    throw Object.assign(new Error('Account is unavailable'), { statusCode: 403 });
  await finishLogin(req, res, user);
});

export const customerLogin = asyncHandler(async (req, res) => {
  const phoneNormalized = normalizePhone(req.body.phone);
  const user = await User.findOne({ phoneNormalized, role: ROLES.CUSTOMER }).select('+password');
  if (!user || !user.password || !(await bcrypt.compare(req.body.password, user.password)))
    throw Object.assign(new Error('Phone number or password is incorrect'), { statusCode: 401 });
  if (!user.isActive || user.accountStatus !== 'ACTIVE')
    throw Object.assign(new Error('Account is unavailable'), { statusCode: 403 });
  await finishLogin(req, res, user);
});

export const registerCustomer = asyncHandler(async (req, res) => {
  const phoneNormalized = normalizePhone(req.body.phone);
  if ((await User.exists({ phoneNormalized })) || (await Customer.exists({ phoneNormalized }))) {
    throw Object.assign(
      new Error(
        'An account or shop customer profile already uses this phone. Contact the shop to set up access.',
      ),
      { statusCode: 409 },
    );
  }
  const user = await User.create({
    tenantId: req.tenant._id,
    name: req.body.name,
    email: req.body.email || undefined,
    phone: req.body.phone,
    phoneNormalized,
    role: ROLES.CUSTOMER,
    accountStatus: 'ACTIVE',
    isActive: true,
    password: await bcrypt.hash(req.body.password, 12),
  });
  try {
    await Customer.create({
      tenantId: req.tenant._id,
      user: user._id,
      name: user.name,
      email: user.email || '',
      phone: user.phone,
      phoneNormalized,
    });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    if (error?.code === 11000)
      throw Object.assign(
        new Error('An account already uses these details. Contact the shop for help.'),
        { statusCode: 409 },
      );
    throw error;
  }
  await finishLogin(req, res, user);
});

export const registerTailor = asyncHandler(async (req, res) => {
  const phoneNormalized = normalizePhone(req.body.phone);
  if (await User.exists({ phoneNormalized }))
    throw Object.assign(new Error('An account already uses this phone number'), {
      statusCode: 409,
    });
  const user = await User.create({
    tenantId: req.tenant._id,
    name: req.body.name,
    email: req.body.email || undefined,
    phone: req.body.phone,
    phoneNormalized,
    role: ROLES.TAILOR,
    accountStatus: 'PENDING',
    isActive: false,
    password: await bcrypt.hash(req.body.password, 12),
  });
  try {
    await Tailor.create({
      tenantId: req.tenant._id,
      user: user._id,
      name: user.name,
      phone: user.phone,
      status: 'PENDING',
      isAvailable: false,
      specialties: req.body.specialties || [],
    });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
  await audit(user._id, 'REGISTER', 'Tailor', user._id, { status: 'PENDING' }, req.ip);
  await notifyRole(
    'ADMIN',
    'Tailor approval required',
    `${user.name} requested staff access.`,
    'SYSTEM',
    '/app/team',
    req.app.get('io'),
  );
  res.status(202).json({
    success: true,
    data: { message: 'Registration received. Wait for shop approval before signing in.' },
  });
});

export const logout = asyncHandler(async (req, res) => {
  const options = cookieOptions();
  res.clearCookie('tailor_token', { ...options, maxAge: undefined });
  res.clearCookie('csrf_token', { ...csrfOptions(), maxAge: undefined });
  if (req.user) await audit(req.user._id, 'LOGOUT', 'User', req.user._id, {}, req.ip);
  res.json({ success: true, message: 'Signed out' });
});

export const me = asyncHandler(async (req, res) =>
  res.json({ success: true, data: { user: safeUser(req.user) } }),
);
