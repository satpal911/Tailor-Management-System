# Deployment

## Prerequisites and environment

Use a supported Node.js release (20.19+ or 24 recommended) and a production MongoDB deployment with backups. Configure backend variables from `backend/.env.example`: `MONGO_URI`, a random `JWT_SECRET` of at least 32 characters, exact `CLIENT_URL` origins, `NODE_ENV=production`, secure cookie settings, and Cloudinary values if uploads are enabled. Set `TRUST_PROXY_HOPS` only to the actual trusted reverse-proxy chain length. The older `MONGODB_URI` and `CLIENT_ORIGIN` names remain accepted.

## Build and run

Install dependencies in `backend/` and `frontend/`; run `npm --prefix frontend run build` to produce `frontend/dist`. Run the backend with `npm --prefix backend start` under a process manager or container. Serve the static frontend from a CDN/web server and route `/api/v1` and Socket.IO traffic to the API. Configure HTTPS, WebSocket support or polling fallback, health checks, logs, and graceful shutdown.

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

## Verification

Run `npm --prefix backend test` against a local MongoDB instance and `npm --prefix frontend run build` before release. The backend tests use a uniquely named local QA database for each run and leave it in place; they do not delete databases.
