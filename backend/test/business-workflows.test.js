import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Customer from '../src/models/Customer.js';
import Tailor from '../src/models/Tailor.js';
import Category from '../src/models/Category.js';
import Service from '../src/models/Service.js';
import Measurement from '../src/models/Measurement.js';
import Order from '../src/models/Order.js';
import Payment from '../src/models/Payment.js';
import Notification from '../src/models/Notification.js';
import Salary from '../src/models/Salary.js';
import Shop from '../src/models/Shop.js';
import { runWithTenant } from '../src/services/tenantContext.js';
import { normalizePhone } from '../src/utils/phone.js';

const qaDatabase = `tailor_management_qa_${process.pid}_${Date.now()}`;
let server;
let baseUrl;
let app;
let customerToken;
let otherCustomerToken;
let adminToken;
let tailorToken;
let customerProfile;
let otherCustomerProfile;
let tailorUser;
let tailorProfile;
let service;
let order;
let measurementId;
let mainShop;

function localMongoUri(uri) {
  const parsed = new URL(uri);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname))
    throw new Error(
      'Workflow tests require a local MongoDB URI; remote database targets are refused.',
    );
  return uri;
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DEFAULT_PHONE_COUNTRY_CODE = '91';
  process.env.CLOUDINARY_CLOUD_NAME = '';
  process.env.CLOUDINARY_API_KEY = '';
  process.env.CLOUDINARY_API_SECRET = '';
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri)
    throw new Error(
      'Set MONGO_URI in backend/.env to a local MongoDB instance before running workflow tests.',
    );
  await mongoose.connect(localMongoUri(mongoUri), {
    dbName: qaDatabase,
    serverSelectionTimeoutMS: 5000,
  });
  await Shop.init();
  mainShop = await Shop.create({ name: 'QA Main Shop', slug: 'main', domains: ['127.0.0.1'] });
  await Promise.all([
    User.init(),
    Customer.init(),
    Tailor.init(),
    Category.init(),
    Service.init(),
    Measurement.init(),
    Order.init(),
    Payment.init(),
    Notification.init(),
    Salary.init(),
  ]);
  ({ default: app } = await import('../src/app.js'));
  // Use a trusted test proxy so individual limiter scenarios can use isolated client IPs.
  app.set('trust proxy', 1);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  await runWithTenant(mainShop._id, async () => {
    const hash = await bcrypt.hash('Temporary-QA-Password-2026', 4);
    const admin = await User.create({
      name: 'QA Atelier Admin',
      email: 'qa-admin@example.test',
      password: hash,
      role: 'ADMIN',
    });
    tailorUser = await User.create({
      name: 'QA Tailor',
      phone: '+91 90000 00002',
      password: hash,
      role: 'TAILOR',
    });
    tailorProfile = await Tailor.create({
      user: tailorUser._id,
      name: tailorUser.name,
      phone: tailorUser.phone,
      capacity: 10,
    });
    const category = await Category.create({ name: 'QA stitching' });
    service = await Service.create({
      name: 'QA blouse',
      category: category._id,
      basePrice: 1200,
      estimatedDays: 7,
    });
    const customer = await User.create({
      name: 'QA Customer',
      email: 'qa-customer@example.test',
      phone: '+91 98765 43210',
      password: hash,
      role: 'CUSTOMER',
    });
    customerProfile = await Customer.create({
      user: customer._id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    });
    const adminLogin = await call('/auth/admin/login', {
      method: 'POST',
      body: { email: admin.email, password: 'Temporary-QA-Password-2026' },
    });
    assert.equal(adminLogin.response.status, 200);
    adminToken = adminLogin.token;
  });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState === 1) await mongoose.disconnect();
});

async function call(
  path,
  { method = 'GET', token, body, form, csrf = true, headers: extraHeaders = {}, ip } = {},
) {
  const headers = new Headers(extraHeaders);
  if (ip) headers.set('x-forwarded-for', ip);
  if (token) {
    headers.set('cookie', `tailor_token=${token}; csrf_token=qa-test-csrf`);
    if (csrf && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()))
      headers.set('x-csrf-token', 'qa-test-csrf');
  }
  if (body !== undefined) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: form || (body === undefined ? undefined : JSON.stringify(body)),
  });
  const setCookie = response.headers.get('set-cookie') || '';
  const tokenMatch = setCookie.match(/(?:^|, )tailor_token=([^;,]*)/);
  const payload = await response.json().catch(() => ({}));
  return {
    response,
    payload,
    token: tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined,
    setCookie,
  };
}

async function loginCustomer(phone, password = 'Temporary-QA-Password-2026') {
  return call('/auth/customer/login', { method: 'POST', body: { phone, password } });
}

test(
  'business workflows: password auth, staff approval, CSRF/RBAC, measurements, orders, payroll, uploads, and security',
  { timeout: 120000 },
  async (t) =>
    runWithTenant(mainShop._id, async () => {
      await t.test('indexes and phone normalization', async () => {
        assert.equal(normalizePhone('+91 98765 43210'), normalizePhone('9876543210'));
        const hasIndex = async (model, expected, options = {}) =>
          (await model.collection.indexes()).some(
            (index) =>
              JSON.stringify(index.key) === JSON.stringify(expected) &&
              (!options.unique || index.unique),
          );
        assert.ok(await hasIndex(User, { tenantId: 1, phoneNormalized: 1 }, { unique: true }));
        assert.ok(await hasIndex(Order, { tailor: 1, dueDate: 1, status: 1 }));
        assert.ok(await hasIndex(Payment, { customer: 1, createdAt: -1 }));
        assert.ok(await hasIndex(Notification, { recipient: 1, readAt: 1, createdAt: -1 }));
        assert.ok(
          await hasIndex(
            Salary,
            { tenantId: 1, employee: 1, year: -1, month: -1 },
            { unique: true },
          ),
        );
      });

      await t.test(
        'customers can register separate accounts at separate shops without cross-shop sessions',
        async () => {
          const secondShop = await Shop.create({
            name: 'QA Second Shop',
            slug: `second-${Date.now()}`,
            domains: ['shop-two.example.test'],
          });
          const registration = {
            name: 'Shared Phone Customer',
            email: 'shared-customer@example.test',
            phone: '9000010099',
            password: 'A-Strong-QA-Password-2026',
            tenantId: String(secondShop._id),
          };
          const first = await call('/auth/customer/register', {
            method: 'POST',
            body: registration,
            ip: '198.51.100.41',
          });
          assert.equal(first.response.status, 200, JSON.stringify(first.payload));
          assert.equal(first.payload.data.user.role, 'CUSTOMER');
          const second = await call('/auth/customer/register', {
            method: 'POST',
            body: registration,
            headers: { origin: 'https://shop-two.example.test' },
            ip: '198.51.100.42',
          });
          assert.equal(second.response.status, 200, JSON.stringify(second.payload));
          assert.notEqual(first.payload.data.user.id, second.payload.data.user.id);
          const secondLogin = await call('/auth/customer/login', {
            method: 'POST',
            body: { phone: registration.phone, password: registration.password },
            headers: { origin: 'https://shop-two.example.test' },
          });
          assert.equal(secondLogin.response.status, 200, JSON.stringify(secondLogin.payload));
          assert.equal(
            (
              await call('/auth/me', {
                token: first.token,
                headers: { origin: 'https://shop-two.example.test' },
              })
            ).response.status,
            401,
          );
          const secondProfile = await runWithTenant(
            secondShop._id,
            async () => await Customer.findOne({ user: second.payload.data.user.id }),
          );
          const firstProfile = await Customer.findOne({ user: first.payload.data.user.id });
          assert.ok(firstProfile);
          assert.ok(secondProfile);
          assert.notEqual(String(firstProfile._id), String(secondProfile._id));
          assert.equal(
            (
              await call('/auth/me', {
                token: secondLogin.token,
                headers: { origin: 'http://127.0.0.1' },
              })
            ).response.status,
            401,
          );
          const shopInfo = await call('/shop', {
            headers: { origin: 'https://shop-two.example.test' },
          });
          assert.equal(shopInfo.payload.data.name, 'QA Second Shop');
          const unknownShop = await call('/auth/csrf', {
            headers: { origin: 'https://unregistered.example.test' },
          });
          assert.equal(unknownShop.response.status, 404);
        },
      );

      await t.test('CSRF bootstrap returns a pre-login token and login rotates it', async () => {
        const bootstrap = await call('/auth/csrf');
        assert.equal(bootstrap.response.status, 200);
        assert.match(bootstrap.payload.data.csrfToken, /^[A-Za-z0-9_-]{43}$/);
        assert.match(bootstrap.setCookie, /csrf_token=/);
        assert.equal(
          bootstrap.setCookie.match(/csrf_token=([^;,]*)/)?.[1],
          bootstrap.payload.data.csrfToken,
        );

        const login = await call('/auth/admin/login', {
          method: 'POST',
          body: { email: 'qa-admin@example.test', password: 'Temporary-QA-Password-2026' },
        });
        assert.equal(login.response.status, 200);
        assert.match(login.setCookie, /tailor_token=.*?HttpOnly/i);
        assert.notEqual(login.payload.data.csrfToken, bootstrap.payload.data.csrfToken);
        assert.equal(
          login.setCookie.match(/csrf_token=([^;,]*)/)?.[1],
          login.payload.data.csrfToken,
        );
        assert.equal(JSON.stringify(login.payload).includes(login.token), false);
        assert.equal(
          (
            await call('/auth/admin/login', {
              method: 'POST',
              body: { email: 'qa-admin@example.test', password: 'incorrect-password' },
              ip: '198.51.100.50',
            })
          ).response.status,
          401,
        );
        const session = await call('/auth/me', { token: login.token });
        assert.equal(session.response.status, 200);
        assert.equal(session.payload.data.user.role, 'ADMIN');
        assert.equal(
          (await call('/auth/me', { headers: { cookie: 'tailor_token=not-a-valid-jwt' } })).response
            .status,
          401,
        );
        const admin = await User.findOne({ email: 'qa-admin@example.test' });
        const expiredToken = jwt.sign(
          { sub: String(admin._id), role: 'ADMIN' },
          process.env.JWT_SECRET,
          { expiresIn: -1 },
        );
        assert.equal(
          (await call('/auth/me', { headers: { cookie: `tailor_token=${expiredToken}` } })).response
            .status,
          401,
        );
        const loggedOut = await call('/auth/logout', { method: 'POST', token: login.token });
        assert.match(loggedOut.setCookie, /tailor_token=;/);
        assert.match(loggedOut.setCookie, /csrf_token=;/);
        assert.equal((await call('/auth/me')).response.status, 401);
      });

      await t.test('cookie attributes and lifetime match the configured session', async () => {
        const keys = ['JWT_EXPIRES_IN', 'COOKIE_SECURE', 'COOKIE_SAME_SITE'];
        const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
        process.env.JWT_EXPIRES_IN = '30m';
        process.env.COOKIE_SECURE = 'true';
        process.env.COOKIE_SAME_SITE = 'strict';
        try {
          const login = await call('/auth/admin/login', {
            method: 'POST',
            body: { email: 'qa-admin@example.test', password: 'Temporary-QA-Password-2026' },
          });
          assert.equal(login.response.status, 200);
          assert.match(login.setCookie, /tailor_token=.*?HttpOnly/i);
          assert.match(login.setCookie, /Secure/i);
          assert.match(login.setCookie, /SameSite=Strict/i);
          assert.match(login.setCookie, /Path=\//i);
          assert.match(login.setCookie, /Max-Age=1800/i);
        } finally {
          for (const key of keys) {
            if (saved[key] === undefined) delete process.env[key];
            else process.env[key] = saved[key];
          }
        }
      });

      await t.test(
        'customer password registration, login, secure cookies, and no admin registration',
        async () => {
          assert.equal(
            (await call('/auth/register', { method: 'POST', body: {} })).response.status,
            404,
          );
          assert.equal(
            (await call('/auth/customer/register', { method: 'POST', body: {} })).response.status,
            400,
          );
          const invalidEmail = await call('/auth/customer/register', {
            method: 'POST',
            body: {
              name: 'Invalid Email QA',
              phone: '9000000043',
              email: 'not-an-email',
              password: 'A-Strong-QA-Password-2026',
            },
            ip: '198.51.100.53',
          });
          assert.equal(invalidEmail.response.status, 400);
          assert.ok(invalidEmail.payload.errors.some((error) => error.field === 'email'));
          const weakPassword = await call('/auth/customer/register', {
            method: 'POST',
            body: { name: 'Weak Password QA', phone: '9000000044', password: 'weak' },
            ip: '198.51.100.54',
          });
          assert.equal(weakPassword.response.status, 400);
          assert.equal(
            (
              await call('/auth/customer/register', {
                method: 'POST',
                body: { name: 'Bad Phone', phone: '1', password: 'A-Strong-QA-Password-2026' },
              })
            ).response.status,
            400,
          );
          assert.equal(
            (await call('/otp/request', { method: 'POST', body: { phone: '9000000012' } })).response
              .status,
            404,
          );
          assert.equal(
            (await call('/users', { method: 'POST', body: { role: 'ADMIN' } })).response.status,
            401,
          );
          const registered = await call('/auth/customer/register', {
            method: 'POST',
            body: {
              name: 'New QA Customer',
              phone: '9000000010',
              email: 'new-customer@example.test',
              password: 'A-Strong-QA-Password-2026',
              role: 'ADMIN',
            },
          });
          assert.equal(registered.response.status, 200, JSON.stringify(registered.payload));
          assert.equal(registered.payload.data.user.role, 'CUSTOMER');
          assert.equal(registered.payload.data.user.accountStatus, 'ACTIVE');
          assert.match(registered.setCookie, /tailor_token=.*?HttpOnly/i);
          assert.equal(JSON.stringify(registered.payload).includes('password'), false);
          const stored = await User.findOne({
            phoneNormalized: normalizePhone('9000000010'),
          }).select('+password');
          assert.match(stored.password, /^\$2[aby]\$/);
          assert.equal(
            (await Customer.findOne({ user: stored._id })).phoneNormalized,
            normalizePhone('9000000010'),
          );
          const login = await loginCustomer('90000 00010', 'A-Strong-QA-Password-2026');
          assert.equal(login.response.status, 200);
          assert.match(login.setCookie, /csrf_token=/);
          assert.equal(
            (
              await call('/auth/customer/login', {
                method: 'POST',
                body: { phone: '9000000010', password: 'wrong-password' },
                ip: '198.51.100.51',
              })
            ).response.status,
            401,
          );
          assert.equal(
            (
              await call('/auth/customer/login', {
                method: 'POST',
                body: { phone: '9000000099', password: 'Temporary-QA-Password-2026' },
                ip: '198.51.100.52',
              })
            ).response.status,
            401,
          );
          assert.equal(
            (
              await call('/auth/customer/register', {
                method: 'POST',
                body: {
                  name: 'Duplicate',
                  phone: '9000000010',
                  password: 'A-Strong-QA-Password-2026',
                },
              })
            ).response.status,
            409,
          );
          const duplicateEmail = await call('/auth/customer/register', {
            method: 'POST',
            body: {
              name: 'Duplicate Email',
              phone: '9000000015',
              email: 'qa-customer@example.test',
              password: 'A-Strong-QA-Password-2026',
            },
          });
          assert.equal(duplicateEmail.response.status, 409);
          assert.equal(
            duplicateEmail.payload.message,
            'An account already uses this email address.',
          );
          otherCustomerToken = registered.token;
          otherCustomerProfile = await Customer.findOne({ user: stored._id });
          const legacyPhone = '9000000011';
          const legacyUser = await User.create({
            name: 'Legacy QA Customer',
            phone: legacyPhone,
            role: 'CUSTOMER',
          });
          const legacyProfile = await Customer.create({
            user: legacyUser._id,
            name: legacyUser.name,
            phone: legacyPhone,
          });
          assert.equal((await loginCustomer(legacyPhone)).response.status, 401);
          assert.equal(
            (
              await call('/auth/customer/register', {
                method: 'POST',
                body: {
                  name: legacyUser.name,
                  phone: legacyPhone,
                  password: 'A-Strong-QA-Password-2026',
                },
              })
            ).response.status,
            409,
          );
          assert.equal(
            (await Customer.findById(legacyProfile._id)).user.toString(),
            legacyUser._id.toString(),
          );
          assert.equal(
            await User.findById(legacyUser._id)
              .select('+password')
              .then((user) => user.password),
            undefined,
          );
          assert.equal(
            (
              await call(`/customers/${legacyProfile._id}/password`, {
                method: 'POST',
                token: otherCustomerToken,
                body: { password: 'A-Customer-Chosen-Password-2026' },
              })
            ).response.status,
            403,
          );
          const setup = await call(`/customers/${legacyProfile._id}/password`, {
            method: 'POST',
            token: adminToken,
            body: { password: 'A-Customer-Chosen-Password-2026' },
          });
          assert.equal(setup.response.status, 200, JSON.stringify(setup.payload));
          assert.equal(JSON.stringify(setup.payload).includes('password'), false);
          assert.match(
            await User.findById(legacyUser._id)
              .select('+password')
              .then((user) => user.password),
            /^\$2[aby]\$/,
          );
          assert.equal(
            (await loginCustomer(legacyPhone, 'A-Customer-Chosen-Password-2026')).response.status,
            200,
          );
          const changedPhone = '9000000013';
          assert.equal(
            (
              await call(`/users/${stored._id}`, {
                method: 'PATCH',
                token: adminToken,
                body: { phone: changedPhone },
              })
            ).response.status,
            200,
          );
          const changedUser = await User.findById(stored._id);
          assert.equal(changedUser.phoneNormalized, normalizePhone(changedPhone));
          assert.equal(
            (await Customer.findOne({ user: stored._id })).phoneNormalized,
            normalizePhone(changedPhone),
          );
          assert.equal(
            (await loginCustomer('9000000010', 'A-Strong-QA-Password-2026')).response.status,
            401,
          );
          assert.equal(
            (await loginCustomer(changedPhone, 'A-Strong-QA-Password-2026')).response.status,
            200,
          );
          customerToken = (await loginCustomer('+91 98765 43210')).token;
          assert.ok(customerToken);
        },
      );

      await t.test('password sign-in attempts are rate limited', async () => {
        const ip = '203.0.113.61';
        for (let attempt = 0; attempt < 15; attempt += 1) {
          assert.equal(
            (
              await call('/auth/customer/login', {
                method: 'POST',
                body: { phone: '9000000099', password: 'not-the-password' },
                ip,
              })
            ).response.status,
            401,
          );
        }
        const limited = await call('/auth/customer/login', {
          method: 'POST',
          body: { phone: '9000000099', password: 'not-the-password' },
          ip,
        });
        assert.equal(limited.response.status, 429);
        assert.match(limited.payload.message, /Too many account attempts/i);
      });

      await t.test(
        'tailor registration waits for admin approval; tailor login and CSRF checks work',
        async () => {
          const registration = await call('/auth/tailor/register', {
            method: 'POST',
            body: {
              name: 'Pending Tailor',
              phone: '9000000003',
              password: 'A-Strong-QA-Password-2026',
              specialties: ['Blouses'],
              role: 'ADMIN',
              accountStatus: 'ACTIVE',
            },
          });
          assert.equal(registration.response.status, 202);
          const pendingUser = await User.findOne({
            phoneNormalized: normalizePhone('9000000003'),
          }).select('+password');
          assert.equal(pendingUser.accountStatus, 'PENDING');
          assert.equal(pendingUser.role, 'TAILOR');
          assert.equal(pendingUser.isActive, false);
          assert.match(pendingUser.password, /^\$2[aby]\$/);
          assert.equal(
            (
              await call('/auth/tailor/login', {
                method: 'POST',
                body: { phone: '9000000003', password: 'A-Strong-QA-Password-2026' },
              })
            ).response.status,
            403,
          );
          assert.equal(
            (
              await call('/auth/tailor/register', {
                method: 'POST',
                body: {
                  name: 'Duplicate',
                  phone: '+91 90000 00003',
                  password: 'A-Strong-QA-Password-2026',
                },
              })
            ).response.status,
            409,
          );
          assert.equal(
            (
              await call(`/users/${pendingUser._id}`, {
                method: 'PATCH',
                token: adminToken,
                body: { accountStatus: 'ACTIVE' },
              })
            ).response.status,
            200,
          );
          const login = await call('/auth/tailor/login', {
            method: 'POST',
            body: { phone: '+91 90000 00003', password: 'A-Strong-QA-Password-2026' },
          });
          assert.equal(login.response.status, 200);
          assert.equal(
            (
              await call('/auth/tailor/login', {
                method: 'POST',
                body: { phone: '+91 90000 00003', password: 'wrong-password' },
              })
            ).response.status,
            401,
          );
          tailorToken = login.token;
          assert.equal((await call('/users', { token: customerToken })).response.status, 403);
          assert.equal((await call('/users', { token: tailorToken })).response.status, 403);
          const rejectedRegistration = await call('/auth/tailor/register', {
            method: 'POST',
            body: {
              name: 'Rejected Tailor',
              phone: '9000000014',
              password: 'A-Strong-QA-Password-2026',
            },
            ip: '203.0.113.62',
          });
          assert.equal(rejectedRegistration.response.status, 202);
          const rejectedUser = await User.findOne({
            phoneNormalized: normalizePhone('9000000014'),
          });
          const rejected = await call(`/users/${rejectedUser._id}`, {
            method: 'PATCH',
            token: adminToken,
            body: { accountStatus: 'REJECTED' },
          });
          assert.equal(rejected.response.status, 200);
          assert.equal(
            (
              await call('/auth/tailor/login', {
                method: 'POST',
                body: { phone: '9000000014', password: 'A-Strong-QA-Password-2026' },
              })
            ).response.status,
            403,
          );
          assert.equal((await call('/dashboard/summary')).response.status, 401);
          assert.equal(
            (await call('/dashboard/summary', { token: customerToken, csrf: false })).response
              .status,
            200,
          );
          assert.equal(
            (await call('/orders', { method: 'POST', token: customerToken, csrf: false, body: {} }))
              .response.status,
            403,
          );
          const logout = await call('/auth/logout', { method: 'POST', token: customerToken });
          assert.equal(logout.response.status, 200);
          assert.match(logout.setCookie, /tailor_token=;/);
        },
      );

      await t.test('measurement CRUD and customer/tailor ownership', async () => {
        const create = await call('/measurements', {
          method: 'POST',
          token: customerToken,
          body: {
            name: 'QA blouse fit',
            garmentType: 'Blouse',
            unit: 'cm',
            values: { bust: 88, waist: 72 },
          },
        });
        assert.equal(create.response.status, 201, JSON.stringify(create.payload));
        measurementId = create.payload.data._id;
        assert.equal(
          (
            await call(`/measurements/${measurementId}`, {
              method: 'PATCH',
              token: otherCustomerToken,
              body: { name: 'foreign edit' },
            })
          ).response.status,
          404,
        );
        const ownCustomer = await Customer.findOne({
          user: (await User.findOne({ phoneNormalized: normalizePhone('9876543210') }))._id,
        });
        tailorProfile = await Tailor.findOne({
          user: (await User.findOne({ phoneNormalized: normalizePhone('9000000003') }))._id,
        });
        const tailorMeasurement = await call('/measurements', {
          method: 'POST',
          token: adminToken,
          body: {
            customer: ownCustomer._id,
            name: 'QA work fit',
            garmentType: 'Blouse',
            values: { bust: 90 },
            unit: 'cm',
          },
        });
        assert.equal(tailorMeasurement.response.status, 201);
        assert.equal(
          (await call(`/measurements?customer=${otherCustomerProfile._id}`, { token: tailorToken }))
            .response.status,
          403,
        );
        const updated = await call(`/measurements/${measurementId}`, {
          method: 'PATCH',
          token: customerToken,
          body: { values: { bust: 90 } },
        });
        assert.equal(updated.response.status, 200);
        assert.equal(
          (await call(`/measurements/${measurementId}`, { method: 'DELETE', token: customerToken }))
            .response.status,
          200,
        );
        measurementId = tailorMeasurement.payload.data._id;
      });

      await t.test(
        'order assignment, tracking, lifecycle, and payment ledger ownership',
        async () => {
          const created = await call('/orders', {
            method: 'POST',
            token: customerToken,
            body: {
              dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
              measurement: measurementId,
              items: [{ service: String(service._id), quantity: 3 }],
            },
          });
          assert.equal(created.response.status, 201, JSON.stringify(created.payload));
          order = created.payload.data;
          assert.equal(order.finalAmount, 3600);
          assert.equal(
            (await call(`/orders/${order._id}`, { token: otherCustomerToken })).response.status,
            404,
          );
          assert.equal(
            (
              await call('/payments', {
                method: 'POST',
                token: otherCustomerToken,
                body: { order: order._id, amount: 50 },
              })
            ).response.status,
            403,
          );
          assert.equal(
            (
              await call('/payments', {
                method: 'POST',
                token: customerToken,
                body: { order: order._id, amount: 1200, method: 'UPI' },
              })
            ).response.status,
            403,
          );
          assert.equal(
            (await Order.findById(order._id)).paidAmount,
            0,
            'customer payment claims must not update the confirmed ledger',
          );
          assert.equal(
            (
              await call(`/orders/${order._id}/status`, {
                method: 'PATCH',
                token: adminToken,
                body: { status: 'CONFIRMED' },
              })
            ).response.status,
            200,
          );
          const assign = await call(`/orders/${order._id}/assign`, {
            method: 'PATCH',
            token: adminToken,
            body: { tailor: String(tailorProfile._id) },
          });
          assert.equal(assign.response.status, 200);
          assert.equal(
            (await call(`/orders/${order._id}`, { token: tailorToken })).response.status,
            200,
          );
          const customerMessage = await call(`/orders/${order._id}/notes`, {
            method: 'POST',
            token: customerToken,
            body: { text: 'Can we change my fitting time?' },
          });
          assert.equal(customerMessage.response.status, 201);
          const adminReply = await call(`/orders/${order._id}/notes`, {
            method: 'POST',
            token: adminToken,
            body: { text: 'Yes, we can change your fitting time.' },
          });
          assert.equal(adminReply.response.status, 201);
          assert.equal(adminReply.payload.data.internal, false);
          const customerThread = await call(`/orders/${order._id}`, { token: customerToken });
          assert.ok(
            customerThread.payload.data.notes.some(
              (note) => note.text === 'Yes, we can change your fitting time.',
            ),
          );
          await call(`/orders/${order._id}/notes`, {
            method: 'POST',
            token: adminToken,
            body: { text: 'Private workshop note', internal: true },
          });
          const threadAfterPrivateNote = await call(`/orders/${order._id}`, {
            token: customerToken,
          });
          assert.ok(
            !threadAfterPrivateNote.payload.data.notes.some(
              (note) => note.text === 'Private workshop note',
            ),
          );
          const foreign = await call(`/orders/${order._id}/status`, {
            method: 'PATCH',
            token: (await User.findById(tailorProfile.user).select('_id')) ? tailorToken : '',
            body: { status: 'CUTTING' },
          });
          assert.equal(foreign.response.status, 200);
          assert.equal(
            (
              await call(`/orders/${order._id}/status`, {
                method: 'PATCH',
                token: tailorToken,
                body: { status: 'COMPLETED' },
              })
            ).response.status,
            409,
          );
          const tracked = await call(`/orders/${order._id}`, { token: customerToken });
          assert.equal(tracked.payload.data.status, 'CUTTING');
          assert.ok(tracked.payload.data.statusHistory.some((entry) => entry.status === 'CUTTING'));

          const partial = await call('/payments', {
            method: 'POST',
            token: adminToken,
            body: { order: order._id, amount: 1200, method: 'UPI' },
          });
          assert.equal(partial.response.status, 201);
          assert.equal(partial.payload.data.order.remainingAmount, 2400);
          assert.equal(partial.payload.data.order.paymentStatus, 'PARTIAL');
          assert.equal(
            (
              await call('/payments', {
                method: 'POST',
                token: adminToken,
                body: { order: order._id, amount: 0 },
              })
            ).response.status,
            400,
          );
          assert.equal(
            (
              await call('/payments', {
                method: 'POST',
                token: adminToken,
                body: { order: order._id, amount: 2400 },
              })
            ).response.status,
            201,
          );
          const customerRefund = await call(
            `/payments/${partial.payload.data.payment._id}/refund`,
            {
              method: 'POST',
              token: customerToken,
              body: { amount: 200 },
            },
          );
          assert.equal(customerRefund.response.status, 403);
          const refund = await call(`/payments/${partial.payload.data.payment._id}/refund`, {
            method: 'POST',
            token: adminToken,
            body: { amount: 200 },
          });
          assert.equal(refund.response.status, 201);
          assert.equal(refund.payload.data.type, 'REFUND');
          assert.equal((await Order.findById(order._id)).paidAmount, 3400);
          assert.equal((await Order.findById(order._id)).remainingAmount, 200);
          assert.equal(
            (
              await call(`/payments/${partial.payload.data.payment._id}/refund`, {
                method: 'POST',
                token: adminToken,
                body: { amount: 1001 },
              })
            ).response.status,
            409,
          );
          const history = await call(`/payments?order=${order._id}`, { token: customerToken });
          assert.equal(history.response.status, 200);
          assert.equal(history.payload.data.length, 3);
          assert.ok(
            history.payload.data.every((entry) => !('notes' in entry) && !('receivedBy' in entry)),
          );
          assert.equal(
            (
              await call('/payments', {
                token: tailorToken,
                method: 'POST',
                body: { order: order._id, amount: 1 },
              })
            ).response.status,
            403,
          );
        },
      );

      await t.test('appointment listing, ownership, and status permissions', async () => {
        const created = await call('/appointments', {
          method: 'POST',
          token: adminToken,
          body: {
            customer: String(customerProfile._id),
            order: String(order._id),
            tailor: String(tailorProfile._id),
            title: 'QA fitting',
            type: 'FITTING',
            durationMinutes: 45,
            scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(),
          },
        });
        assert.equal(created.response.status, 201, JSON.stringify(created.payload));
        const appointmentId = created.payload.data._id;
        assert.equal(
          (await call('/appointments', { token: customerToken })).payload.data.length,
          1,
        );
        assert.equal(
          (await call('/appointments', { token: otherCustomerToken })).payload.data.length,
          0,
        );
        assert.equal((await call('/appointments', { token: tailorToken })).payload.data.length, 1);
        assert.equal(
          (
            await call(`/appointments/${appointmentId}`, {
              method: 'PATCH',
              token: otherCustomerToken,
              body: { status: 'CANCELLED' },
            })
          ).response.status,
          404,
        );
        assert.equal(
          (
            await call(`/appointments/${appointmentId}`, {
              method: 'PATCH',
              token: customerToken,
              body: { status: 'COMPLETED' },
            })
          ).response.status,
          403,
        );
        const completed = await call(`/appointments/${appointmentId}`, {
          method: 'PATCH',
          token: tailorToken,
          body: { status: 'COMPLETED' },
        });
        assert.equal(completed.response.status, 200);
        assert.equal(completed.payload.data.status, 'COMPLETED');
      });

      await t.test('customer appointments require approval and a tailor assignment', async () => {
        const request = await call('/appointments', {
          method: 'POST',
          token: customerToken,
          body: {
            title: 'Customer fitting request',
            type: 'FITTING',
            scheduledAt: new Date(Date.now() + 3 * 86400000).toISOString(),
          },
        });
        assert.equal(request.response.status, 201, JSON.stringify(request.payload));
        assert.equal(request.payload.data.status, 'PENDING');
        const appointmentId = request.payload.data._id;
        assert.equal(
          (
            await call(`/appointments/${appointmentId}`, {
              method: 'PATCH',
              token: adminToken,
              body: { status: 'SCHEDULED' },
            })
          ).response.status,
          400,
        );
        const adminApproval = await call(`/appointments/${appointmentId}`, {
          method: 'PATCH',
          token: adminToken,
          body: { status: 'SCHEDULED', tailor: String(tailorProfile._id) },
        });
        assert.equal(adminApproval.response.status, 200, JSON.stringify(adminApproval.payload));
        assert.equal(String(adminApproval.payload.data.tailor._id), String(tailorProfile._id));

        const tailorRequest = await call('/appointments', {
          method: 'POST',
          token: otherCustomerToken,
          body: {
            title: 'Tailor approval request',
            type: 'MEASUREMENT',
            scheduledAt: new Date(Date.now() + 4 * 86400000).toISOString(),
          },
        });
        assert.equal(tailorRequest.response.status, 201);
        const tailorApproval = await call(`/appointments/${tailorRequest.payload.data._id}`, {
          method: 'PATCH',
          token: tailorToken,
          body: { status: 'SCHEDULED' },
        });
        assert.equal(tailorApproval.response.status, 200, JSON.stringify(tailorApproval.payload));
        assert.equal(String(tailorApproval.payload.data.tailor._id), String(tailorProfile._id));
      });

      await t.test(
        'payroll is admin-managed and each tailor sees only their own records',
        async () => {
          const secondTailorUser = await User.create({
            name: 'Second tailor',
            phone: '+91 90000 00006',
            password: await bcrypt.hash('A-Strong-QA-Password-2026', 4),
            role: 'TAILOR',
          });
          const first = await call('/salaries', {
            method: 'POST',
            token: adminToken,
            body: {
              employee: tailorProfile.user,
              month: 10,
              year: 2026,
              baseSalary: 30000,
              bonuses: 2000,
              overtime: 500,
              deductions: 1000,
              advance: 1000,
            },
          });
          assert.equal(first.response.status, 201, JSON.stringify(first.payload));
          const salaryId = first.payload.data._id;
          assert.equal(first.payload.data.netSalary, 30500);
          assert.equal((await User.findById(tailorProfile.user)).defaultBaseSalary, 30000);
          assert.equal(
            (
              await call('/salaries', {
                method: 'POST',
                token: adminToken,
                body: { employee: tailorProfile.user, month: 10, year: 2026, baseSalary: 1 },
              })
            ).response.status,
            409,
          );
          const second = await call('/salaries', {
            method: 'POST',
            token: adminToken,
            body: { employee: secondTailorUser._id, month: 10, year: 2026, baseSalary: 15000 },
          });
          assert.equal(second.response.status, 201);
          const own = await call('/salaries/mine', { token: tailorToken });
          assert.deepEqual(
            own.payload.data.map((row) => row._id),
            [salaryId],
          );
          assert.equal((await call('/salaries', { token: tailorToken })).response.status, 403);
          assert.equal(
            (
              await call(`/salaries/${salaryId}/payments`, {
                method: 'POST',
                token: tailorToken,
                body: { amount: 100 },
              })
            ).response.status,
            403,
          );
          assert.equal(
            (await call('/salaries/mine', { token: customerToken })).response.status,
            403,
          );
          assert.equal(
            (
              await call(`/salaries/${salaryId}`, {
                method: 'PATCH',
                token: adminToken,
                body: { baseSalary: 31000 },
              })
            ).response.status,
            200,
          );
          const partial = await call(`/salaries/${salaryId}/payments`, {
            method: 'POST',
            token: adminToken,
            body: { amount: 10000, method: 'BANK_TRANSFER' },
          });
          assert.equal(partial.response.status, 201);
          assert.equal(partial.payload.data.paymentStatus, 'PARTIALLY_PAID');
          assert.equal(
            (
              await call(`/salaries/${salaryId}/payments`, {
                method: 'POST',
                token: adminToken,
                body: {},
              })
            ).response.status,
            201,
          );
          const paid = await Salary.findById(salaryId);
          assert.equal(paid.paymentStatus, 'PAID');
          assert.equal(paid.amountPaid, paid.netSalary);
          const tailorSalaryHistory = await call('/salaries/mine', { token: tailorToken });
          assert.equal(tailorSalaryHistory.response.status, 200);
          assert.equal(tailorSalaryHistory.payload.data[0].payments.length, 2);
          assert.equal(tailorSalaryHistory.payload.data[0].baseSalary, 31000);
          assert.equal(
            (
              await call(`/salaries/${salaryId}`, {
                method: 'PATCH',
                token: adminToken,
                body: { baseSalary: 30000 },
              })
            ).response.status,
            409,
          );
          assert.ok(
            await mongoose.model('AuditLog').exists({ entity: 'Salary', entityId: salaryId }),
          );
          const changedBaseSalary = await call('/salaries/base-salary', {
            method: 'PATCH',
            token: adminToken,
            body: { employee: tailorProfile.user, baseSalary: 32000 },
          });
          assert.equal(changedBaseSalary.response.status, 200);
          const nextMonthSalary = await call('/salaries', {
            method: 'POST',
            token: adminToken,
            body: { employee: tailorProfile.user, month: 11, year: 2026 },
          });
          assert.equal(
            nextMonthSalary.response.status,
            201,
            JSON.stringify(nextMonthSalary.payload),
          );
          assert.equal(nextMonthSalary.payload.data.baseSalary, 32000);
        },
      );

      await t.test(
        'profile changes stay synchronized and password updates are verified',
        async () => {
          const nextPassword = 'Updated-Profile-Password-2026';
          const nextPhone = '+91 90000 00101';
          const missingCurrentPassword = await call('/users/me', {
            method: 'PATCH',
            token: customerToken,
            body: { password: nextPassword },
          });
          assert.equal(missingCurrentPassword.response.status, 400);

          const invalidCurrentPassword = await call('/users/me', {
            method: 'PATCH',
            token: customerToken,
            body: { currentPassword: 'incorrect', password: nextPassword },
          });
          assert.equal(invalidCurrentPassword.response.status, 400);

          const updatedCustomer = await call('/users/me', {
            method: 'PATCH',
            token: customerToken,
            body: {
              name: 'Updated QA Customer',
              phone: nextPhone,
              currentPassword: 'Temporary-QA-Password-2026',
              password: nextPassword,
            },
          });
          assert.equal(
            updatedCustomer.response.status,
            200,
            JSON.stringify(updatedCustomer.payload),
          );
          assert.equal(updatedCustomer.payload.data.user.name, 'Updated QA Customer');
          assert.equal('password' in updatedCustomer.payload.data.user, false);
          const linkedCustomer = await Customer.findById(customerProfile._id);
          assert.equal(linkedCustomer.name, 'Updated QA Customer');
          assert.equal(linkedCustomer.phone, nextPhone);
          assert.equal(linkedCustomer.phoneNormalized, normalizePhone(nextPhone));
          const updatedUser = await User.findById(customerProfile.user).select('+password');
          assert.equal(updatedUser.phoneNormalized, normalizePhone(nextPhone));
          assert.equal(await bcrypt.compare(nextPassword, updatedUser.password), true);
          assert.equal(
            (
              await call('/auth/customer/login', {
                method: 'POST',
                body: { phone: nextPhone, password: nextPassword },
              })
            ).response.status,
            200,
          );

          const updatedTailor = await call('/users/me', {
            method: 'PATCH',
            token: tailorToken,
            body: { name: 'Updated QA Tailor', phone: '+91 90000 00102' },
          });
          assert.equal(updatedTailor.response.status, 200);
          const linkedTailor = await Tailor.findOne({ user: tailorProfile.user });
          assert.equal(linkedTailor.name, 'Updated QA Tailor');
          assert.equal(linkedTailor.phone, '+91 90000 00102');
        },
      );

      await t.test('notifications leave unread counts when marked read', async () => {
        const notification = await Notification.create({
          recipient: tailorProfile.user,
          title: 'QA unread notification',
          message: 'This notification is used to test read state.',
          type: 'INFO',
        });
        const unread = await call('/notifications?unread=true', { token: tailorToken });
        assert.equal(unread.response.status, 200);
        assert.ok(unread.payload.data.some((row) => String(row._id) === String(notification._id)));
        assert.ok(unread.payload.meta.unreadCount > 0);

        const marked = await call(`/notifications/${notification._id}/read`, {
          method: 'PATCH',
          token: tailorToken,
        });
        assert.equal(marked.response.status, 200);
        assert.ok(marked.payload.data.readAt);
        const afterRead = await call('/notifications?unread=true', { token: tailorToken });
        assert.ok(
          afterRead.payload.data.every((row) => String(row._id) !== String(notification._id)),
        );

        const allRead = await call('/notifications/read-all', {
          method: 'PATCH',
          token: tailorToken,
        });
        assert.equal(allRead.response.status, 200);
        const remainingUnread = await call('/notifications?unread=true', { token: tailorToken });
        assert.equal(remainingUnread.payload.meta.unreadCount, 0);
      });

      await t.test(
        'upload validation, provider failure cleanup, CORS and security headers',
        async () => {
          const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
          const file = { mimetype: 'image/png', buffer: png };
          const { uploadImages, deleteUploadedImages } =
            await import('../src/services/uploadService.js');
          const successfulUploader = {
            upload_stream: (_options, callback) => ({
              end: () =>
                callback(null, {
                  secure_url: 'https://cdn.example.test/qa.png',
                  public_id: 'qa/test-image',
                }),
            }),
          };
          assert.deepEqual(
            await uploadImages([file], { enabled: true, uploader: successfulUploader }),
            [{ url: 'https://cdn.example.test/qa.png', publicId: 'qa/test-image' }],
          );
          const deletedIds = [];
          await deleteUploadedImages(
            [{ publicId: 'qa/new-image-a' }, { publicId: 'qa/new-image-b' }, { url: 'no-id' }],
            { uploader: { destroy: async (publicId) => deletedIds.push(publicId) } },
          );
          assert.deepEqual(deletedIds.sort(), ['qa/new-image-a', 'qa/new-image-b']);
          await assert.rejects(
            uploadImages([{ mimetype: 'image/png', buffer: Buffer.from('not an image') }], {
              enabled: true,
              uploader: successfulUploader,
            }),
            { statusCode: 400 },
          );
          let destroyed = 0;
          let calls = 0;
          const failingUploader = {
            upload_stream: (_options, callback) => ({
              end: () => {
                calls += 1;
                callback(
                  calls === 1 ? null : new Error('provider secret'),
                  calls === 1
                    ? {
                        secure_url: 'https://cdn.example.test/partial.png',
                        public_id: 'qa/partial',
                      }
                    : undefined,
                );
              },
            }),
            destroy: async () => {
              destroyed += 1;
              return { result: 'ok' };
            },
          };
          await assert.rejects(
            uploadImages([file, file], { enabled: true, uploader: failingUploader }),
            { statusCode: 502 },
          );
          assert.equal(destroyed, 1);
          const invalid = new FormData();
          invalid.append('images', new Blob(['bad'], { type: 'text/plain' }), 'bad.txt');
          assert.equal(
            (await call('/orders', { method: 'POST', token: customerToken, form: invalid }))
              .response.status,
            400,
          );
          const tooLarge = new FormData();
          tooLarge.append(
            'images',
            new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: 'image/png' }),
            'large.png',
          );
          assert.equal(
            (await call('/orders', { method: 'POST', token: customerToken, form: tooLarge }))
              .response.status,
            413,
          );
          const unconfigured = new FormData();
          unconfigured.append('dueDate', new Date(Date.now() + 7 * 86400000).toISOString());
          unconfigured.append(
            'items',
            JSON.stringify([{ service: String(service._id), quantity: 1 }]),
          );
          unconfigured.append('images', new Blob([png], { type: 'image/png' }), 'image.png');
          assert.equal(
            (await call('/orders', { method: 'POST', token: customerToken, form: unconfigured }))
              .response.status,
            503,
          );
          const allowed = await call('/health', {
            method: 'OPTIONS',
            headers: { origin: 'http://localhost:5174', 'access-control-request-method': 'GET' },
          });
          assert.equal(
            allowed.response.headers.get('access-control-allow-origin'),
            'http://localhost:5174',
          );
          assert.equal(
            (await call('/health')).response.headers.get('x-content-type-options'),
            'nosniff',
          );
          const blocked = await call('/health', {
            method: 'OPTIONS',
            headers: { origin: 'https://wrong.example', 'access-control-request-method': 'GET' },
          });
          assert.equal(blocked.response.headers.get('access-control-allow-origin'), null);
        },
      );
    }),
);
