# API overview

Base path: `/api/v1`. Shop requests must use a hostname registered to a `Shop`; this hostname selects the tenant before authentication. Success responses use `{ success: true, data }`; errors use `{ success: false, message, errors? }`. Browser sessions use the tenant-bound HTTP-only `tailor_token` cookie and a paired CSRF token for unsafe methods. Public shop identity: `GET /api/v1/shop`. Health check: `GET /api/v1/health`.

| Resource | Purpose and access |
|---|---|
| `/auth` | Admin email/password login; customer phone/password registration and login; tailor phone/password registration and login; logout and current session. |
| `/users` | Admin staff management and self profile updates. |
| `/customers`, `/tailors` | Admin management; tailors see customers connected to assigned work. |
| `/measurements` | Customer-owned measurements; admin and assigned tailors have scoped access. |
| `/categories`, `/services` | Authenticated reads; admin writes. |
| `/orders` | Customers manage their orders, tailors read assigned orders, admins manage and assign work. |
| `/payments` | Scoped payment history; admin shop-entered payment/refund operations. |
| `/appointments`, `/notifications` | Role-scoped scheduling and each user's notifications. |
| `/dashboard`, `/settings` | Role-scoped dashboards; admin settings and reports. |
| `/salaries`, `/audit-logs` | Admin-managed payroll with tailor self-view; admin-only audit history. |

Collections support pagination (`page`, `limit`, maximum 100) and resource-specific filters. Order transitions, ownership, and upload type/size checks are enforced by the API. Reference image uploads use multipart `images` fields and require Cloudinary configuration. Password sessions use HTTP-only JWT cookies with CSRF protection and server-side role checks.

An owner can set a customer password at `POST /customers/:id/password` after verifying the customer in person. The action is audited and never returns password data. Public signup refuses phone numbers already associated with shop records.
