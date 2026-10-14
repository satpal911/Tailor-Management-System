# Tailor Management System

A MERN application for managing a tailoring shop's customers, measurements, orders, staff, appointments, payments, and notifications. It includes customer, tailor, and admin workspaces, with role and ownership checks enforced by the API.

## Features

- Cookie-based JWT authentication and role-aware workspaces.
- Customer profiles and reusable measurement records.
- Order creation, tailor assignment, status history, notes, and design references.
- Manual payment and refund ledger with balance validation.
- Service catalog, appointments, notifications, reporting, and shop settings.
- Search, filtering, sorting, pagination, audit records, and scoped Socket.IO events.
- Optional Cloudinary image uploads.

## Technology and architecture

- **Client:** React 19, Vite, React Router, Axios, React Hook Form, Tailwind CSS 4, Recharts, Lucide, Socket.IO client.
- **API:** Node.js 20.19+ (Node 24 recommended), Express 5, Mongoose, MongoDB, JWT, bcrypt, Multer, Cloudinary, Socket.IO.
- **Structure:** `frontend/` is the SPA; `backend/src/routes` maps `/api/v1` resources to validators and controllers; controllers use Mongoose models and services. Central middleware handles errors and API security headers/rate limits.

See [architecture](docs/architecture.md), [database schema](docs/database-schema.md), [API reference](docs/api-documentation.md), [order flow](docs/order-flow.md), and [deployment](docs/deployment.md).

## Install and configure

1. Install Node.js 20.19+ and run MongoDB locally, or create a MongoDB Atlas database.
2. Copy `backend/.env.example` to `backend/.env` and set `MONGO_URI` and a unique `JWT_SECRET` of at least 32 characters. The legacy names `MONGODB_URI` and `CLIENT_ORIGIN` are still accepted.
3. Install packages from the repository root:

   ```sh
   npm --prefix backend install
   npm --prefix frontend install
   ```

4. For a new development database, set `SEED_ADMIN_PASSWORD` and `SEED_TAILOR_PASSWORD` in `backend/.env` to distinct values of at least 12 characters, then run `npm run seed` from the repository root. This creates the `main` shop at `DEFAULT_SHOP_DOMAIN` (default `localhost`) and sample accounts. There is no public admin registration.
5. Start the API and client in separate terminals using the commands below.

## Environment variables

The full placeholder template is `backend/.env.example`. Required at API startup: `MONGO_URI` (or legacy `MONGODB_URI`) and a `JWT_SECRET` at least 32 characters long. `CLIENT_URL` (or legacy `CLIENT_ORIGIN`) is the comma-separated CORS allowlist. Cloudinary variables are optional unless uploads are needed. Never commit `.env` or real credentials.

## Run locally

From the repository root, in separate terminals:

```sh
npm run dev:backend
npm run dev:frontend
```

The API listens on `http://localhost:5000`; health check: `http://localhost:5000/api/v1/health`. The Vite app listens on `http://localhost:5174` and proxies `/api` to the API. `npm run build` creates the production frontend bundle in `frontend/dist`.

For the previous single-shop database, stop the API and run `npm run migrate:tenants` once from the repository root. It accepts only loopback MongoDB hosts, preflights uniqueness, assigns existing records to the `main` shop, and swaps known global unique indexes for tenant-scoped indexes without deleting records. Review a database backup before any operational migration; this command refuses production and remote database hosts.

## Multiple shops

The same app can host shops with isolated staff, customers, catalog, orders, payments, payroll, settings, and notifications. Each shop is resolved from its registered domain. Customers who use the same phone or email at different shops get separate accounts and profiles; passwords and records do not carry between shops. Existing customer accounts migrate only to the original `main` shop.

To add a shop and its owner, set `PROVISION_SHOP_NAME`, `PROVISION_SHOP_SLUG`, `PROVISION_SHOP_DOMAIN`, `PROVISION_ADMIN_NAME`, `PROVISION_ADMIN_EMAIL`, and `PROVISION_ADMIN_PASSWORD` in the operator's private `backend/.env` (optional `PROVISION_ADMIN_PHONE`), then run `npm run provision:shop-admin` from the repository root. Use a unique slug/domain and a unique password of at least 12 characters. To add another admin to an existing shop, reuse its slug/domain and provide a new admin email and password. Duplicate account identities are rejected by the shop-scoped indexes. The owner signs in at `https://<shop-domain>/admin/login`. Never configure this command's secrets in frontend variables or commit them.

For each domain, point DNS to the app deployment and configure TLS and the reverse proxy so the frontend and `/api/v1` use the same shop hostname and the original `Host`/`Origin` headers are preserved. Add the domain to the shop using `PROVISION_SHOP_DOMAIN` when rerunning the CLI for an ownerless shop. Custom DNS, TLS certificates, and hosting routes remain deployment setup; the app does not provision those services.

## Tests and checks

```sh
npm --prefix backend test
npm --prefix frontend run build
```

Backend workflow tests require a reachable **local** MongoDB URI. They use a uniquely named QA database for each run and explicitly refuse non-local database hosts. Test databases are left in place; remove them manually only after confirming the exact database name and contents.

Dependency security checks:

```sh
npm --prefix backend audit --audit-level=moderate
npm --prefix frontend audit --audit-level=moderate
```

## User roles and business workflows

- **Customer:** creates an account with a phone number and password, then maintains measurements, places and tracks orders, and views payment history. Existing shop records require in-person account setup before password access.
- **Tailor:** registers with phone/password and waits for admin approval; sees assigned work, customer measurements for assigned orders, and updates permitted order statuses.
- **Admin:** manages shop users, customers, services, assignments, order transitions, payments/refunds, and settings.

Customer, staff, and owner sign-in use password credentials. Passwords are bcrypt-hashed server-side; sessions use HTTP-only JWT cookies, CSRF protection, and role checks. Customer registration will not claim an existing shop customer phone record. Existing code-based customer accounts have no password; verify the customer in person, then use the owner-only **Set password** action on the customer list before enabling password sign-in. There is no public owner registration.

Orders progress from pending through confirmation, assignment, cutting, stitching, quality check, ready, delivery, and completion. The API validates transitions and records status history. Shop-entered payments cannot exceed the current balance; payment status derives from payment and refund ledger entries. See the detailed workflow docs for current rules.

## Cloudinary

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `backend/.env` to enable remote image uploads. Uploads are size/type checked before transfer. Without these values, upload endpoints return a service-unavailable response. Configure HTTPS and cookie settings for the production client origin; see [deployment](docs/deployment.md).
