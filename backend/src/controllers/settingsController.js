import ShopSettings from '../models/ShopSettings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { audit } from '../services/auditService.js';
export const getSettings = asyncHandler(async (_req, res) => {
  const doc = await ShopSettings.findOneAndUpdate(
    { key: 'main' },
    { $setOnInsert: { key: 'main' } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  res.json({ success: true, data: doc });
});
export const updateSettings = asyncHandler(async (req, res) => {
  const fields = {};
  for (const k of [
    'shopName',
    'contactEmail',
    'phone',
    'address',
    'currency',
    'timezone',
    'taxRate',
    'orderPrefix',
    'requireDeposit',
  ])
    if (req.body[k] !== undefined) fields[k] = req.body[k];
  const doc = await ShopSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: fields, $setOnInsert: { key: 'main' } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await audit(req.user._id, 'UPDATE', 'ShopSettings', doc._id, fields, req.ip);
  res.json({ success: true, data: doc });
});
