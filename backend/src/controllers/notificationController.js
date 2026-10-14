import Notification from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
export const listNotifications = asyncHandler(async (req, res) => {
  const filter = { recipient: req.user._id };
  if (req.query.unread === 'true') filter.readAt = null;
  const [data, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(100),
    Notification.countDocuments({ recipient: req.user._id, readAt: null }),
  ]);
  res.json({ success: true, data, meta: { unreadCount } });
});
export const markRead = asyncHandler(async (req, res) => {
  const doc = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { readAt: new Date() },
    { new: true },
  );
  if (!doc) throw Object.assign(new Error('Notification not found'), { statusCode: 404 });
  res.json({ success: true, data: doc });
});
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ success: true, message: 'Notifications marked as read' });
});
