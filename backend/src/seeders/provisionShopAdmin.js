import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Shop from '../models/Shop.js';
import User from '../models/User.js';
import ShopSettings from '../models/ShopSettings.js';
import { ROLES } from '../constants/roles.js';
import { normalizePhone } from '../utils/phone.js';
import { runWithTenant } from '../services/tenantContext.js';
import { hostname } from '../middleware/tenantMiddleware.js';

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
const required = [
  'PROVISION_SHOP_NAME',
  'PROVISION_SHOP_SLUG',
  'PROVISION_SHOP_DOMAIN',
  'PROVISION_ADMIN_NAME',
  'PROVISION_ADMIN_EMAIL',
  'PROVISION_ADMIN_PASSWORD',
];
for (const key of required) if (!process.env[key]) throw new Error(`${key} is required.`);
if (!uri) throw new Error('MONGO_URI is required.');
if (process.env.PROVISION_ADMIN_PASSWORD.length < 12)
  throw new Error('PROVISION_ADMIN_PASSWORD must be at least 12 characters.');

try {
  await mongoose.connect(uri);
  const slug = process.env.PROVISION_SHOP_SLUG.trim().toLowerCase();
  const domain = hostname(process.env.PROVISION_SHOP_DOMAIN);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) || !domain)
    throw new Error('Provide a valid shop slug and domain hostname.');

  let shop = await Shop.findOne({ slug });
  if (!shop)
    shop = await Shop.create({ name: process.env.PROVISION_SHOP_NAME, slug, domains: [domain] });
  else if (!shop.domains.includes(domain)) {
    if (await Shop.exists({ _id: { $ne: shop._id }, domains: domain }))
      throw new Error('That domain is already assigned to another shop.');
    shop.domains.push(domain);
    await shop.save();
  }

  await runWithTenant(shop._id, async () => {
    if (!(await ShopSettings.exists({ key: 'main' })))
      await ShopSettings.create({ tenantId: shop._id, key: 'main', shopName: shop.name });
    const email = process.env.PROVISION_ADMIN_EMAIL.trim().toLowerCase();
    const phone = process.env.PROVISION_ADMIN_PHONE?.trim() || '';
    await User.create({
      tenantId: shop._id,
      name: process.env.PROVISION_ADMIN_NAME,
      email,
      phone,
      phoneNormalized: phone ? normalizePhone(phone) : undefined,
      password: await bcrypt.hash(process.env.PROVISION_ADMIN_PASSWORD, 12),
      role: ROLES.ADMIN,
      accountStatus: 'ACTIVE',
      isActive: true,
    });
  });
  console.info(`Owner account provisioned for shop ${slug} (${domain}).`);
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
