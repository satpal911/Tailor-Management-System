# Architecture

## Components

- `frontend/` is a React single-page application served by Vite in development. React Router separates public pages from authenticated, role-scoped workspaces. Axios sends the HTTP-only session cookie with API requests.
- `backend/src/server.js` validates startup configuration, connects Mongoose, creates the HTTP server, attaches Socket.IO, and handles graceful shutdown.
- `backend/src/app.js` configures Helmet, credentialed CORS, body limits, request logging, rate limits, `/api/v1` routes, and centralized 404/error handlers.
- Routers apply authentication, roles, and validation. Controllers implement request/response behavior; models hold persistence constraints; services handle uploads, notifications, and audit records.
- `Shop` stores each shop's slug and verified/registered hostnames. The tenant middleware resolves the hostname before auth and starts an async tenant context. Model query hooks scope reads, writes, deletes, counts, distincts, and aggregations; create/update hooks enforce the resolved tenant ID.

## Trust boundaries

The API is authoritative for tenant, roles, ownership, workflow transitions, and money calculations. The client hides unavailable controls for usability but is not a security boundary. JWTs are stored in host-only `tailor_token` HTTP-only cookies and include a tenant claim checked on every request. Socket.IO authenticates the cookie against the hostname tenant and uses tenant-qualified participant/admin rooms.

## Deployment shape

Serve each shop's frontend and `/api/v1` through the same HTTPS hostname behind a trusted reverse proxy. Preserve the original host and origin headers, configure DNS and TLS for each shop, set secure cookie settings, and set `TRUST_PROXY_HOPS` to match the actual proxy chain. New shop owners are created only by the operator CLI; no public admin registration exists. A previous single-shop install requires the guarded local migration before the upgraded app starts.
