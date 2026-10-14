# Database model notes

MongoDB collections are represented by Mongoose models in `backend/src/models`.

- **User** stores credentials, roles, phone, active state, and last sign-in. Password is excluded from normal projections and is hashed with bcrypt before persistence.
- **Customer** is the tailoring profile and optionally links one-to-one to a customer `User`. Orders and measurements reference this profile.
- **Tailor** links one-to-one to a `User` and stores specialties, availability, and capacity.
- **Measurement** belongs to a customer. Named profiles hold a garment type, unit, extensible map of numeric values, custom values, notes, and recorder.
- **Category** and **Service** describe shop offerings. Services reference a category and retain price/duration defaults.
- **Order** references customer, optional tailor and measurement; its item lines and status history are embedded snapshots. Amounts and payment status are recalculated on document validation/save. Optimistic concurrency protects simultaneous order edits and payment updates.
- **Payment** is an immutable ledger entry for a payment or refund; it references the order, customer, and staff member who recorded it.
- **Appointment** references customer and optionally order/tailor.
- **Notification** belongs to a user and tracks read time.
- **AuditLog** records actor, action, entity, metadata, and request IP.
- **ShopSettings** is a singleton document keyed `main` for shop defaults.
- **Shop** stores the tenant slug, display name, and registered hostnames. All other models include a required `tenantId` reference to this record.

Account identities and business uniqueness are scoped to a shop; customer profiles, catalog, orders, payments, appointments, payroll, notifications, audit records, and settings cannot be queried across shops through the API. The guarded local `migrate:tenants` command assigns prior single-shop records to `main` and swaps global unique indexes for tenant-aware indexes. Referential cleanup remains explicit: customers with active orders cannot be archived, and historical orders/payments remain intact.

## Extensible measurements
Common measurements are keyed by name in `Measurement.values`; the schema does not hard-code a garment-specific column set. Use `customMeasurements` for one-off fields. Preserve units on every profile and copy the selected profile ID onto an order so later profile edits do not silently alter past work.
