import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Tailor from '../models/Tailor.js';
import { normalizePhone } from '../utils/phone.js';

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error('MONGO_URI is required to migrate phone identities.');
mongoose.set('autoIndex', false);
for (const model of [User, Customer, Tailor]) model.schema.set('autoIndex', false);

try {
  await mongoose.connect(uri);
  const users = await User.collection.find({}).toArray();
  const seen = new Map();
  const userUpdates = [];
  for (const user of users) {
    const set = {};
    if (user.phone) {
      const normalized = normalizePhone(user.phone);
      const scopedPhone = `${user.tenantId || 'legacy'}:${normalized}`;
      if (seen.has(scopedPhone))
        throw new Error(
          `Duplicate normalized phone identity on user records ${seen.get(scopedPhone)} and ${user._id}. Resolve the collision before migration.`,
        );
      seen.set(scopedPhone, user._id);
      set.phoneNormalized = normalized;
    }
    set.accountStatus = user.accountStatus || (user.isActive === false ? 'INACTIVE' : 'ACTIVE');
    if (user.role === 'CUSTOMER')
      set.accountStatus = user.isActive === false ? 'INACTIVE' : 'ACTIVE';
    userUpdates.push(
      User.collection.updateOne(
        { _id: user._id },
        { $set: set, ...(user.role === 'CUSTOMER' ? { $unset: { password: '' } } : {}) },
      ),
    );
  }
  const customers = await Customer.collection
    .find({ phone: { $type: 'string', $ne: '' } })
    .toArray();
  const customerPhones = new Map();
  for (const customer of customers) {
    const normalized = normalizePhone(customer.phone);
    const scopedPhone = `${customer.tenantId || 'legacy'}:${normalized}`;
    if (customerPhones.has(scopedPhone))
      throw new Error(
        `Duplicate normalized phone identity on customer profiles ${customerPhones.get(scopedPhone)} and ${customer._id}. Resolve the collision before migration.`,
      );
    customerPhones.set(scopedPhone, customer._id);
  }

  // Complete identity validation before applying any writes. The updates are idempotent,
  // so an interrupted run can safely be retried after the connection issue is resolved.
  await Promise.all(userUpdates);
  await Promise.all(
    customers.map((customer) =>
      Customer.collection.updateOne(
        { _id: customer._id },
        { $set: { phoneNormalized: normalizePhone(customer.phone) } },
      ),
    ),
  );

  const tailors = await Tailor.collection.find({}).toArray();
  await Promise.all(
    tailors.map(async (tailor) => {
      const user = await User.collection.findOne({ _id: tailor.user });
      const status = user?.accountStatus || (user?.isActive === false ? 'INACTIVE' : 'ACTIVE');
      return Tailor.collection.updateOne(
        { _id: tailor._id },
        { $set: { status, isAvailable: status === 'ACTIVE' && tailor.isAvailable !== false } },
      );
    }),
  );

  const indexes = await User.collection.indexes();
  for (const index of indexes) {
    if (
      index.unique &&
      Object.keys(index.key || {}).length === 1 &&
      ['email', 'phoneNormalized'].some((key) => index.key[key] === 1)
    )
      await User.collection.dropIndex(index.name);
  }
  await User.collection.createIndex(
    { tenantId: 1, email: 1 },
    { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
  );
  await User.collection.createIndex(
    { tenantId: 1, phoneNormalized: 1 },
    { unique: true, partialFilterExpression: { phoneNormalized: { $type: 'string' } } },
  );
  await Customer.collection.createIndex({ tenantId: 1, phoneNormalized: 1 }, { sparse: true });
  await Promise.all([Tailor.createIndexes(), Customer.createIndexes(), User.createIndexes()]);
  console.info(
    `Phone identity migration complete for ${users.length} users and ${customers.length} customer profiles. No phone values were logged.`,
  );
} finally {
  await mongoose.disconnect();
}
