# Deployment

## Recommended: Render + MongoDB Atlas

This project is a React/Vite SPA and an Express API with cookie authentication, tenant-specific shop domains, and Socket.IO. Deploy the frontend and API together in one Render web service so browser requests, cookies, and live updates stay on the same hostname. Use MongoDB Atlas for persistent data and Cloudinary for persistent customer/design images. Render's local filesystem is not a durable upload store.

The repository includes [`render.yaml`](../render.yaml), a Render Blueprint for this single-service deployment. It uses a paid Starter web service; select a different plan in Render if it suits your availability and budget. Atlas and Cloudinary may have separate costs.

### Deployment steps

1. **Prepare accounts and a domain.** Create a Render account, a MongoDB Atlas project/cluster, and (if uploads are needed) a Cloudinary account. A custom domain is recommended. The SaaS tenant setup needs a domain you control, such as `shops.example.com`, with wildcard DNS and TLS for `*.shops.example.com`, as well as the root domain for the marketing/platform UI. A single-shop setup can start with the Render-provided domain.
2. **Secure Atlas.** Create a database user with access only to the app database. Allow only the Render service's outbound IP addresses in Atlas Network Access (or use a static outbound IP option); do not leave the production database open to all IPs. Copy the TLS MongoDB connection string for the app database.
3. **Configure DNS and Render domains.** In Render, create a Blueprint deployment from this repository. For a custom single-shop domain, attach that domain to the web service. For SaaS onboarding, attach both the marketing/platform root domain and wildcard tenant domain, then add the DNS records Render specifies. Wait for DNS and HTTPS certificates to become active. A single shop can start with the Render-provided domain.
4. **Set the Blueprint environment values.** Set `MONGO_URI` to the Atlas connection string and `CLIENT_URL` to the exact HTTPS origin serving the app (for example, `https://shops.example.com` or the Render-provided domain). Render generates `JWT_SECRET`; keep the Blueprint's production, secure-cookie, and trusted-proxy settings. For SaaS onboarding, also set `PLATFORM_ROOT_DOMAIN` to the tenant root without a scheme (for example, `shops.example.com`) and `PLATFORM_ORIGINS` to any additional exact HTTPS origin(s), comma-separated. Do not put secrets in frontend/Vite variables or commit them.
5. **Deploy and check health.** Render installs the backend and frontend dependencies, builds `frontend/dist`, then starts the API, which serves the built SPA and API together. Wait for a successful deployment and confirm `https://<your-domain>/api/v1/health` returns a successful health response and the homepage loads over HTTPS.
6. **Install SaaS indexes if needed.** If using the SaaS application flow, run `npm --prefix backend run ensure:platform-indexes` once from the Render service shell against the production database. Investigate any duplicate-record error before proceeding; do not run the local-only tenant migration against Atlas.
7. **Create the first accounts deliberately.** For a single shop, use the private operator environment variables with `npm --prefix backend run provision:shop-admin`; set `PROVISION_SHOP_DOMAIN` to the domain attached to Render (or its Render-provided domain). For SaaS onboarding, provision a platform operator with `npm --prefix backend run provision:platform-admin`. Create the operator using a temporary password and remove it immediately afterward. Follow the existing [SaaS onboarding](./deployment.md#public-saas-onboarding-deployment) instructions to approve shops and deliver owner activation links securely. Never run the development `seed` script against production.
8. **Verify the full workflow.** Test sign-in/sign-out and page refresh (cookies), API calls, a live Socket.IO update, tenant/shop-domain resolution, an owner/customer workflow, and image upload if Cloudinary is configured. Confirm an unknown `/api/...` URL still returns an API not-found response rather than the SPA.
9. **Prepare operations before public launch.** Enable Atlas backups and test restoration, configure Render logs/alerts, and document secret rotation and incident response. The app does not include email/SMS delivery, online payment processing, or subscription billing.

## Prerequisites and environment

Use a supported Node.js release (20.19+ or 24 recommended) and a production MongoDB deployment with backups. Configure backend variables from `backend/.env.example`: `MONGO_URI`, a random `JWT_SECRET` of at least 32 characters, exact `CLIENT_URL` origins, `NODE_ENV=production`, secure cookie settings, and Cloudinary values if uploads are enabled. Set `TRUST_PROXY_HOPS` only to the actual trusted reverse-proxy chain length. The older `MONGODB_URI` and `CLIENT_ORIGIN` names remain accepted.

## Build and run

Install dependencies in `backend/` and `frontend/`; run `npm --prefix frontend run build` to produce `frontend/dist`. In production, the backend serves this build as well as `/api/v1` and Socket.IO from the same origin. Run it with `npm --prefix backend start` under a process manager or container. Configure HTTPS, WebSocket support or polling fallback, health checks, logs, and graceful shutdown. The backend intentionally fails to start in production if the frontend build is missing.

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
