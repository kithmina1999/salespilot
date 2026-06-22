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

- Encrypt tenant Meta/WhatsApp access tokens at rest.
- Move tenant dashboard auth away from browser-readable `localStorage` tokens.
- Run dependency vulnerability scans in CI or on the VPS build runner.
- Decide whether payment receipt images must be private before approval/rejection.

## Fixes Applied In This Pass

| Area | OWASP mapping | Change |
| --- | --- | --- |
| Super-admin data exposure | A01 Broken Access Control, API3 Object Property Authorization | System business responses now strip `api_key` and `wa_access_token`, exposing only boolean presence flags. |
| Upload handling | A02 Security Misconfiguration, A10 Exceptional Conditions, API4 Resource Consumption | Payment proof uploads now use magic-byte image validation, server-generated filenames, private file permissions, and copy-time size enforcement. |
| HTTP server resilience | A10 Exceptional Conditions, API4 Resource Consumption | Backend server now has read header, read, write, idle, and header-size limits. |
| JWT validation | A07 Authentication Failures | JWT validation now explicitly accepts only HS256. |
| Brute-force pressure | A07 Authentication Failures, API4 Resource Consumption | Register, email verification, resend verification, forgot password, OTP verify, and reset password routes now have IP rate limits. |
| Payment webhook comparison | A04 Cryptographic Failures | PayHere signature comparison now uses constant-time comparison. |

## Open Findings

| ID | Severity | Status | OWASP mapping | Evidence | Required fix |
| --- | --- | --- | --- | --- | --- |
| SA-001 | High | Open | A04 Cryptographic Failures, API3 Object Property Authorization | `backend/models/business.go` stores `WAAccessToken` in plaintext. `backend/handlers/connect_handler.go` saves tenant Meta tokens directly. | Add application-level envelope encryption for tenant provider tokens. Store only ciphertext and decrypt only in WhatsApp send/test paths. Add key rotation notes to DR runbook. |
| SA-002 | High | Open | A07 Authentication Failures | Tenant frontend stores JWT in Zustand persistence and mirrors it into a client-set `token` cookie in `frontend/lib/store.ts`; `frontend/proxy.ts` trusts cookie presence for routing. | Move auth to backend-set `HttpOnly; Secure; SameSite=Lax` cookies or short-lived access token plus refresh flow. Until then, XSS can steal tenant sessions. |
| SA-003 | Medium | Open | A07 Authentication Failures, API2 Broken Authentication | `AuthRequired` accepts `?token=`, `TenantAuth` accepts `?api_key=`, and `MasterAuth` accepts `?master_key=`. No active SSE route was found requiring this. | Remove credential query-string fallbacks, or restrict them to a dedicated endpoint with short-lived one-use tokens. |
| SA-004 | Medium | Partial | A02 Security Misconfiguration, API3 Object Property Authorization | `r.Static("/uploads", "./uploads")` makes local receipt paths web-readable while pending. Upload validation was hardened in this pass. | Store receipts privately, proxy them through an authorized backend endpoint, or upload immediately to a private/signed object store. |
| SA-005 | Medium | Partial | A07 Authentication Failures, API4 Resource Consumption | `backend/middleware/rate_limiter.go` is in-memory and IP-only. More auth routes were protected in this pass. | Replace with Redis-backed per-IP plus per-identifier limits. Add Nginx `limit_req` for auth, webhook, upload, and AI-generation routes. |
| SA-006 | Medium | Open | A02 Security Misconfiguration | Nginx has HSTS, frame, nosniff, referrer, and permissions headers, but CSP is intentionally not enforced yet. | Add CSP in report-only mode, tune for Next/Sentry/Cloudinary, then enforce. |
| SA-007 | Medium | Open | A03 Software Supply Chain Failures | Current local shell has no `npm`; `govulncheck` is not installed. | Run dependency scans before launch and in CI: `npm audit --omit=dev --audit-level=high` for each Next app, and `govulncheck ./...` for backend. |
| SA-008 | Low | Open | A02 Security Misconfiguration | Docker app containers run as non-root and bind ports to localhost, but Compose does not yet set `no-new-privileges`, `cap_drop`, resource limits, or read-only filesystems where feasible. | Add container hardening in a separate Compose pass, testing write paths for uploads, Next cache, Postgres, Redis, Loki, Alloy, and Grafana. |
| SA-009 | Low | Open | A08 Software/Data Integrity Failures | Production startup uses GORM `AutoMigrate`. This is convenient but can blur migration review boundaries. | Before serious launch, move schema changes to reviewed migration files and keep `AutoMigrate` only for dev/staging or explicitly documented safe migrations. |

## OWASP Top 10:2025 Mapping

| Risk | Current posture |
| --- | --- |
| A01 Broken Access Control | Tenant-scoped DB context is used broadly. Super-admin token/API-key serialization leak fixed in this pass. Continue testing ID-based endpoints for object-level authorization. |
| A02 Security Misconfiguration | Nginx headers and localhost-only app ports are good. CSP, Docker security options, private receipt storage, and production migration strategy remain open. |
| A03 Software Supply Chain Failures | Docker images are pinned by major tags, but dependency CVE scanning was not runnable here. Add CI scans before launch. |
| A04 Cryptographic Failures | JWT secret length is enforced; PayHere compare hardened. Tenant Meta tokens still need encryption at rest. |
| A05 Injection | GORM parameter binding is used in reviewed query paths. Dynamic update maps are allowlisted in product updates. Continue scanning raw SQL and prompt-to-SQL risks if added later. |
| A06 Insecure Design | Runbooks, backups, DR, incident response, logs, and load tests are now documented. Authentication storage and token encryption need design changes. |
| A07 Authentication Failures | JWT sessions are revocable and super-admin sessions are hashed server-side. Browser-readable tenant JWTs, query-string credentials, and stronger distributed rate limits remain. |
| A08 Software/Data Integrity Failures | Deployment script and rollback docs exist. Move DB migrations and dependency scans into CI before customer launch. |
| A09 Security Logging and Alerting Failures | Loki, Alloy, Grafana, audit logs, incident response, and alerting hooks exist. Add security-specific alert queries for auth spikes and invalid webhooks. |
| A10 Mishandling of Exceptional Conditions | External API timeouts and backend HTTP server timeouts now exist. Continue testing slow uploads, AI-provider failures, and payment-webhook replay behavior. |

## OWASP API Security Top 10:2023 Mapping

| Risk | Current posture |
| --- | --- |
| API1 Broken Object Level Authorization | Tenant `db` scope is used on dashboard routes. Keep adding tests for every `:id` route that reads or mutates tenant-owned records. |
| API2 Broken Authentication | JWT and super-admin sessions are server-validated. Remove URL credential fallbacks and migrate tenant sessions to HttpOnly cookies. |
| API3 Broken Object Property Level Authorization | System business secret serialization fixed. Continue avoiding embedded DB models in admin/public responses. |
| API4 Unrestricted Resource Consumption | Route limits, load-test harness, upload caps, external API timeouts, and server timeouts exist. Move rate limits to Redis/Nginx before scaling. |
| API5 Broken Function Level Authorization | Super-admin permission middleware exists. Confirm support role cannot access high-risk mutations or sensitive reveal workflows. |
| API6 Sensitive Business Flows | Payment approval, activation codes, AI generation, uploads, and WhatsApp connect flows need abuse monitoring and rate-limit tuning. |
| API7 SSRF | Reviewed outbound URLs are mostly fixed provider URLs. Meta media download follows Meta-provided media URLs; keep host allowlisting if user-supplied URLs are introduced. |
| API8 Security Misconfiguration | Nginx and Compose are mostly sensible. CSP, Docker hardening, private receipts, and migration control remain. |
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
