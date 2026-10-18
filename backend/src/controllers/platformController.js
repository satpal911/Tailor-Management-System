import bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import PlatformAdmin from '../models/PlatformAdmin.js';
import ShopApplication from '../models/ShopApplication.js';
import Shop from '../models/Shop.js';
import ShopSettings from '../models/ShopSettings.js';
import User from '../models/User.js';
import { ROLES } from '../constants/roles.js';
import { runWithTenant } from '../services/tenantContext.js';
import { normalizePhone } from '../utils/phone.js';
import { issueCsrfToken, safeUser } from './authController.js';

const platformCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_SAME_SITE || 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

const publicAdmin = (admin) => ({
  id: String(admin._id),
  name: admin.name,
  email: admin.email,
});

const hash = (value) => createHash('sha256').update(value).digest('hex');
const matchesHash = (value, expected) => {
  if (!value || !expected) return false;
  const left = Buffer.from(hash(value));
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

function submissionKey(email, shopName) {
  const normalizedName = shopName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return hash(`${email.trim().toLowerCase()}|${normalizedName}`);
}

function applicationView(application) {
  const value = application.toObject ? application.toObject() : application;
  delete value.activeSubmissionKey;
  delete value.activationTokenHash;
  delete value.activationExpiresAt;
  return value;
}

export async function createApplication(req, res) {
  if (String(req.body.website || '').trim())
    throw Object.assign(new Error('Unable to submit this application'), { statusCode: 400 });

  const email = req.body.email.trim().toLowerCase();
  const phone = req.body.phone.trim();
  const application = await ShopApplication.create({
    ownerName: req.body.ownerName,
    shopName: req.body.shopName,
    ownerEmail: email,
    phone,
    phoneNormalized: normalizePhone(phone),
    city: req.body.city,
    businessDetails: req.body.businessDetails || '',
    plan: req.body.plan,
    customDomain: req.body.customDomain === true,
    activeSubmissionKey: submissionKey(email, req.body.shopName),
  }).catch((error) => {
    if (error?.code === 11000)
      throw Object.assign(
        new Error('We already received an application for this owner and shop.'),
        { statusCode: 409 },
      );
    throw error;
  });

  res.status(201).json({
    success: true,
    data: {
      id: application._id,
      message: 'Application received. Our team will contact you about a demo.',
    },
  });
}

export async function platformLogin(req, res) {
  const admin = await PlatformAdmin.findOne({ email: req.body.email.trim().toLowerCase() }).select(
    '+password',
  );
  if (!admin || !admin.isActive || !(await bcrypt.compare(req.body.password, admin.password)))
    throw Object.assign(new Error('Email or password is incorrect'), { statusCode: 401 });

  admin.lastLoginAt = new Date();
  await admin.save();
  const token = jwt.sign(
    { sub: String(admin._id), scope: 'platform-admin' },
    process.env.JWT_SECRET,
    { audience: 'platform-admin', expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
  const csrfToken = issueCsrfToken(res);
  res.cookie('platform_token', token, platformCookieOptions());
  res.json({ success: true, data: { admin: publicAdmin(admin), csrfToken } });
}

export async function platformLogout(req, res) {
  res.clearCookie('platform_token', { ...platformCookieOptions(), maxAge: undefined });
  res.clearCookie('csrf_token', {
    ...platformCookieOptions(),
    httpOnly: false,
    maxAge: undefined,
  });
  res.json({ success: true, message: 'Signed out' });
}

export async function listApplications(req, res) {
  const { status, q } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const safeQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { ownerName: new RegExp(safeQuery, 'i') },
      { ownerEmail: new RegExp(safeQuery, 'i') },
      { shopName: new RegExp(safeQuery, 'i') },
      { phone: new RegExp(safeQuery, 'i') },
      { city: new RegExp(safeQuery, 'i') },
    ];
  }
  const applications = await ShopApplication.find(filter).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, data: applications.map(applicationView) });
}

export async function updateApplication(req, res) {
  const application = await ShopApplication.findById(req.params.id);
  if (!application)
    throw Object.assign(new Error('Application not found'), { statusCode: 404 });
  if (application.provisioningStatus === 'IN_PROGRESS')
    throw Object.assign(new Error('This application is being provisioned'), { statusCode: 409 });

  if (req.body.status === 'REJECTED' && application.status !== 'APPROVED') {
    application.status = 'REJECTED';
    application.activeSubmissionKey = undefined;
  } else if (req.body.status && req.body.status !== application.status) {
    if (application.status === 'APPROVED' || application.status === 'REJECTED')
      throw Object.assign(new Error('This application status cannot be changed'), {
        statusCode: 409,
      });
    application.status = req.body.status;
  }
  if (req.body.internalNotes !== undefined) application.internalNotes = req.body.internalNotes;
  if (req.body.paymentStatus !== undefined) application.paymentStatus = req.body.paymentStatus;
  await application.save();
  res.json({ success: true, data: applicationView(application) });
}

function slugBase(name) {
  const value = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return value || 'tailor-shop';
}

async function findOrCreateShop(application) {
  let shop = await Shop.findOne({ provisionedFromApplication: application._id });
  if (shop) return shop;

  const suffix = String(application._id).slice(-8);
  const base = `${slugBase(application.shopName)}-${suffix}`;
  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN?.trim().toLowerCase();
  if (process.env.NODE_ENV === 'production' && !rootDomain)
    throw Object.assign(new Error('PLATFORM_ROOT_DOMAIN must be configured before provisioning'), {
      statusCode: 503,
    });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt ? `${base.slice(0, 61 - String(attempt).length)}-${attempt}` : base;
    const domain =
      process.env.NODE_ENV === 'production'
        ? `${slug}.${rootDomain}`
        : `${slug}.localhost`;
    if (await Shop.exists({ $or: [{ slug }, { domains: domain }] })) continue;
    try {
      shop = await Shop.create({
        name: application.shopName,
        slug,
        domains: [domain],
        provisionedFromApplication: application._id,
      });
      return shop;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      shop = await Shop.findOne({ provisionedFromApplication: application._id });
      if (shop) return shop;
    }
  }
  throw Object.assign(new Error('Could not allocate a unique shop hostname'), { statusCode: 409 });
}

async function ensureShopAndOwner(application) {
  const shop = await findOrCreateShop(application);
  application.shop = shop._id;
  application.domain = shop.domains[0];
  await application.save();

  await runWithTenant(shop._id, async () => {
    if (!(await ShopSettings.exists({ key: 'main' }))) {
      await ShopSettings.create({ tenantId: shop._id, key: 'main', shopName: shop.name });
    }
    let owner = await User.findOne({ provisioningApplication: application._id });
    if (!owner) {
      const conflictingUser = await User.exists({
        tenantId: shop._id,
        email: application.ownerEmail,
      });
      if (conflictingUser)
        throw Object.assign(
          new Error('An owner account with this email already exists for the new shop'),
          { statusCode: 409 },
        );
      owner = await User.create({
        tenantId: shop._id,
        provisioningApplication: application._id,
        name: application.ownerName,
        email: application.ownerEmail,
        phone: application.phone,
        phoneNormalized: application.phoneNormalized,
        role: ROLES.ADMIN,
        accountStatus: 'PENDING',
        isActive: false,
      });
    }
    application.ownerUser = owner._id;
    await application.save();
  });

  return shop;
}


function activationUrl(req, application, token) {
  const baseUrl = (
    process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`
  ).replace(/\/+$/, '');

  return `${baseUrl}/activate?application=${application._id}&token=${encodeURIComponent(token)}`;
}


async function issueActivationLink(req, application) {
  if (!application.ownerUser || application.activatedAt)
    throw Object.assign(new Error('This owner account is not awaiting activation'), {
      statusCode: 409,
    });
  const token = randomBytes(32).toString('base64url');
  application.activationTokenHash = hash(token);
  application.activationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  application.activationInProgress = false;
  application.activeSubmissionKey = undefined;
  await application.save();
  return activationUrl(req, application, token);
}

export async function approveApplication(req, res) {
  const id = req.params.id;
  let application = await ShopApplication.findById(id);
  if (!application)
    throw Object.assign(new Error('Application not found'), { statusCode: 404 });
  if (application.status === 'REJECTED')
    throw Object.assign(new Error('Rejected applications cannot be approved'), { statusCode: 409 });
  if (application.provisioningStatus === 'COMPLETE') {
    return res.json({
      success: true,
      data: { application: applicationView(application), message: 'Shop is already provisioned.' },
    });
  }

  application = await ShopApplication.findOneAndUpdate(
    {
      _id: id,
      provisioningStatus: { $in: ['NOT_STARTED', 'FAILED'] },
      status: { $ne: 'REJECTED' },
    },
    { $set: { status: 'APPROVED', provisioningStatus: 'IN_PROGRESS' } },
    { new: true },
  );
  if (!application) {
  const currentApplication = await ShopApplication.findById(id).select(
    'status provisioningStatus shop ownerUser domain',
  );

  if (!currentApplication) {
    throw Object.assign(new Error('Shop application not found'), {
      statusCode: 404,
    });
  }

  if (currentApplication.status === 'REJECTED') {
    throw Object.assign(new Error('Rejected applications cannot be approved'), {
      statusCode: 409,
    });
  }

  if (currentApplication.provisioningStatus === 'COMPLETE') {
    return res.json({
      success: true,
      data: {
        application: applicationView(currentApplication),
        message: 'Shop is already provisioned.',
      },
    });
  }

  throw Object.assign(
    new Error('Shop provisioning is currently in progress. Please try again shortly.'),
    { statusCode: 409 },
  );
}

  try {
    const shop = await ensureShopAndOwner(application);
    application.status = 'APPROVED';
    application.provisioningStatus = 'COMPLETE';
    application.shop = shop._id;
    application.domain = shop.domains[0];
    const url = await issueActivationLink(req, application);
    application.provisioningStatus = 'COMPLETE';
    await application.save();
    res.json({
      success: true,
      data: {
        application: applicationView(application),
        activationUrl: url,
        customerLoginUrl: `${process.env.NODE_ENV === 'production' ? 'https' : 'http'}://${shop.domains[0]}${process.env.NODE_ENV === 'production' ? '' : ':5174'}/login`,
      },
    });
  } catch (error) {
    await ShopApplication.updateOne(
      { _id: id, provisioningStatus: 'IN_PROGRESS' },
      { $set: { provisioningStatus: 'FAILED' } },
    );
    if (error.statusCode) throw error;
    console.error('Shop application provisioning failed', {
      applicationId: String(id),
      errorName: error.name || 'Error',
    });
    throw Object.assign(
      new Error('Shop provisioning failed. The operator can safely retry approval.'),
      { statusCode: 500 },
    );
  }
}

export async function regenerateActivationLink(req, res) {
  const application = await ShopApplication.findOne({
    _id: req.params.id,
    status: 'APPROVED',
    provisioningStatus: 'COMPLETE',
  });
  if (!application)
    throw Object.assign(new Error('Provisioned application not found'), { statusCode: 404 });
  if (application.activatedAt)
    throw Object.assign(new Error('The owner has already activated this account'), {
      statusCode: 409,
    });
  const url = await issueActivationLink(req, application);
  res.json({ success: true, data: { activationUrl: url } });
}

export async function activateOwner(req, res) {
  if (!mongoose.isValidObjectId(req.params.id))
    throw Object.assign(new Error('Invalid activation link'), { statusCode: 400 });
  const tokenHash = req.body.token ? hash(req.body.token) : '';
  const application = await ShopApplication.findOneAndUpdate(
    {
      _id: req.params.id,
      status: 'APPROVED',
      provisioningStatus: 'COMPLETE',
      activationTokenHash: tokenHash,
      activationExpiresAt: { $gt: new Date() },
      activationInProgress: { $ne: true },
      activatedAt: null,
    },
    { $set: { activationInProgress: true } },
    { new: true, select: '+activationTokenHash' },
  );
  if (!application || !matchesHash(req.body.token, application.activationTokenHash))
    throw Object.assign(new Error('Activation link is invalid or expired'), { statusCode: 400 });

  let result;
  try {
    result = await runWithTenant(application.shop, async () => {
      const owner = await User.findOne({
        _id: application.ownerUser,
        provisioningApplication: application._id,
        role: ROLES.ADMIN,
      }).select('+password');
      if (!owner)
        throw Object.assign(new Error('Owner account is unavailable'), { statusCode: 409 });
      if (!owner.isActive || owner.accountStatus !== 'ACTIVE') {
        owner.password = await bcrypt.hash(req.body.password, 12);
        owner.isActive = true;
        owner.accountStatus = 'ACTIVE';
        await owner.save();
      }
      return owner;
    });

    application.activatedAt = new Date();
    application.activationTokenHash = undefined;
    application.activationExpiresAt = null;
    application.activationInProgress = false;
    await application.save();
  } catch (error) {
    await ShopApplication.updateOne(
      { _id: application._id, activationInProgress: true, activatedAt: null },
      { $set: { activationInProgress: false } },
    );
    throw error;
  }
  issueCsrfToken(res);
  const session = jwt.sign(
    { sub: String(result._id), role: result.role, tid: String(result.tenantId) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
  res.cookie('tailor_token', session, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ success: true, data: { user: safeUser(result) } });
}
