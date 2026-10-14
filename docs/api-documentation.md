# API documentation

Base URL: `/api/v1`. JSON success responses use `{ success: true, data }`; errors use `{ success: false, message, errors? }`. Authentication uses the HTTP-only `tailor_token` cookie and a paired CSRF token for unsafe browser requests; browser clients send credentials. Health endpoint: `GET /api/v1/health`.

## Main resources

| Prefix | Purpose and access summary |
|---|---|
| `/auth` | Admin email/password login; customer phone/password registration and login; tailor phone/password registration and login; logout and current session. There is no public admin registration. |
| `/users` | Admin manages staff; authenticated user updates own profile at `/me`. |
| `/customers`, `/tailors` | Admin management; tailors see customers relevant to assigned work. |
| `/measurements` | Customer-owned measurements; admin and assigned tailors have scoped access. |
| `/categories`, `/services` | Authenticated reads; admin writes. |
| `/orders` | Customers create/read own orders; tailors read assigned orders; admin manages and assigns. |
| `/payments` | Role-scoped payment history; only admins can record confirmed offline receipts or refunds. This is a ledger, not an online checkout or money transfer. |
| `/appointments` | Customer-owned, tailor-assigned, admin-managed appointments. |
| `/notifications` | Current user's notifications and read state; `?unread=true` returns unread items and metadata includes the unread count. |
| `/dashboard`, `/settings` | Role-scoped summaries; settings are admin-only. |
| `/salaries` | Admin-managed salary records and payments; a tailor can read only their own salary history. |
| `/audit-logs` | Admin-only audit history. |

Order actions include status update, assignment, notes, and design images. Role checks and ownership checks are performed server-side. Collection endpoints accept pagination (`page`, `limit`, max 100), sorting, and resource-specific search/status/date filters. Uploads use multipart `images` fields (maximum five files); Cloudinary must be configured. Password sessions use HTTP-only JWT cookies and CSRF validation. Public customer signup refuses phone numbers already associated with shop records.

An owner can set a customer password through `POST /customers/:id/password` after verifying the customer in person. This action is audited and never returns password data. Customer self-registration does not associate an existing shop profile by phone alone.

For exact validators, route definitions, and transition/payment rules, see `backend/src/routes`, `backend/src/validators`, and [order-flow.md](order-flow.md). This document intentionally describes the API surface rather than duplicating every field schema.
