# Database schema

Mongoose models live in `backend/src/models`; schemas use timestamps unless the record is intentionally a ledger/history type. User passwords are bcrypt hashes and excluded from ordinary reads. Unique indexes enforce account email and order number uniqueness.

| Model | Relationships and purpose |
|---|---|
| User | Login identity, role, active flag, contact details, last login. |
| Customer | Shop customer profile; optionally one-to-one with a customer User. |
| Tailor | Staff profile linked to a User; specialties, capacity, availability. |
| Measurement | Customer-owned profile with garment type, unit, numeric value map, custom values, and recorder. |
| Category / Service | Catalog grouping and service pricing/duration. Service references Category. |
| Order | Customer, optional tailor/measurement, item snapshots, status history, dates, totals, and payment summary. |
| Payment | Payment or refund ledger entry linked to order, customer, and recording staff member. |
| Appointment | Customer, optional order and tailor, date and status. |
| Notification | Recipient user, content, read timestamp. |
| AuditLog | Actor, action, entity reference, metadata, request IP. |
| ShopSettings | Shop-level settings singleton. |

Every business model includes a required `tenantId` reference to `Shop`. User email/phone, customer membership, tailor membership, categories, services, salary periods, settings, and order numbers are unique within a shop rather than across the platform. A tenant middleware resolves a registered hostname; query middleware applies the tenant predicate to all model queries and aggregates. Historical order and payment records remain scoped to their shop. The guarded `migrate:tenants` command assigns legacy single-shop records to `main` and replaces the previous global unique indexes.

The order document snapshots selected service/item prices. `totalAmount` is the sum of quantity times unit price; `finalAmount` applies discount and tax; `remainingAmount` floors final amount minus paid total at zero. Payment status is derived from payments and refunds rather than client input.
