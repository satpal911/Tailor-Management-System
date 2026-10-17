import 'dotenv/config';
import http from 'node:http';
import mongoose from 'mongoose';
import app from './app.js';
import connectDatabase from './config/database.js';
import { attachSockets } from './sockets/index.js';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error('JWT_SECRET must be at least 32 characters');
if (
  process.env.COOKIE_SAME_SITE &&
  !['lax', 'strict', 'none'].includes(process.env.COOKIE_SAME_SITE.toLowerCase())
)
  throw new Error('COOKIE_SAME_SITE must be lax, strict, or none');
if (
  process.env.COOKIE_SAME_SITE?.toLowerCase() === 'none' &&
  process.env.NODE_ENV !== 'production' &&
  process.env.COOKIE_SECURE !== 'true'
)
  throw new Error('SameSite=None cookies require COOKIE_SECURE=true');
if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'true')
  throw new Error('COOKIE_SECURE=true is required in production');
if (
  process.env.NODE_ENV === 'production' &&
  !process.env.CLIENT_URL &&
  !process.env.CLIENT_ORIGIN &&
  !process.env.RENDER_EXTERNAL_URL
)
  throw new Error('CLIENT_URL is required in production');
const server = http.createServer(app);
const io = attachSockets(server);
app.set('io', io);
const port = Number(process.env.PORT || 5000);
try {
  await connectDatabase();
  server.listen(port, () => console.info(`Tailor API listening on ${port}`));
} catch {
  console.error('API startup failed. Check the database connection and server configuration.');
  process.exit(1);
}
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  io.close(async () => {
    await mongoose.disconnect();
    clearTimeout(timeout);
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
