
import jwt from 'jsonwebtoken';
import Shop from '../models/Shop.js';
import { runWithTenant } from '../services/tenantContext.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function hostname(value) {
  if (!value) return '';

  try {
    return new URL(
      value.includes('://') ? value : `http://${value}`,
    ).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isDefaultShopHost(host) {
  if (['localhost', '127.0.0.1', '::1'].includes(host)) {
    return true;
  }

  const renderHost = hostname(
    process.env.RENDER_EXTERNAL_HOSTNAME ||
      process.env.RENDER_EXTERNAL_URL,
  );

  return Boolean(renderHost) && host === renderHost;
}

export const resolveTenant = asyncHandler(async (req, res, next) => {
  const originHost = hostname(req.get('origin'));
  const requestHost = hostname(req.get('host'));
  const candidate = originHost || requestHost;

  const defaultHost = isDefaultShopHost(candidate);

  // First, resolve a shop configured for this hostname.
  let shop = candidate
    ? await Shop.findOne({
        domains: candidate,
        isActive: true,
      })
    : null;

  // On the shared Render hostname or localhost, try resolving
  // the shop from a cryptographically verified session token.
  if (!shop && defaultHost) {
    const token = req.cookies?.tailor_token;

    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (
          decoded &&
          typeof decoded === 'object' &&
          typeof decoded.tid === 'string'
        ) {
          shop = await Shop.findOne({
            _id: decoded.tid,
            isActive: true,
          });
        }
      } catch {
        // Invalid or expired tokens cannot select a tenant.
        // Protected routes must still authenticate the user.
      }
    }

    // Preserve the default main shop for visitors without
    // a valid, resolvable tenant session.
    if (!shop) {
      const slug = process.env.DEFAULT_SHOP_SLUG || 'main';

      shop = await Shop.findOne({
        slug,
        isActive: true,
      });
    }
  }

  if (!shop) {
    throw Object.assign(
      new Error(
        'This shop address is not configured. Contact the shop owner.',
      ),
      { statusCode: 404 },
    );
  }

  req.tenant = shop;
  runWithTenant(shop._id, next);
});

export async function isShopOrigin(origin) {
  const host = hostname(origin);

  if (!host) return false;
  if (isDefaultShopHost(host)) return true;

  return Boolean(
    await Shop.exists({
      domains: host,
      isActive: true,
    }),
  );
}
