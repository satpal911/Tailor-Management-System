import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import PlatformAdmin from '../models/PlatformAdmin.js';

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
const { PLATFORM_ADMIN_NAME: name, PLATFORM_ADMIN_EMAIL: email, PLATFORM_ADMIN_PASSWORD: password } =
  process.env;

if (!uri) throw new Error('MONGO_URI is required.');
if (!name || !email || !password)
  throw new Error('PLATFORM_ADMIN_NAME, PLATFORM_ADMIN_EMAIL, and PLATFORM_ADMIN_PASSWORD are required.');
if (password.length < 16)
  throw new Error('PLATFORM_ADMIN_PASSWORD must be at least 16 characters.');

try {
  await mongoose.connect(uri);
  const normalizedEmail = email.trim().toLowerCase();
  if (await PlatformAdmin.exists({ email: normalizedEmail }))
    throw new Error('A platform administrator already exists for this email.');
  await PlatformAdmin.create({
    name,
    email: normalizedEmail,
    password: await bcrypt.hash(password, 12),
  });
  console.info(`Platform administrator created for ${normalizedEmail}.`);
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
