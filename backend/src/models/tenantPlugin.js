import { currentTenantId } from '../services/tenantContext.js';

const queryHooks = [
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'distinct',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne',
];

function removeTenantPaths(update) {
  if (!update || typeof update !== 'object' || Array.isArray(update)) return;
  for (const key of Object.keys(update)) {
    if (key === 'tenantId' || key.startsWith('tenantId.')) {
      delete update[key];
      continue;
    }
    if (key === '$rename' && update[key] && typeof update[key] === 'object') {
      for (const [path, destination] of Object.entries(update[key])) {
        if (String(destination).split('.')[0] === 'tenantId') delete update[key][path];
      }
    } else if (key.startsWith('$')) removeTenantPaths(update[key]);
  }
}

export default function tenantPlugin(schema) {
  schema.add({
    tenantId: {
      type: schema.base.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true,
      index: true,
    },
  });

  for (const operation of queryHooks) {
    schema.pre(operation, function scopeToTenant() {
      const tenantId = currentTenantId();
      if (tenantId) this.where({ tenantId });

      if (
        tenantId &&
        ['findOneAndReplace', 'replaceOne', 'findOneAndUpdate', 'updateOne', 'updateMany'].includes(
          operation,
        )
      ) {
        const update = this.getUpdate();
        if (Array.isArray(update)) throw new Error('Tenant fields cannot be modified');
        if (update) {
          if (['findOneAndReplace', 'replaceOne'].includes(operation)) {
            update.tenantId = tenantId;
            this.setUpdate(update);
            return;
          }
          removeTenantPaths(update);
          update.$set = { ...(update.$set || {}), tenantId };
          this.setUpdate(update);
        }
      }
    });
  }

  schema.pre('aggregate', function scopeAggregation() {
    const tenantId = currentTenantId();
    if (tenantId)
      this.pipeline().unshift({
        $match: { tenantId: new schema.base.Types.ObjectId(tenantId) },
      });
  });

  schema.pre('validate', function assignTenant() {
    const tenantId = currentTenantId();
    if (tenantId && this.isNew) this.tenantId = tenantId;
    else if (tenantId && String(this.tenantId) !== tenantId)
      this.invalidate('tenantId', 'A record cannot move between shops');
    if (!this.tenantId) this.invalidate('tenantId', 'A shop context is required');
  });

  schema.pre('insertMany', function assignManyTenants(next, documents) {
    const tenantId = currentTenantId();
    if (!tenantId) return next(new Error('A shop context is required'));
    for (const document of documents) document.tenantId = tenantId;
    next();
  });
}
