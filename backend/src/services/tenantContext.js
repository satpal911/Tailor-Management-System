import { AsyncLocalStorage } from 'node:async_hooks';

const tenantStorage = new AsyncLocalStorage();

export function runWithTenant(tenantId, callback) {
  return tenantStorage.run(tenantId ? String(tenantId) : null, callback);
}

export function currentTenantId() {
  return tenantStorage.getStore() || null;
}
