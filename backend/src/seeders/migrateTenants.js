import 'dotenv/config';
import mongoose from 'mongoose';
import Shop from '../models/Shop.js';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Tailor from '../models/Tailor.js';
import Category from '../models/Category.js';
import Service from '../models/Service.js';
import ShopSettings from '../models/ShopSettings.js';
import Order from '../models/Order.js';
import Salary from '../models/Salary.js';
import Measurement from '../models/Measurement.js';
import Notification from '../models/Notification.js';
import Appointment from '../models/Appointment.js';
import Payment from '../models/Payment.js';
import AuditLog from '../models/AuditLog.js';

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
const models = [
  User,
  Customer,
  Tailor,
  Category,
  Service,
  ShopSettings,
  Order,
  Salary,
  Measurement,
  Notification,
  Appointment,
  Payment,
  AuditLog,
];
const legacyIndexes = [
  [User, ['email_1', 'phoneNormalized_1']],
  [Customer, ['user_1']],
  [Tailor, ['user_1']],
  [Category, ['name_1']],
  [Service, ['name_1_category_1']],
  [ShopSettings, ['key_1']],
  [Order, ['orderNumber_1']],
  [Salary, ['employee_1_year_-1_month_-1']],
];

function requireLocalDatabase() {
  if (!uri) throw new Error('MONGO_URI is required.');
  const { hostname } = new URL(uri);
  if (
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1', '::1'].includes(hostname)
  )
    throw new Error('Tenant migration is limited to a non-production loopback MongoDB database.');
}

async function findDuplicate(model, fields, match) {
  const groupId = Object.fromEntries(fields.map((field) => [field, `$${field}`]));
  return model.collection
    .aggregate([
      {
        $match: {
          $and: [{ $or: [{ tenantId: { $exists: false } }, { tenantId: null }] }, match],
        },
      },
      { $group: { _id: groupId, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 1 },
    ])
    .next();
}

try {
  requireLocalDatabase();
  await mongoose.connect(uri, { autoIndex: false });
  const duplicateChecks = [
    [User, ['email'], { email: { $type: 'string', $ne: '' } }],
    [User, ['phoneNormalized'], { phoneNormalized: { $type: 'string', $ne: '' } }],
    [Customer, ['user'], { user: { $type: 'objectId' } }],
    [Tailor, ['user'], { user: { $type: 'objectId' } }],
    [Category, ['name'], { name: { $type: 'string' } }],
    [Service, ['name', 'category'], { name: { $type: 'string' }, category: { $type: 'objectId' } }],
    [ShopSettings, ['key'], { key: { $type: 'string' } }],
    [Order, ['orderNumber'], { orderNumber: { $type: 'string' } }],
    [Salary, ['employee', 'year', 'month'], { employee: { $type: 'objectId' } }],
  ];
  for (const [model, fields, match] of duplicateChecks) {
    if (await findDuplicate(model, fields, match))
      throw new Error(
        `Duplicate ${model.modelName} identity found; no records or indexes were changed.`,
      );
  }

  const slug = process.env.DEFAULT_SHOP_SLUG || 'main';
  let shop = await Shop.findOne({ slug });
  if (!shop) {
    shop = await Shop.create({
      slug,
      name: process.env.DEFAULT_SHOP_NAME || 'Stitchcraft Atelier',
      domains: [process.env.DEFAULT_SHOP_DOMAIN || 'localhost'],
    });
  }

  // Build tenant-aware unique indexes before removing their legacy global counterparts.
  for (const model of models) {
    const indexes = model.schema
      .indexes()
      .filter(([keys, options]) => options.unique && keys.tenantId);
    for (const [keys, options] of indexes) {
      const expectedName =
        options.name ||
        Object.entries(keys)
          .map(([key, value]) => `${key}_${value}`)
          .join('_');
      const existing = (await model.collection.indexes()).find(
        (index) => index.name === expectedName,
      );
      const sameOptions =
        existing &&
        existing.unique === options.unique &&
        Boolean(existing.sparse) === Boolean(options.sparse) &&
        JSON.stringify(existing.partialFilterExpression || null) ===
          JSON.stringify(options.partialFilterExpression || null);
      if (existing && !sameOptions) await model.collection.dropIndex(existing.name);
      if (!sameOptions) await model.collection.createIndex(keys, options);
    }
  }

  let assigned = 0;
  for (const model of models) {
    const result = await model.collection.updateMany(
      { $or: [{ tenantId: { $exists: false } }, { tenantId: null }] },
      { $set: { tenantId: shop._id } },
    );
    assigned += result.modifiedCount;
  }

  for (const [model, names] of legacyIndexes) {
    const indexes = await model.collection.indexes();
    for (const name of names) {
      if (indexes.some((index) => index.name === name)) await model.collection.dropIndex(name);
    }
  }
  console.info(
    `Tenant migration complete. Existing records assigned to the default shop: ${assigned}.`,
  );
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
