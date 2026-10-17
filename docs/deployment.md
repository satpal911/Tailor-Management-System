# Deployment

## Prerequisites and environment

Use a supported Node.js release (20.19+ or 24 recommended) and a production MongoDB deployment with backups. Configure backend variables from `backend/.env.example`: `MONGO_URI`, a random `JWT_SECRET` of at least 32 characters, exact `CLIENT_URL` origins, `NODE_ENV=production`, secure cookie settings, and Cloudinary values if uploads are enabled. Set `TRUST_PROXY_HOPS` only to the actual trusted reverse-proxy chain length. The older `MONGODB_URI` and `CLIENT_ORIGIN` names remain accepted.

## Build and run

Install dependencies in `backend/` and `frontend/`; run `npm --prefix frontend run build` to produce `frontend/dist`. Run the backend with `npm --prefix backend start` under a process manager or container. Serve the static frontend from a CDN/web server and route `/api/v1` and Socket.IO traffic to the API. Configure HTTPS, WebSocket support or polling fallback, health checks, logs, and graceful shutdown.

For the Render Blueprint deployment, Render supplies `RENDER_EXTERNAL_URL` and `RENDER_EXTERNAL_HOSTNAME`. The app uses these as the allowed origin and resolves the exact Render-assigned hostname to `DEFAULT_SHOP_SLUG` (default `main`) when that host is not explicitly registered on the shop. Localhost continues to resolve to the same default shop. Set the Render service's `MONGO_URI` to the same Atlas database used by local development if both environments should share accounts and data. Other unregistered hosts remain rejected; register custom shop domains on their shop records.

## Production operations

- Keep `.env` and credentials out of Git and logs; rotate secrets through the hosting provider.
- Use least-privilege MongoDB credentials, TLS, backups, and a tested restore plan.
- Use a strict CORS origin list and secure, HTTP-only cookies. Configure a CSRF strategy if cross-site cookie deployment is needed.
- Configure Cloudinary upload limits and review retention/privacy requirements for customer images and measurements.
- Add monitoring, alerting, email/SMS delivery, and a formal data-retention process before a public launch.
- The payment ledger records shop-entered payments and refunds; it does not charge cards or verify payment-provider webhooks.
- Shops are tenant-scoped in the API. Use `npm run migrate:tenants` only for a backed-up local loopback database when upgrading a prior single-shop install. The migration refuses production or remote MongoDB targets.
- Each tenant must have at least one registered domain in its `Shop` record. DNS, TLS, and reverse proxy configuration must send the original shop hostname to the same-origin frontend/API deployment. Do not serve all shops behind a single unscoped API hostname.
- Create each shop and first owner from the operator environment with `npm run provision:shop-admin`; there is no public owner registration endpoint.
- The public SaaS application flow uses a separate `PlatformAdmin` identity and `/platform/*` API. It is not a tenant admin role and is never created through public registration.

## Public SaaS onboarding deployment

1. Set `PLATFORM_ORIGINS` to the exact comma-separated origin(s) of the marketing and platform-operator frontend, including `https://` and any non-default port. Do not use `*` with credentialed requests. Keep `CLIENT_URL` configured for any existing tenant UI origins.
2. Set `PLATFORM_ROOT_DOMAIN` to the production tenant subdomain root, such as `shops.example.com`. Before approving applications, configure wildcard DNS for `*.shops.example.com`, HTTPS certificates, and reverse-proxy/frontend hosting that preserves the shop hostname and forwards `/api/v1` and Socket.IO traffic to the API. Provisioning will fail safely in production if this variable is absent.
3. Deploy the backend/frontend code and run `npm --prefix backend run ensure:platform-indexes` once against the target database. This creates indexes for active duplicate applications, shop slugs/domains, and application-to-shop/owner provisioning links. Resolve any existing duplicate records before creating unique indexes.
4. Create the platform operator through a private deployment shell: temporarily set `PLATFORM_ADMIN_NAME`, `PLATFORM_ADMIN_EMAIL`, and a unique `PLATFORM_ADMIN_PASSWORD` of at least 16 characters, then run `npm --prefix backend run provision:platform-admin`. Remove the password from the shell/environment after use. This command only creates credentials in the separate platform-admin collection.
5. Verify `/` and `/apply` from the configured marketing origin, then sign in at `/platform/login`. A submitted application remains an enquiry until an operator approves it. Approval creates a tenant and inactive owner without a password and returns a one-time, 48-hour activation URL. Deliver that link to the verified owner using an approved secure channel; no email/SMS delivery is included. If delivery fails, generate a replacement from the application review screen.
6. The owner uses the activation link to set a password and activate their account, then signs in at the new shop subdomain. Confirm the tenant branding/login and private-data isolation before handoff.

Local development uses `<generated-slug>.localhost:5174` and does not require `PLATFORM_ROOT_DOMAIN`. The application records a custom-domain preference but does not attach or validate custom domains; verify ownership and configure DNS, TLS, and reverse-proxy routing before adding a domain to a shop. Payment status is operator-managed only. No subscription billing, payment gateway, email, or SMS provider is integrated.

## Verification

Run `npm --prefix backend test` against a local MongoDB instance and `npm --prefix frontend run build` before release. The backend tests use a uniquely named local QA database for each run and leave it in place; they do not delete databases.
