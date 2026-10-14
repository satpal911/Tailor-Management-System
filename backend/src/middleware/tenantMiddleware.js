import Shop from '../models/Shop.js';
import { runWithTenant } from '../services/tenantContext.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function hostname(value) {
  if (!value) return '';
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export const resolveTenant = asyncHandler(async (req, res, next) => {
  const originHost = hostname(req.get('origin'));
  const requestHost = hostname(req.get('host'));
  const candidate = originHost || requestHost;
  let shop = candidate ? await Shop.findOne({ domains: candidate, isActive: true }) : null;

  if (!shop && ['localhost', '127.0.0.1', '::1'].includes(candidate)) {
    const slug = process.env.DEFAULT_SHOP_SLUG || 'main';
    shop = await Shop.findOne({ slug, isActive: true });
  }

  if (!shop)
    throw Object.assign(new Error('This shop address is not configured. Contact the shop owner.'), {
      statusCode: 404,
    });

  req.tenant = shop;
  runWithTenant(shop._id, next);
});

export async function isShopOrigin(origin) {
  const host = hostname(origin);
  if (!host) return false;
  if (['localhost', '127.0.0.1', '::1'].includes(host)) return true;
  return Boolean(await Shop.exists({ domains: host, isActive: true }));
}
