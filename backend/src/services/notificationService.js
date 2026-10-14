import Notification from '../models/Notification.js';
import User from '../models/User.js';

function logNotificationFailure() {
  console.error('Notification delivery failed');
}

export async function notifyUser(recipient, title, message, type = 'INFO', link = '') {
  if (!recipient) return null;
  try {
    return await Notification.create({ recipient, title, message, type, link });
  } catch {
    logNotificationFailure();
    return null;
  }
}

export async function notifyRole(role, title, message, type = 'INFO', link = '', io) {
  try {
    const users = await User.find({ role, isActive: true }).select('_id');
    const rows = users.map((u) => ({ recipient: u._id, title, message, type, link }));
    const created = rows.length ? await Notification.insertMany(rows) : [];
    for (const n of created)
      io?.to(`tenant:${n.tenantId}:user:${n.recipient}`).emit('notification:new', {
        id: String(n._id),
        title: n.title,
        message: n.message,
        type: n.type,
      });
    return created;
  } catch {
    logNotificationFailure();
    return [];
  }
}

export function pushNotification(io, doc) {
  try {
    if (doc)
      io?.to(`tenant:${doc.tenantId}:user:${doc.recipient}`).emit('notification:new', {
        id: String(doc._id),
        title: doc.title,
        message: doc.message,
        type: doc.type,
      });
  } catch {
    logNotificationFailure();
  }
}
