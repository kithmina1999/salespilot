# Security Audit - OWASP Top 10

Date: 2026-06-19

This is a code and deployment review, not a formal penetration test.

## Standards Used

- OWASP Top 10:2025: https://owasp.org/Top10/2025/
- OWASP API Security Top 10:2023: https://owasp.org/API-Security/editions/2023/en/0x11-t10/

SalesPilot is API-heavy, so the API Top 10 is used alongside the web Top 10.

## Scope

Reviewed:

- Go backend routes, auth middleware, tenant scoping, upload handling, payment webhook, outbound API calls
- Next.js frontend and admin auth storage patterns
- Production Docker Compose, Dockerfiles, Nginx security headers, deployment docs
- Backup, log aggregation, incident response, load-test readiness docs from the current production-readiness work

Not completed in this environment:

- Dynamic scanning with OWASP ZAP
- Authenticated browser session testing against a running production-like stack

## Executive Status

Current status: acceptable for private staging after the fixes in this pass.

Do not launch with real customer data until these high-priority items are closed:

- Confirm dependency vulnerability scans pass in CI.
- Validate Nginx `limit_req` behavior on staging after installing the API proxy snippet.

## Fixes Applied In This Pass

| Area | OWASP mapping | Change |
| --- | --- | --- |
| Super-admin data exposure | A01 Broken Access Control, API3 Object Property Authorization | System business responses now strip `api_key` and `wa_access_token`, exposing only boolean presence flags. |
| Upload handling | A02 Security Misconfiguration, A10 Exceptional Conditions, API4 Resource Consumption | Payment proof uploads now use magic-byte image validation, server-generated filenames, private file permissions, and copy-time size enforcement. |
| HTTP server resilience | A10 Exceptional Conditions, API4 Resource Consumption | Backend server now has read header, read, write, idle, and header-size limits. |
| JWT validation | A07 Authentication Failures | JWT validation now explicitly accepts only HS256. |
| Tenant dashboard auth | A07 Authentication Failures | Tenant JWTs are now issued as backend-set `HttpOnly; SameSite=Lax` cookies, with frontend credentialed requests and `/api/v1/auth/session` hydration. |
| Private receipt access | A02 Security Misconfiguration, API3 Object Property Authorization | Receipt uploads now live outside the public static tree. API responses return authorized receipt endpoints, tenant order receipts are scoped by `business_id`, and super-admin receipts are fetched through authenticated backend proxy/streaming handlers. |
| Brute-force pressure | A07 Authentication Failures, API4 Resource Consumption | Rate limiting now uses the shared StateStore, so production deployments use Redis-backed counters. Auth routes apply both IP and request-identifier limits, and Nginx applies edge `limit_req` controls for auth, uploads, webhooks, and general API traffic. |
| Browser content isolation | A02 Security Misconfiguration | Nginx now enforces a CSP for production HTTPS responses, including `frame-ancestors 'none'`, `object-src 'none'`, Cloudinary image/media sources, Sentry ingest connections, Google Fonts for admin, and PayHere form/frame destinations. |
| Dependency scanning | A03 Software Supply Chain Failures | GitHub Actions now runs `govulncheck ./...` for the Go backend and `npm audit --omit=dev --audit-level=high` for frontend, admin, and landing production dependencies on PRs, pushes to `main`, and manual dispatch. |
| Container runtime hardening | A02 Security Misconfiguration | Production Compose now applies `no-new-privileges`, capability drops, memory/CPU/pid limits, and read-only root filesystems for app containers. Explicit writable volumes/tmpfs preserve backend uploads, private receipts, WhatsApp session data, and Next.js runtime cache paths. |
| Database migration control | A08 Software/Data Integrity Failures | Production backend startup now runs with `DB_AUTO_MIGRATE=false` and refuses to boot when versioned migrations are pending. Deploys run the `migrate` Compose service, which executes `salespilot-migrate up` before app services start. |
| Payment webhook comparison | A04 Cryptographic Failures | PayHere signature comparison now uses constant-time comparison. |

## Open Findings

| ID | Severity | Status | OWASP mapping | Evidence | Required fix |
| --- | --- | --- | --- | --- | --- |
| SA-001 | High | Fixed | A04 Cryptographic Failures, API3 Object Property Authorization | Tenant Meta/WhatsApp access tokens are stored as envelope-encrypted `spenc:v1` payloads in `wa_access_token`. Startup backfill encrypts legacy plaintext rows, and Meta send/test paths decrypt just-in-time. | Keep `PROVIDER_TOKEN_ENCRYPTION_KEYS` in the production secret store and follow the DR rotation procedure before removing old key IDs. |
| SA-002 | High | Fixed | A07 Authentication Failures | Tenant login and email verification set a backend-owned HttpOnly `token` cookie; frontend fetches send credentials and no longer read/store bearer JWTs. `AuthRequired` accepts the cookie and rejects unsafe cookie-auth requests from unapproved browser origins. | Keep tenant JWTs out of browser-readable storage; use `/api/v1/auth/logout` to clear the HttpOnly cookie. |
| SA-003 | Medium | Fixed | A07 Authentication Failures, API2 Broken Authentication | `AuthRequired`, `TenantAuth`, and `MasterAuth` no longer accept credentials in query strings. Regression coverage exists in `backend/middleware/auth_test.go`. | Keep tenant JWT, tenant API key, and master key authentication header-only unless a future dedicated one-use token endpoint is designed. |
| SA-004 | Medium | Fixed | A02 Security Misconfiguration, API3 Object Property Authorization | Public static serving is limited to `/uploads/products`. New tenant receipt files are stored under `private_uploads/receipts`, legacy local receipts are no longer exposed by the static mount, and receipt APIs return `/system/payments/:id/receipt` or `/api/v1/order-proofs/:id/receipt` instead of raw storage locations. | Keep receipt reads behind `RequireSuperPermission(PermBillingView)` or tenant `business_id` checks; use private/signed object storage if receipts move off disk. |
| SA-005 | Medium | Fixed | A07 Authentication Failures, API4 Resource Consumption | `RateLimit` now increments the app's shared StateStore, which is Redis-backed in production Compose. Auth endpoints use per-IP plus per-identifier keys, super-admin login uses the same shared limiter, and Nginx defines `limit_req` zones for auth, receipt upload, webhook, and general API traffic. | Keep `STATE_STORE=redis` in production and install `/etc/nginx/snippets/salespilot-api-proxy.conf` before enabling the SSL site config. |
| SA-006 | Medium | Fixed | A02 Security Misconfiguration | `deploy/nginx/salespilot-security-headers.conf` now sends an enforced `Content-Security-Policy` alongside HSTS, frame, nosniff, referrer, and permissions headers. The policy allows current Next.js inline requirements, Sentry ingest, Cloudinary media, Google Fonts, and PayHere redirects. | Validate the policy on staging with browser console checks and tighten `script-src`/`style-src` to nonce or hash-based directives when the Next.js apps are ready. |
| SA-007 | Medium | Fixed | A03 Software Supply Chain Failures | `.github/workflows/security.yml` runs Go and Node dependency vulnerability scans on PRs, pushes to `main`, and manual dispatch. The Go job installs `govulncheck` and scans `backend`; the Node matrix audits `frontend`, `salespilot-admin-main`, and `landing` production dependency trees. | Treat high/critical scan failures as release blockers unless explicitly accepted with owner, date, and mitigation. |
| SA-008 | Low | Fixed | A02 Security Misconfiguration | `docker-compose.prod.yml` now sets `no-new-privileges` for every production service, drops all Linux capabilities from backend/frontend/admin/landing, drops `NET_RAW` from stateful and observability services, applies memory/CPU/pid limits, and runs app containers with read-only root filesystems. | Keep the explicit writable mounts for `/app/uploads`, `/app/private_uploads`, `/app/data`, `/tmp`, and Next.js cache paths; validate container health after changing resource limits. |
| SA-009 | Low | Fixed | A08 Software/Data Integrity Failures | Production startup no longer runs schema `AutoMigrate`; it verifies `schema_migrations` and exits if reviewed migrations are pending. The backend image includes `salespilot-migrate`, production Compose defines a profiled `migrate` service, and deploy/systemd flows run it before backend startup. | Keep future schema/data changes as new versioned entries in `backend/database/migrations.go`; run a backup before migrations and verify `salespilot-migrate status` after deploy. |

## OWASP Top 10:2025 Mapping

| Risk | Current posture |
| --- | --- |
| A01 Broken Access Control | Tenant-scoped DB context is used broadly. Super-admin token/API-key serialization leak fixed in this pass. Continue testing ID-based endpoints for object-level authorization. |
| A02 Security Misconfiguration | Nginx headers with enforced CSP, localhost-only app ports, private receipt serving, Docker runtime hardening, and production migration gates are in place. |
| A03 Software Supply Chain Failures | CI now runs Go and Node vulnerability scans. Keep reviewing Docker image tags and scan results before each release. |
| A04 Cryptographic Failures | JWT secret length is enforced; PayHere compare hardened. Tenant Meta tokens are envelope-encrypted at rest with startup backfill for legacy plaintext rows. |
| A05 Injection | GORM parameter binding is used in reviewed query paths. Dynamic update maps are allowlisted in product updates. Continue scanning raw SQL and prompt-to-SQL risks if added later. |
| A06 Insecure Design | Runbooks, backups, DR, incident response, logs, private receipt access, Redis-backed rate limits, enforced CSP, and load tests are now documented or implemented. |
| A07 Authentication Failures | JWT sessions are revocable, tenant JWTs are held in backend-set HttpOnly cookies, super-admin sessions are hashed server-side, query-string credential fallbacks have been removed, and auth rate limits are shared across Redis-backed instances. |
| A08 Software/Data Integrity Failures | Dependency scans run in CI, production migrations are versioned, and deploy/systemd flows run migrations before app startup. Continue keeping future schema changes behind reviewed migration entries. |
| A09 Security Logging and Alerting Failures | Loki, Alloy, Grafana, audit logs, incident response, and alerting hooks exist. Add security-specific alert queries for auth spikes and invalid webhooks. |
| A10 Mishandling of Exceptional Conditions | External API timeouts and backend HTTP server timeouts now exist. Continue testing slow uploads, AI-provider failures, and payment-webhook replay behavior. |

## OWASP API Security Top 10:2023 Mapping

| Risk | Current posture |
| --- | --- |
| API1 Broken Object Level Authorization | Tenant `db` scope is used on dashboard routes. Keep adding tests for every `:id` route that reads or mutates tenant-owned records. |
| API2 Broken Authentication | JWT and super-admin sessions are server-validated. Tenant sessions now use HttpOnly cookies, and URL credential fallbacks have been removed. |
| API3 Broken Object Property Level Authorization | System business secret serialization fixed, and receipt storage locations are masked behind authorized endpoints. Continue avoiding embedded DB models in admin/public responses. |
| API4 Unrestricted Resource Consumption | Redis-backed route limits, Nginx edge limits, load-test harness, upload caps, external API timeouts, and server timeouts exist. Tune limits with staging traffic before public launch. |
| API5 Broken Function Level Authorization | Super-admin permission middleware exists. Confirm support role cannot access high-risk mutations or sensitive reveal workflows. |
| API6 Sensitive Business Flows | Payment approval, activation codes, AI generation, uploads, and WhatsApp connect flows need abuse monitoring and rate-limit tuning. |
| API7 SSRF | Reviewed outbound URLs are mostly fixed provider URLs. Meta media download follows Meta-provided media URLs; keep host allowlisting if user-supplied URLs are introduced. |
| API8 Security Misconfiguration | Nginx and Compose are hardened, CSP is enforced for HTTPS responses, receipts are private, and production migration control is explicit. |
| API9 Improper Inventory Management | Main runbook documents public domains and health checks. Add an endpoint inventory table before external pentest. |
| API10 Unsafe Consumption of APIs | External API client timeouts exist. Continue validating Meta, Gemini, Cloudinary, Resend, PayHere, and Discord responses before trusting fields. |

## Required Pre-Launch Security Commands

Run these on a machine with normal Node/npm and Go security tooling:

```bash
cd backend
go vet ./...
govulncheck ./...
go test ./handlers ./utils ./httpclient ./cmd/loadtest
```

```bash
cd frontend
npm audit --omit=dev --audit-level=high
npm run build
```

```bash
cd salespilot-admin-main
npm audit --omit=dev --audit-level=high
npm run build
```

```bash
cd landing
npm audit --omit=dev --audit-level=high
npm run build
```

Optional dynamic check after staging is up:

```bash
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t https://api.staging.salespilot.lk \
  -r zap-api-baseline.html
```

## Launch Gate

Security launch is ready only when:

- All High findings are closed.
- Medium findings are either closed or explicitly accepted with owner and date.
- Dependency scans pass with no high/critical reachable vulnerabilities.
- Authenticated IDOR tests pass for products, orders, rules, chats, payment proofs, sessions, and settings.
- Enforced CSP passes staging browser checks for landing, tenant app, admin, API calls, Sentry, Cloudinary media, and PayHere redirects.
- A staging ZAP baseline has no high-risk findings.
- Incident playbook includes the final provider contacts and secret-rotation checklist.
