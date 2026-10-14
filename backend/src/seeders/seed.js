import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Customer from '../models/Customer.js';
import Tailor from '../models/Tailor.js';
import Category from '../models/Category.js';
import Service from '../models/Service.js';
import Order from '../models/Order.js';
import { ROLES } from '../constants/roles.js';
import { normalizePhone } from '../utils/phone.js';
import Shop from '../models/Shop.js';
import ShopSettings from '../models/ShopSettings.js';
import { runWithTenant } from '../services/tenantContext.js';

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
const tailorPassword = process.env.SEED_TAILOR_PASSWORD;
const customerPassword = process.env.SEED_CUSTOMER_PASSWORD;
if (!mongoUri) throw new Error('MONGO_URI is required to seed the database.');
for (const [name, password] of [
  ['SEED_ADMIN_PASSWORD', adminPassword],
  ['SEED_TAILOR_PASSWORD', tailorPassword],
]) {
  if (!password || password.length < 12)
    throw new Error(`${name} must be set to a unique password of at least 12 characters.`);
}
if (adminPassword === tailorPassword)
  throw new Error('Use different passwords for the seeded owner and tailor accounts.');
if (
  customerPassword &&
  (customerPassword.length < 12 ||
    customerPassword === adminPassword ||
    customerPassword === tailorPassword)
)
  throw new Error(
    'SEED_CUSTOMER_PASSWORD must be at least 12 characters and different from the other seeded passwords.',
  );

async function getOrCreateUser({
  name,
  email,
  phone,
  role,
  passwordHash,
  accountStatus = 'ACTIVE',
}) {
  const phoneNormalized = normalizePhone(phone);
  let user = await User.findOne({
    role,
    $or: [{ phoneNormalized }, ...(email ? [{ email }] : [])],
  });
  if (!user) {
    user = await User.create({
      name,
      email: email || undefined,
      phone,
      phoneNormalized,
      role,
      accountStatus,
      isActive: accountStatus === 'ACTIVE',
      password: passwordHash,
    });
    return user;
  }

  user.name = name;
  user.email = email || user.email || undefined;
  user.phone = phone;
  user.phoneNormalized = phoneNormalized;
  user.role = role;
  user.accountStatus = accountStatus;
  user.isActive = accountStatus === 'ACTIVE';
  if (passwordHash) user.password = passwordHash;
  await user.save();
  return user;
}

try {
  await mongoose.connect(mongoUri);
  const slug = process.env.DEFAULT_SHOP_SLUG || 'main';
  const shop = await Shop.findOneAndUpdate(
    { slug },
    {
      $setOnInsert: {
        name: process.env.DEFAULT_SHOP_NAME || 'Stitchcraft Atelier',
        domains: [process.env.DEFAULT_SHOP_DOMAIN || 'localhost'],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await runWithTenant(shop._id, async () => {
    if (!(await ShopSettings.exists({ key: 'main' })))
      await ShopSettings.create({ tenantId: shop._id, key: 'main', shopName: shop.name });
    const [adminHash, tailorHash, customerHash] = await Promise.all([
      bcrypt.hash(adminPassword, 12),
      bcrypt.hash(tailorPassword, 12),
      customerPassword ? bcrypt.hash(customerPassword, 12) : null,
    ]);
    const admin = await getOrCreateUser({
      name: 'Ananya Sharma',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@stitchcraft.local',
      phone: process.env.SEED_ADMIN_PHONE || '+91 90000 00001',
      role: ROLES.ADMIN,
      passwordHash: adminHash,
    });
    const tailorUser = await getOrCreateUser({
      name: 'Priya Kumari',
      email: process.env.SEED_TAILOR_EMAIL || 'tailor@stitchcraft.local',
      phone: process.env.SEED_TAILOR_PHONE || '+91 90000 00002',
      role: ROLES.TAILOR,
      passwordHash: tailorHash,
    });
    let customer = await Customer.findOne({
      phoneNormalized: normalizePhone(process.env.SEED_CUSTOMER_PHONE || '+91 90000 00003'),
    });
    if (!customer)
      customer = await Customer.create({
        name: 'Meera Shah',
        phone: process.env.SEED_CUSTOMER_PHONE || '+91 90000 00003',
      });
    if (customerHash) {
      const customerUser = customer.user ? await User.findById(customer.user) : null;
      if (customerUser) {
        customerUser.name = customer.name;
        customerUser.phone = customer.phone;
        customerUser.phoneNormalized = normalizePhone(customer.phone);
        customerUser.role = ROLES.CUSTOMER;
        customerUser.accountStatus = 'ACTIVE';
        customerUser.isActive = true;
        customerUser.password = customerHash;
        await customerUser.save();
      } else if (!(await User.exists({ phoneNormalized: normalizePhone(customer.phone) }))) {
        const createdCustomerUser = await User.create({
          name: customer.name,
          phone: customer.phone,
          phoneNormalized: normalizePhone(customer.phone),
          role: ROLES.CUSTOMER,
          accountStatus: 'ACTIVE',
          isActive: true,
          password: customerHash,
        });
        customer.user = createdCustomerUser._id;
        await customer.save();
      }
    }
    let tailor = await Tailor.findOne({ user: tailorUser._id });
    if (!tailor)
      tailor = await Tailor.create({
        user: tailorUser._id,
        name: tailorUser.name,
        phone: tailorUser.phone,
        specialties: ['Blouses', 'Kurtas'],
        status: 'ACTIVE',
      });
    let category = await Category.findOne({ name: 'Custom stitching' });
    if (!category) category = await Category.create({ name: 'Custom stitching' });
    let service = await Service.findOne({ name: 'Blouse stitching' });
    if (!service)
      service = await Service.create({
        name: 'Blouse stitching',
        category: category._id,
        basePrice: 1800,
        estimatedDays: 7,
      });
    if (!(await Order.exists({ customer: customer._id }))) {
      const orderNumber = `ORD-SEED-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const order = new Order({
        customer: customer._id,
        tailor: tailor._id,
        items: [{ service: service._id, description: 'Silk blouse', quantity: 1, unitPrice: 1800 }],
        dueDate: new Date(Date.now() + 7 * 86400000),
        createdBy: admin._id,
        discount: 0,
        tax: 0,
        orderNumber,
      });
      order.status = 'STITCHING';
      order.statusHistory.push(
        { status: 'PENDING', changedBy: admin._id, note: 'Seed order created' },
        { status: 'STITCHING', changedBy: admin._id, note: 'Sample order in progress' },
      );
      await order.save();
    }
    console.info(
      `Seed complete. Owner and tailor logins are configured.${customer.user ? ' Seed customer password account is available.' : ' Seed customer profile has no online login; set up access with the customer in person.'}`,
    );
  });
} finally {
  await mongoose.disconnect();
}
