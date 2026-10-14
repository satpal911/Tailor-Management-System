export function buildQuery(req, fields = []) {
  const q = {};
  if (req.query.search && fields.length) {
    const regex = new RegExp(escapeRegex(req.query.search), 'i');
    q.$or = fields.map((f) => ({ [f]: regex }));
  }
  for (const key of ['status', 'role', 'isActive', 'paymentStatus', 'customer', 'tailor'])
    if (req.query[key] !== undefined)
      q[key] = key === 'isActive' ? req.query[key] === 'true' : req.query[key];
  if (req.query.from || req.query.to) {
    q.dueDate = {};
    if (req.query.from) q.dueDate.$gte = new Date(req.query.from);
    if (req.query.to) q.dueDate.$lte = new Date(req.query.to);
  }
  return q;
}
export function pageOptions(req) {
  const parsedPage = Number.parseInt(req.query.page, 10) || 1;
  const page = Math.min(100000, Math.max(1, parsedPage));
  const parsedLimit = Number.parseInt(req.query.limit, 10) || 20;
  const limit = Math.min(100, Math.max(1, parsedLimit));
  const allowed = ['createdAt', 'updatedAt', 'dueDate', 'name', 'amount', 'orderNumber'];
  const field = allowed.includes(req.query.sort) ? req.query.sort : 'createdAt';
  const dir = req.query.order === 'asc' ? 1 : -1;
  return { page, limit, skip: (page - 1) * limit, sort: { [field]: dir } };
}
export function pagination(page, limit, total) {
  return { page, limit, total, pages: Math.ceil(total / limit) };
}
export function escapeRegex(s) {
  return String(s)
    .slice(0, 200)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
