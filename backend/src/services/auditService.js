import AuditLog from '../models/AuditLog.js';
export async function audit(actor, action, entity, entityId, metadata = {}, ip = '') {
  try {
    await AuditLog.create({ actor, action, entity, entityId, metadata, ip });
  } catch {
    console.error('Audit write failed');
  }
}
