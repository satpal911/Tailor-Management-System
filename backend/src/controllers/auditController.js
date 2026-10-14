import AuditLog from '../models/AuditLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pageOptions, pagination } from '../utils/query.js';

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageOptions(req);
  const filter = {};
  if (req.query.actor) filter.actor = req.query.actor;
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.action) filter.action = req.query.action;
  const [data, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actor', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ success: true, data, meta: pagination(page, limit, total) });
});
