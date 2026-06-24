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

- `npm audit`, because `npm` is not available on this PowerShell path or bundled runtime
- `govulncheck`, because the tool is not installed
- Dynamic scanning with OWASP ZAP
- Authenticated browser session testing against a running production-like stack

## Executive Status

Current status: acceptable for private staging after the fixes in this pass.

Do not launch with real customer data until these high-priority items are closed:

- Run dependency vulnerability scans in CI or on the VPS build runner.
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
| Payment webhook comparison | A04 Cryptographic Failures | PayHere signature comparison now uses constant-time comparison. |

## Open Findings

| ID | Severity | Status | OWASP mapping | Evidence | Required fix |
| --- | --- | --- | --- | --- | --- |
| SA-001 | High | Fixed | A04 Cryptographic Failures, API3 Object Property Authorization | Tenant Meta/WhatsApp access tokens are stored as envelope-encrypted `spenc:v1` payloads in `wa_access_token`. Startup backfill encrypts legacy plaintext rows, and Meta send/test paths decrypt just-in-time. | Keep `PROVIDER_TOKEN_ENCRYPTION_KEYS` in the production secret store and follow the DR rotation procedure before removing old key IDs. |
| SA-002 | High | Fixed | A07 Authentication Failures | Tenant login and email verification set a backend-owned HttpOnly `token` cookie; frontend fetches send credentials and no longer read/store bearer JWTs. `AuthRequired` accepts the cookie and rejects unsafe cookie-auth requests from unapproved browser origins. | Keep tenant JWTs out of browser-readable storage; use `/api/v1/auth/logout` to clear the HttpOnly cookie. |
| SA-003 | Medium | Fixed | A07 Authentication Failures, API2 Broken Authentication | `AuthRequired`, `TenantAuth`, and `MasterAuth` no longer accept credentials in query strings. Regression coverage exists in `backend/middleware/auth_test.go`. | Keep tenant JWT, tenant API key, and master key authentication header-only unless a future dedicated one-use token endpoint is designed. |
| SA-004 | Medium | Fixed | A02 Security Misconfiguration, API3 Object Property Authorization | Public static serving is limited to `/uploads/products`. New tenant receipt files are stored under `private_uploads/receipts`, legacy local receipts are no longer exposed by the static mount, and receipt APIs return `/system/payments/:id/receipt` or `/api/v1/order-proofs/:id/receipt` instead of raw storage locations. | Keep receipt reads behind `RequireSuperPermission(PermBillingView)` or tenant `business_id` checks; use private/signed object storage if receipts move off disk. |
| SA-005 | Medium | Fixed | A07 Authentication Failures, API4 Resource Consumption | `RateLimit` now increments the app's shared StateStore, which is Redis-backed in production Compose. Auth endpoints use per-IP plus per-identifier keys, super-admin login uses the same shared limiter, and Nginx defines `limit_req` zones for auth, receipt upload, webhook, and general API traffic. | Keep `STATE_STORE=redis` in production and install `/etc/nginx/snippets/salespilot-api-proxy.conf` before enabling the SSL site config. |
| SA-006 | Medium | Open | A02 Security Misconfiguration | Nginx has HSTS, frame, nosniff, referrer, and permissions headers, but CSP is intentionally not enforced yet. | Add CSP in report-only mode, tune for Next/Sentry/Cloudinary, then enforce. |
| SA-007 | Medium | Open | A03 Software Supply Chain Failures | Current local shell has no `npm`; `govulncheck` is not installed. | Run dependency scans before launch and in CI: `npm audit --omit=dev --audit-level=high` for each Next app, and `govulncheck ./...` for backend. |
| SA-008 | Low | Open | A02 Security Misconfiguration | Docker app containers run as non-root and bind ports to localhost, but Compose does not yet set `no-new-privileges`, `cap_drop`, resource limits, or read-only filesystems where feasible. | Add container hardening in a separate Compose pass, testing write paths for uploads, Next cache, Postgres, Redis, Loki, Alloy, and Grafana. |
| SA-009 | Low | Open | A08 Software/Data Integrity Failures | Production startup uses GORM `AutoMigrate`. This is convenient but can blur migration review boundaries. | Before serious launch, move schema changes to reviewed migration files and keep `AutoMigrate` only for dev/staging or explicitly documented safe migrations. |

## OWASP Top 10:2025 Mapping

| Risk | Current posture |
| --- | --- |
| A01 Broken Access Control | Tenant-scoped DB context is used broadly. Super-admin token/API-key serialization leak fixed in this pass. Continue testing ID-based endpoints for object-level authorization. |
| A02 Security Misconfiguration | Nginx headers, localhost-only app ports, and private receipt serving are in place. CSP, Docker security options, and production migration strategy remain open. |
| A03 Software Supply Chain Failures | Docker images are pinned by major tags, but dependency CVE scanning was not runnable here. Add CI scans before launch. |
| A04 Cryptographic Failures | JWT secret length is enforced; PayHere compare hardened. Tenant Meta tokens are envelope-encrypted at rest with startup backfill for legacy plaintext rows. |
| A05 Injection | GORM parameter binding is used in reviewed query paths. Dynamic update maps are allowlisted in product updates. Continue scanning raw SQL and prompt-to-SQL risks if added later. |
| A06 Insecure Design | Runbooks, backups, DR, incident response, logs, private receipt access, Redis-backed rate limits, and load tests are now documented or implemented. CSP enforcement remains before production. |
| A07 Authentication Failures | JWT sessions are revocable, tenant JWTs are held in backend-set HttpOnly cookies, super-admin sessions are hashed server-side, query-string credential fallbacks have been removed, and auth rate limits are shared across Redis-backed instances. |
| A08 Software/Data Integrity Failures | Deployment script and rollback docs exist. Move DB migrations and dependency scans into CI before customer launch. |
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
| API8 Security Misconfiguration | Nginx and Compose are mostly sensible, and receipts are no longer publicly served from the uploads tree. CSP, Docker hardening, and migration control remain. |
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
- CSP has run in report-only mode without blocking legitimate traffic.
- A staging ZAP baseline has no high-risk findings.
- Incident playbook includes the final provider contacts and secret-rotation checklist.
