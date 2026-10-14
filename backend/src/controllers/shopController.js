import ShopSettings from '../models/ShopSettings.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getPublicShop = asyncHandler(async (req, res) => {
  const settings = await ShopSettings.findOne({ key: 'main' }).select('shopName');
  res.json({
    success: true,
    data: { name: settings?.shopName || req.tenant.name, slug: req.tenant.slug },
  });
});
