import mongoose from 'mongoose';
import tenantPlugin from './tenantPlugin.js';
const schema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
  },
  { timestamps: true },
);
schema.index({ entity: 1, entityId: 1, createdAt: -1 });
schema.plugin(tenantPlugin);
export default mongoose.model('AuditLog', schema);
