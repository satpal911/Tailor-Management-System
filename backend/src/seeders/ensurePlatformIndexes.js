import 'dotenv/config';
import mongoose from 'mongoose';
import PlatformAdmin from '../models/PlatformAdmin.js';
import ShopApplication from '../models/ShopApplication.js';
import Shop from '../models/Shop.js';
import User from '../models/User.js';

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error('MONGO_URI is required.');

try {
  await mongoose.connect(uri);
  await Promise.all([
    PlatformAdmin.createIndexes(),
    ShopApplication.createIndexes(),
    Shop.createIndexes(),
    User.createIndexes(),
  ]);
  console.info('Platform SaaS indexes are ready.');
} finally {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
