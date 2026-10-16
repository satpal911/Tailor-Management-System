# Tailor Management System — Interview Guide

This guide is based on the current project source code and documentation. Use the English script as a starting point and the Hindi notes to explain ideas in your own words. Do not claim features marked as limitations are already implemented.

## Contents

1. [Quick project summary](#1-quick-project-summary)
2. [Opening pitch](#2-opening-pitch)
3. [Who uses the system](#3-who-uses-the-system)
4. [Architecture and request flow](#4-architecture-and-request-flow)
5. [Live demo plan](#5-live-demo-plan)
6. [Frontend walkthrough](#6-frontend-walkthrough)
7. [Backend and API walkthrough](#7-backend-and-api-walkthrough)
8. [Database and data relationships](#8-database-and-data-relationships)
9. [Authentication, security, and tenant isolation](#9-authentication-security-and-tenant-isolation)
10. [Orders, images, and payments](#10-orders-images-and-payments)
11. [SaaS enquiry and owner onboarding](#11-saas-enquiry-and-owner-onboarding)
12. [Technology glossary](#12-technology-glossary)
13. [Testing, deployment, and limitations](#13-testing-deployment-and-limitations)
14. [Interview questions and sample answers](#14-interview-questions-and-sample-answers)
15. [Presentation plans and final checklist](#15-presentation-plans-and-final-checklist)

## 1. Quick project summary

**Project:** Tailor Management System  
**Type:** Multi-tenant web application for tailoring shops, with a public SaaS enquiry and onboarding flow.  
**Client:** React 19 SPA served and built with Vite.  
**API:** Node.js and Express 5 REST API.  
**Database:** MongoDB accessed with Mongoose.  
**Main shop roles:** Admin, tailor, and customer.  
**Platform role:** A separate platform administrator who reviews prospective-shop enquiries.

The system helps a tailoring shop manage customers, measurements, garment orders, order progress, staff assignment, appointments, manual payment records, salaries, notifications, and reports. Each shop is resolved from its registered hostname, and its business records are scoped to that shop.

**Hindi summary:**  
“यह एक tailoring-shop management application है। इससे shop owner customers, measurements, orders, staff, appointments, payments और payroll को एक जगह manage कर सकता है। हर shop का data अलग tenant में रखा गया है, और customer तथा tailor को उनके role के अनुसार सीमित access मिलता है।”

### Feature status at a glance

| Area | Current status |
|---|---|
| Customer, tailor, and admin workspaces | Implemented |
| Password-based authentication | Implemented |
| OTP login | Not implemented in the inspected code |
| Shop-level tenant isolation | Implemented in API middleware and Mongoose model hooks |
| Orders, statuses, assignment, notes | Implemented |
| Reference-image uploads | Implemented with optional Cloudinary configuration |
| Payments and refunds | Manual ledger only; no online checkout |
| Salaries/payroll | Implemented as records and manual payout tracking |
| Appointments | Implemented |
| In-app notifications and Socket.IO events | Implemented |
| SaaS application/review/provisioning/owner activation | Implemented |
| Email/SMS delivery | Not configured |
| Subscription billing and renewals | Not implemented |
| Custom-domain DNS/TLS setup | Operator/deployment responsibility; not automatic |

## 2. Opening pitch

### English version

“I built a Tailor Management System for independent tailoring shops. It gives shop owners, tailors, and customers role-appropriate workspaces for managing customers, measurements, orders, appointments, staff, and payment records. The API is multi-tenant: it resolves the shop from the hostname and applies shop scoping to business data. I also implemented a public enquiry and operator-approved onboarding flow for shops interested in using the system.”

### Hindi/Hinglish version

“मैंने independent tailoring shops के लिए Tailor Management System बनाया है। इसमें owner, tailor और customer के लिए अलग-अलग workspaces हैं। Shop orders, measurements, customer records, appointments, staff और manual payment records manage कर सकती है। Backend hostname के आधार पर shop identify करता है और हर shop का data अलग रखता है। इसके साथ prospective shops के लिए enquiry और operator-approved onboarding flow भी है।”

### If asked why you built it

“A tailoring shop has connected workflows: customer measurements inform an order, an order needs a due date and a tailor, and payments and appointments need to stay connected to the customer’s work. This application brings those records into one system instead of handling each workflow separately.”

Avoid claiming that the codebase measures business impact or has production-scale customer usage unless you can independently demonstrate that.

## 3. Who uses the system

### Shop admin / owner

The shop admin manages customers, catalog, staff, orders, assignments, workflow status, payments/refunds, settings, reports, payroll, and audit history. Access is enforced in the backend as well as reflected in the UI.

### Tailor

Tailors register with phone and password. Registration creates a pending account and staff profile; the shop must approve access. Once active, a tailor can see assigned work and perform allowed order updates. Tailors do not receive unrestricted access to every customer or order.

### Customer

Customers can register with phone and password, view their shop-specific workspace, maintain measurements, create and follow orders, view payment history, and interact with permitted appointment/order features. Registration does not automatically claim an existing shop customer record; the shop can verify that customer and set up access.

### Platform administrator

This is separate from a shop admin. A platform admin reviews public applications and can update enquiry status/notes/payment tracking, explicitly approve provisioning, and issue a one-time owner activation link. Platform administration uses its own model, cookie, and authorization middleware.

**Useful distinction:** A shop admin administers one tailoring business. A platform admin operates the SaaS onboarding layer. They are not the same role.

## 4. Architecture and request flow

```text
Browser (shop hostname)
  ├─ React pages and components
  ├─ React Router: public and protected routes
  ├─ Axios: /api/v1, cookies, CSRF header
  └─ Socket.IO client for live workspace events
              │
              ▼
Express API
  Security headers → CORS → body/cookie parsing → CSRF → API rate limit
       ├─ Public application routes
       ├─ Platform-admin routes (separate auth)
       └─ Resolve shop from Origin/Host
            → tenant context
            → JWT/session auth
            → role and ownership checks
            → validation
            → controller/service
            → Mongoose model/query hooks
            → MongoDB
              │
              └─ JSON response and scoped Socket.IO events
```

### Example: creating an order

1. The user opens the order form in [Orders.jsx](../frontend/src/pages/Orders.jsx).
2. The page validates required inputs, collects optional image files, and builds `FormData`. Order line items are serialized as JSON in the multipart request; each image is appended under the `images` field.
3. The shared Axios client in [api.js](../frontend/src/services/api.js) sends same-origin API requests with credentials and adds a CSRF token to unsafe methods. For FormData it removes the JSON content type so the browser can set the multipart boundary.
4. Express resolves the shop, then the order router in [orderRoutes.js](../backend/src/routes/orderRoutes.js) authenticates the user, checks role, applies Multer, parses item JSON, and validates inputs.
5. [orderController.js](../backend/src/controllers/orderController.js) verifies customer/measurement/service ownership, calculates trusted prices as applicable, uploads images, saves the order, and records related audit/notification events.
6. [Order.js](../backend/src/models/Order.js) validates and derives amounts/status fields. The API returns the saved order; the UI navigates to its detail page.

### Main source landmarks

| Concern | Source |
|---|---|
| Frontend startup/provider tree | [main.jsx](../frontend/src/main.jsx) |
| Frontend routes and role groups | [routes/index.jsx](../frontend/src/routes/index.jsx) |
| Frontend API/CSRF behavior | [api.js](../frontend/src/services/api.js) |
| Express middleware and route order | [app.js](../backend/src/app.js) |
| API process/database/socket lifecycle | [server.js](../backend/src/server.js) |
| Tenant lookup | [tenantMiddleware.js](../backend/src/middleware/tenantMiddleware.js) |
| Tenant query hooks | [tenantPlugin.js](../backend/src/models/tenantPlugin.js) |
| Session and role checks | [authMiddleware.js](../backend/src/middleware/authMiddleware.js) |
| Shared API error responses | [errorMiddleware.js](../backend/src/middleware/errorMiddleware.js) |

## 5. Live demo plan

### Before sharing the screen

- Start MongoDB and the backend, then start the frontend. Repository commands are documented in [README.md](../README.md).
- Confirm the expected shop hostname resolves locally and that the API health endpoint responds.
- Use a prepared test shop and test accounts. Do not show passwords, cookies, JWTs, database credentials, or secret environment values.
- Use seeded or disposable demo records. Do not expose real customer personal data.
- Make sure Cloudinary is configured before promising that image uploads can be demonstrated. If it is not configured, explain that upload storage requires the provider settings.
- Have screenshots or source walkthroughs ready as a fallback.

### Recommended demonstration order

1. **Landing page** — show the product message, features, fictional sample dashboard card, plan descriptions, and FAQ. Point out that listed prices are confirmed in onboarding rather than charged online.
2. **Shop sign-in** — open the shop’s own hostname and sign in with the prepared test role. Avoid typing credentials where the screen recording is public.
3. **Dashboard** — show shop-level summary and role-appropriate navigation.
4. **Customer/measurement** — show a demo customer and their measurement profile. Explain that customer access and tailor access are scoped.
5. **Order workflow** — open an existing demo order, show status history and assignment. If prepared, create a disposable order with a supported image and show its detail page.
6. **Payment history** — show a manual payment record and remaining balance. Explicitly say the system records payments but does not transfer funds.
7. **Staff/payroll or appointments** — choose one based on interview time.
8. **Platform onboarding** — if a platform-admin test account is prepared, show `/platform/login` and the enquiry list. Do not approve a real applicant during an interview. Describe activation-link delivery as operator-managed.
9. **Source proof** — briefly open the order route/controller/model and tenant middleware to show how the feature is enforced.

### Safe fallbacks

- If the database or API is unavailable, use the pre-recorded screenshots and show the relevant code and tests.
- If Cloudinary is not configured, do not attempt an upload. Explain the configuration dependency and show the upload validation/controller flow.
- If a live account is unavailable, use the public landing page and then show the routes/controllers/tests rather than improvising credentials.
- If a protected page redirects to login, that is expected without a valid test session; explain the role guard and proceed with a prepared account.

## 6. Frontend walkthrough

### Entry point and providers

Open [main.jsx](../frontend/src/main.jsx). It mounts React and wraps the application with theme, router, shop branding, toast, and authentication providers. Global style sheets are also loaded there.

Say: “The providers make shared state and services available to pages without passing them through every component. For example, authentication is available through an auth context, and notifications through a toast context.”

### Routing and route protection

Open [routes/index.jsx](../frontend/src/routes/index.jsx). It lazy-loads pages and groups protected routes by roles. [ProtectedRoute.jsx](../frontend/src/components/ProtectedRoute.jsx) waits for session loading, redirects signed-out users to the relevant login, and redirects users who do not have the requested role.

Important: frontend route guards are for navigation and user experience. The backend is still responsible for security.

### API client and forms

Open [api.js](../frontend/src/services/api.js). It configures Axios with same-origin `/api/v1` and credentials. Its request interceptor attaches CSRF tokens to unsafe requests and removes a forced JSON content type for `FormData`. Several pages use React Hook Form for field state and validation; the order creation flow also manages a multi-step form and image previews directly.

### Shared UI and contexts

- [UI.jsx](../frontend/src/components/UI.jsx): shared buttons, password visibility, page headers, badges, loading/error/empty states, and other UI helpers.
- [AuthContext.jsx](../frontend/src/context/AuthContext.jsx): current user, sign-in/register actions, session refresh, and logout.
- [ShopContext.jsx](../frontend/src/context/ShopContext.jsx): retrieves public shop identity for branding.
- [ThemeContext.jsx](../frontend/src/context/ThemeContext.jsx): theme preference and theme switching.
- [ToastContext.jsx](../frontend/src/context/ToastContext.jsx): transient success/error messages.
- [AppLayout.jsx](../frontend/src/components/AppLayout.jsx): authenticated workspace shell and Socket.IO listener lifecycle.

### Useful pages to open

| Page | Purpose |
|---|---|
| [Dashboard.jsx](../frontend/src/pages/Dashboard.jsx) | Main admin dashboard |
| [Orders.jsx](../frontend/src/pages/Orders.jsx) | Order list and multi-step creation form |
| [OrderDetail.jsx](../frontend/src/pages/OrderDetail.jsx) | Order status, assignment, notes, and related details |
| [Measurements.jsx](../frontend/src/pages/Measurements.jsx) | Measurement records |
| [Payments.jsx](../frontend/src/pages/Payments.jsx) | Payment records |
| [Payroll.jsx](../frontend/src/pages/Payroll.jsx) | Salary management/self view |
| [Appointments.jsx](../frontend/src/pages/Appointments.jsx) | Appointment workflow |
| [Reports.jsx](../frontend/src/pages/Reports.jsx) | Reports |
| [Landing.jsx](../frontend/src/pages/Landing.jsx) | Public SaaS marketing page |
| [ApplyShop.jsx](../frontend/src/pages/ApplyShop.jsx) | Public shop enquiry form |
| [PlatformApplications.jsx](../frontend/src/pages/PlatformApplications.jsx) | Operator enquiry management |
| [ActivateOwner.jsx](../frontend/src/pages/ActivateOwner.jsx) | Owner password activation |

## 7. Backend and API walkthrough

### Server and app setup

Open [server.js](../backend/src/server.js): environment validation, database connection, HTTP server, Socket.IO setup, and graceful shutdown. Then open [app.js](../backend/src/app.js): security middleware, CORS, body parsing, CSRF, rate limiting, public/platform route placement, tenant resolution, business routes, and centralized error handlers.

Public application and platform routes are mounted **before** tenant resolution because the platform is not a shop tenant. Shop-specific business endpoints are mounted after tenant resolution.

### Routes, controllers, and middleware

- **Routes** describe endpoints and attach authentication, role requirements, validation, and upload middleware.
- **Controllers** implement request handling and business rules.
- **Middleware** provides cross-cutting checks such as tenant lookup, authentication, CSRF, validation, and upload parsing.
- **Services** handle reusable operations such as Cloudinary upload, audit logging, and notifications.
- **Models** define persisted data shape, indexes, hooks, and tenant scoping.

Examples: [orderRoutes.js](../backend/src/routes/orderRoutes.js) delegates order requests to [orderController.js](../backend/src/controllers/orderController.js); [paymentRoutes.js](../backend/src/routes/paymentRoutes.js) delegates payment operations to [paymentController.js](../backend/src/controllers/paymentController.js).

### Validation and errors

Routes use `express-validator` and the shared [validate.js](../backend/src/middleware/validate.js) helper. Mongoose validation and application-specific checks provide additional safeguards. [errorMiddleware.js](../backend/src/middleware/errorMiddleware.js) maps common failures—validation, invalid IDs, duplicate keys, JWT failures, and Multer failures—to HTTP responses.

Success responses generally use `{ success: true, data }`; failures use `{ success: false, message }` with validation details where appropriate.

## 8. Database and data relationships

MongoDB documents are described by Mongoose models in [backend/src/models/](../backend/src/models). ObjectId references connect related records; business models include a tenant ID.

| Model | Purpose and relationships |
|---|---|
| `Shop` | Shop name, slug, registered domains, active status, provisioning link |
| `User` | Login identity, role, contact information, account status, password hash |
| `Customer` | Shop customer profile; may link to a customer `User` |
| `Tailor` | Staff/tailor profile linked to a `User` |
| `Measurement` | Customer-owned measurement profile and garment details |
| `Category`, `Service` | Service catalog and category relationship |
| `Order` | Customer, optional tailor/measurement, item snapshots, amounts, images, notes, status history |
| `Payment` | Payment/refund ledger entry linked to order, customer, and recording staff |
| `Appointment` | Customer appointment, optional order/tailor, date, and status |
| `Salary` | Employee salary period, adjustments, and payment history |
| `Notification` | User-recipient in-app notification |
| `AuditLog` | Actor, action, entity reference, and metadata |
| `ShopSettings` | Tenant-specific shop configuration |
| `ShopApplication` | Platform-level prospective-shop enquiry and onboarding state |
| `PlatformAdmin` | Separate platform operator account |

Unique indexes enforce selected constraints, including tenant-specific user identities, order numbers, settings, salary periods, shop slugs/domains, and provisioning relationships. See [database-schema.md](../docs/database-schema.md) for a fuller schema summary.

Explain it simply: “MongoDB stores each business record as a document. Mongoose defines which fields are required, how documents reference one another, and which combinations must be unique. The tenant ID makes each shop’s business records belong to that shop.”

## 9. Authentication, security, and tenant isolation

### Shop authentication

Passwords are hashed with `bcryptjs`. Login creates a JWT containing user identity, role, and tenant ID. The JWT is set in the HTTP-only `tailor_token` cookie; the response also issues a CSRF token cookie. The browser sends the CSRF value in a header for state-changing requests. See [authController.js](../backend/src/controllers/authController.js), [authMiddleware.js](../backend/src/middleware/authMiddleware.js), and [csrfMiddleware.js](../backend/src/middleware/csrfMiddleware.js).

Authentication answers “Who are you?” Authorization answers “What are you allowed to do?” In this project, a valid user session does not automatically allow every operation: route/controller role checks and ownership checks still apply.

### Tenant isolation

1. The request hostname is resolved to an active `Shop`.
2. The authenticated JWT tenant claim must match that shop.
3. The tenant model plugin adds the current tenant to supported queries and writes.
4. Controllers check relationships such as customer-to-order, tailor-to-assignment, and measurement-to-customer.
5. Socket.IO authenticates the cookie against the hostname shop and uses tenant-qualified rooms.

This is defense in depth: a frontend route being hidden is not considered sufficient protection.

### Platform authentication

Platform admins live in a separate `PlatformAdmin` collection and use `platform_token` plus a platform JWT audience/scope check in [platformAdminMiddleware.js](../backend/src/middleware/platformAdminMiddleware.js). They are not shop admins and do not get ordinary shop access merely by being platform operators.

### Security measures that are visible in code

- Helmet security headers and credentialed, allowlisted CORS.
- HTTP-only authentication cookies and CSRF protection for unsafe methods.
- Password hashing and role/account-status checks.
- Tenant and ownership scoping at API/model layers.
- Request-body limits and rate limits on sensitive/public operations.
- Input validation, upload size/MIME checks, and image signature verification.
- Safe public DTOs for shop users and platform operators.

Do not describe this as a formal security certification or claim protections that are not present.

## 10. Orders, images, and payments

### Order workflow

The transition map in [orderStatuses.js](../backend/src/constants/orderStatuses.js) is the authority for permitted status changes. The model stores order items and price snapshots, due date, customer, optional tailor/measurement, image references, notes, and status history.

The server calculates totals and derives payment status in [Order.js](../backend/src/models/Order.js). It does not rely on a customer-supplied total as the authoritative price. Admins can assign active tailors; the backend checks tailor status/capacity and records history.

### Image uploads

- The frontend accepts JPEG, PNG, and WebP, shows previews, and limits selection to five images with a 5 MB per-image UI limit.
- Multer uses in-memory storage and accepts the `images` field, up to five files, subject to the configured server-side size limit.
- The upload service checks file signatures and uploads to Cloudinary when all Cloudinary settings are present.
- If Cloudinary is unconfigured, upload attempts return a service-unavailable error; without images, order creation does not need Cloudinary.
- When the order save fails after image upload, the controller attempts to delete the uploaded assets.

Source: [upload.js](../backend/src/middleware/upload.js), [uploadService.js](../backend/src/services/uploadService.js), [cloudinary.js](../backend/src/config/cloudinary.js), [orderRoutes.js](../backend/src/routes/orderRoutes.js), and [orderController.js](../backend/src/controllers/orderController.js).

### Payments

The payment collection is a shop-entered payment/refund ledger. The controller checks that amounts are positive and do not exceed the order balance, updates order totals, and rolls back the order amount if creating the ledger record fails. Refunds are separate ledger records.

Say clearly: “This is payment tracking, not payment processing. The application does not charge a card, call a payment gateway, or verify provider webhooks.”

## 11. SaaS enquiry and owner onboarding

1. A prospect visits the public marketing page and submits `/apply`.
2. The API validates and rate-limits the enquiry, uses a honeypot field, and prevents a duplicate active enquiry for the same normalized owner/shop combination.
3. The enquiry remains a platform-level record. It does not create an active shop from anonymous submission.
4. A platform operator signs in and can search applications, update enquiry status/notes, and track manual payment status.
5. Explicit approval provisions a shop and a pending owner without a password. Provisioning records links to support safe retry/recovery.
6. The operator gets a one-time, expiring activation URL. Only the hash is stored. The owner chooses a password through `/activate`.
7. The owner can then sign in to the provisioned shop hostname.

Key sources: [ShopApplication.js](../backend/src/models/ShopApplication.js), [platformController.js](../backend/src/controllers/platformController.js), [publicRoutes.js](../backend/src/routes/publicRoutes.js), [platformRoutes.js](../backend/src/routes/platformRoutes.js), [provisionPlatformAdmin.js](../backend/src/seeders/provisionPlatformAdmin.js), and [ensurePlatformIndexes.js](../backend/src/seeders/ensurePlatformIndexes.js).

Not included: automatic activation email/SMS, online payment, subscription renewals, automated DNS/TLS provisioning, or verified custom-domain attachment.

## 12. Technology glossary

| Technology | What it does here | A reasonable alternative |
|---|---|---|
| React 19 | Builds interactive pages from components and state | Vue, Angular |
| React DOM | Mounts the React application in the browser | Framework-specific renderer |
| Vite | Local dev server, module bundling, and production build | Webpack, another build tool |
| React Router | Maps URLs to public and protected SPA pages | TanStack Router |
| Tailwind CSS 4 | Utility-first styling, integrated through Vite; project CSS also provides shared styling | CSS Modules, another utility/design system |
| Axios | HTTP client with credentials, interceptors, and CSRF handling | Fetch API |
| React Hook Form | Form state/validation used on several forms | Controlled React forms, Formik |
| Recharts | Dashboard/report charts | Chart.js, D3 |
| Lucide | Icon components | Material icons, another icon package |
| Socket.IO client/server | Authenticated live event channel for workspace updates | Native WebSocket |
| Node.js | JavaScript runtime for the API | Another server runtime |
| Express 5 | HTTP app, middleware, and route composition | Fastify, NestJS |
| MongoDB | Document database for shop and platform records | PostgreSQL or another database |
| Mongoose | MongoDB schemas, indexes, validation, references, and middleware | Native MongoDB driver |
| bcryptjs | Password hashing and verification | Argon2 or another password-hashing library |
| jsonwebtoken | Signs/verifies session JWTs | Opaque server-side sessions |
| Multer | Parses multipart file uploads into memory | Busboy-based/custom upload handling |
| Cloudinary | Optional external image storage | S3-compatible object storage |
| Helmet | HTTP security headers | Explicit header configuration |
| CORS | Controls browser origins allowed to call the API | Same-origin-only deployment |
| express-validator | Validates and normalizes route input | Zod/Joi or custom schemas |
| express-rate-limit | Limits selected request types | Gateway/shared distributed limiter |
| Node test runner | Runs backend workflow tests | Jest, Vitest, Mocha |
| Prettier | Checks/normalizes source formatting | Another formatter |

External services/configuration: MongoDB is required for the API; Cloudinary is optional for image uploads. There is no configured mail/SMS provider or payment gateway.

## 13. Testing, deployment, and limitations

### Tests

The backend test command is `npm --prefix backend test`. The main workflow suite in [business-workflows.test.js](../backend/test/business-workflows.test.js) exercises authentication, CSRF/RBAC, customer separation, tenant host isolation, onboarding/provisioning/activation, measurements, orders, payment ownership, reports, appointments, payroll, profile/password updates, notifications, and upload/security cases.

The most recently verified result for the current project changes was **20 backend tests passed, 0 failed**. The frontend production command `npm --prefix frontend run build` also passed. These checks prove code paths under the test environment; they are not a substitute for a production end-to-end test against real external providers.

### Local run

From the repository root, start separate terminals:

```powershell
npm run dev:backend
npm run dev:frontend
```

The README documents the local API health path (`/api/v1/health`) and frontend port. For shop-specific local testing, use that shop’s registered `.localhost` hostname, not just a generic localhost hostname.

### Production outline

Build the frontend and run the backend with production environment configuration. Configure MongoDB, strong JWT secret, HTTPS and secure cookie settings, exact client/platform origins, trusted proxy hops, registered shop domains, DNS/TLS/reverse proxy, and any required Cloudinary credentials. Run the platform index setup before production use if deploying SaaS onboarding. The deployment checklist is in [deployment.md](../docs/deployment.md).

### Limitations to state confidently

- Authentication is password-based; OTP is not implemented.
- Payment and salary disbursements are recorded manually; there is no gateway.
- No subscription billing/renewal system is implemented.
- No automatic email or SMS sending is configured.
- Custom-domain DNS and certificates are not provisioned by this application.
- Image upload storage requires Cloudinary configuration; an absent provider is surfaced as a service-unavailable condition.
- The frontend package does not define a dedicated test/lint script; its production build is the available scripted validation.
- The backend workflow tests use a local MongoDB database and create uniquely named QA databases; they are not intended to target remote production databases.

## 14. Interview questions and sample answers

### Beginner level

**Q: What is MERN?**  
**A:** “It refers to MongoDB, Express, React, and Node.js. In this project, React is the browser UI, Express and Node.js provide the API, and MongoDB stores data through Mongoose.”

**Q: What happens when I submit a form?**  
**A:** “The React page validates the input, Axios sends an HTTP request, Express runs middleware and route validation, a controller applies the business rules, Mongoose reads or writes MongoDB, and the API returns a response for the page to display.”

**Q: What is authentication versus authorization?**  
**A:** “Authentication verifies who the user is. Authorization checks what that user can do. The API verifies the session first, then checks roles and ownership before sensitive operations.”

### Intermediate level

**Q: How do you stop one shop from seeing another shop’s records?**  
**A:** “The API resolves the shop from the hostname before shop routes run. The JWT tenant claim must match that shop, and the Mongoose tenant plugin scopes normal queries and writes. Controllers also verify record relationships.”

**Q: How are order totals calculated?**  
**A:** “The server uses validated order items and catalog pricing where applicable. The Order model derives subtotal, final amount, remaining balance, and payment status; the client does not get to set the authoritative total.”

**Q: How are files uploaded?**  
**A:** “The browser sends multipart FormData under the `images` field. Multer applies count and size limits, the upload service verifies file signatures, and Cloudinary stores files when configured. The order stores URL/public ID references, and a failed save triggers cleanup attempts.”

**Q: How do you handle permissions in the frontend?**  
**A:** “React Router groups pages behind a route guard for usability. The backend remains the security boundary: middleware and controllers check role, tenant, and ownership.”

### Advanced level

**Q: Why use both tenant middleware and a Mongoose plugin?**  
**A:** “Middleware establishes the tenant context from a trusted hostname; the model plugin makes that context apply consistently to database operations. Controllers still validate cross-document ownership. This layered approach reduces the risk that one missing UI check exposes another tenant’s data.”

**Q: Are payment updates fully transactional?**  
**A:** “The controller updates the order and creates the payment ledger record with compensating rollback if the second write fails. That protects many failure cases, but it is not a MongoDB multi-document transaction. With a replica set and appropriate operational requirements, I would consider wrapping related writes in a transaction.”

**Q: What would you change before larger-scale production?**  
**A:** “I would add end-to-end frontend tests, production monitoring, distributed rate-limit storage where multiple API instances run, automated email/SMS onboarding, and a real subscription/payment provider if the business requires it. I would also test recovery paths and deployment DNS/TLS with production-like infrastructure.”

**Q: What does the application do if Cloudinary is not configured?**  
**A:** “Non-image workflows can still work. An image upload request receives an explicit service-unavailable response explaining that image storage needs configuration; the system does not pretend the image was saved.”

**Q: Is OTP login implemented?**  
**A:** “No. The current login flows use passwords. OTP would require a delivery provider, verification lifecycle, expiry and replay controls, and rate limiting; I would describe that as future work, not as an existing feature.”

**Q: How would you debug a failed API request?**  
**A:** “I would inspect the browser network request and response first, verify the hostname and request payload, then trace the route middleware, validation, controller, model query, and server logs. For authenticated writes, I would also check the cookie and CSRF pair without exposing either value.”

## 15. Presentation plans and final checklist

### 5-minute version

1. 30 seconds — elevator pitch and business problem.
2. 90 seconds — show a prepared shop dashboard, customer/measurement, and order detail.
3. 60 seconds — explain hostname-based tenant resolution and role checks.
4. 60 seconds — show order creation/upload flow or source code if provider configuration is unavailable.
5. 60 seconds — explain manual payments, SaaS enquiry/approval, and owner activation.
6. 40 seconds — state test/build status and honest limitations.

### 15-minute version

1. Opening and users (2 min).
2. Live dashboard and order/customer workflow (4 min).
3. Measurements, payment history, appointments or payroll (2 min).
4. Request flow and folder structure (2 min).
5. Authentication/tenant isolation and image upload (3 min).
6. SaaS onboarding, testing, and limitations (2 min).

### 30-minute version

1. Business problem and roles (3 min).
2. Guided demo: dashboard, customer, measurements, order creation, status flow, payment ledger (8 min).
3. Frontend architecture, router, API client, form state (4 min).
4. Backend middleware/routes/controllers/models (5 min).
5. Auth, CSRF, tenant isolation, uploads (5 min).
6. SaaS onboarding and platform-admin boundary (2 min).
7. Tests, deployment, trade-offs, and next improvements (3 min).

### Prepare these tabs and files

- Browser: public home, a prepared shop dashboard, customer/measurement, order detail, payment history, and (if available) platform application review.
- VS Code: [main.jsx](../frontend/src/main.jsx), [routes/index.jsx](../frontend/src/routes/index.jsx), [api.js](../frontend/src/services/api.js), [app.js](../backend/src/app.js), [authMiddleware.js](../backend/src/middleware/authMiddleware.js), [tenantMiddleware.js](../backend/src/middleware/tenantMiddleware.js), [orderController.js](../backend/src/controllers/orderController.js), [Order.js](../backend/src/models/Order.js), [uploadService.js](../backend/src/services/uploadService.js), [business-workflows.test.js](../backend/test/business-workflows.test.js).
- Terminal: prepared development commands and test command; avoid displaying environment files.

### Final revision card

- **Frontend:** React pages → React Router → Axios.
- **Backend:** Express middleware → route validation/auth → controller → Mongoose → MongoDB.
- **Authentication:** password → bcrypt compare/hash → JWT in HTTP-only cookie → CSRF on unsafe requests.
- **Tenant isolation:** request host → Shop → tenant context → scoped model query → role/ownership checks.
- **Orders:** server validation/pricing → status history → optional Cloudinary references → notifications.
- **Payments:** manual ledger and balance validation, not online checkout.
- **SaaS:** enquiry → operator review → explicit approval → pending owner → one-time activation link.
- **Honesty:** OTP, online payments, subscriptions, and automated email/SMS are not implemented/configured.

### Closing statement

“This project helped me connect frontend workflows to backend business rules and database design. The most important architectural part is that access is not based only on what the UI shows: the API checks the user’s role, the shop tenant, and ownership of related records. I also understand which integrations are real and which still need configuration or implementation.”

**Hindi closing:**  
“इस project में मैंने frontend और backend को business workflows के साथ जोड़ना सीखा। खास बात यह है कि security सिर्फ UI पर निर्भर नहीं करती—API role, shop tenant और record ownership भी verify करती है। मैं implemented features और future integrations के बीच का फर्क भी स्पष्ट रूप से बता सकता हूँ।”

### Mock interview practice

Practice aloud, one question at a time. Start with: **“Can you explain how a request from the React order form reaches MongoDB and returns to the user?”** Answer in your own words, then compare your explanation with Sections 4 and 10.
