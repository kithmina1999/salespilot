# Production Environment Variables

This guide explains how to prepare the production Compose env file. For the
authoritative inventory across production, local development, deploy scripts,
backups, managed variables, and retired names, see
`docs/environment-variables.md`.

Use `.env.production.example` as the template:

```bash
cp .env.production.example .env.production
```

Do not commit `.env.production`. It contains secrets.

Do not `source .env.production` from shell scripts. It is a Docker Compose env
file, not a Bash env file; some values may contain spaces or angle brackets.

`docker-compose.prod.yml` uses this file in two ways:

- Compose interpolation: image tags, host ports, Postgres credentials, and Next.js build args
- Backend runtime env: the Go API receives `.env.production` through `env_file`

Important: `NEXT_PUBLIC_*` values are baked into Next.js images during `docker compose up -d --build`. Rebuild the affected image after changing them.

Database backup settings do not live in `.env.production`; they live in `/etc/salespilot/backup.env`. See `docs/database-backups.md`.

## Generate Secrets

Use hex secrets for values embedded in URLs:

```bash
openssl rand -hex 32
```

Use these commands as defaults:

```bash
# POSTGRES_PASSWORD, JWT_SECRET
openssl rand -hex 32

# MASTER_API_KEY
openssl rand -hex 24
```

## Required For Boot

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `POSTGRES_DB` | Compose `postgres` | Yes | Default: `salespilot`. |
| `POSTGRES_USER` | Compose `postgres` | Yes | Default: `salespilot`. |
| `POSTGRES_PASSWORD` | Compose `postgres` | Yes | Generate once with `openssl rand -hex 32`. |
| `DATABASE_URL` | Backend | Yes | For bundled Postgres: `postgresql://salespilot:PASSWORD@postgres:5432/salespilot?sslmode=disable`. |
| `JWT_SECRET` | Backend | Yes | Required for login/session JWT signing. Minimum 32 chars. |
| `MASTER_API_KEY` | Backend | Yes | Required by config validation. Minimum 32 chars. |
| `GEMINI_API_KEY` | Backend | Yes | App exits without it. Used for AI chat, embeddings, image/receipt analysis, reports. |

## Server And URLs

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `PORT` | Backend | Yes | Keep `8080`; Compose maps it internally and Nginx proxies to localhost. |
| `GIN_MODE` | Backend | Yes | Use `release` in production. |
| `SERVER_URL` | Backend, frontend/admin build args | Yes | Public API origin, e.g. `https://api.salespilot.lk`. |
| `FRONTEND_URL` | Backend CORS, billing redirects | Yes | Comma-separated allowed origins, e.g. `https://app.salespilot.lk,https://admin.salespilot.lk`. |
| `WA_SESSIONS_DB_PATH` | Backend | Set by Compose | Do not put in `.env.production` unless changing container layout. |

## Backend Observability

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `APP_ENV` | Backend logs/errors | Recommended | Use `production`. |
| `APP_RELEASE` | Backend logs/errors | Recommended | Git SHA or immutable image tag; falls back to `SENTRY_RELEASE` then `IMAGE_TAG`. |
| `LOG_FORMAT` | Backend | Recommended | Use `json` in production; local development may use `text`. |
| `LOG_LEVEL` | Backend | Optional | Default `info`; accepts `debug`, `info`, `warn`, or `error`. |

## Compose Runtime Knobs

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `IMAGE_TAG` | Compose image names | Optional | Default `latest`. Useful for tagged releases. |
| `BACKEND_PORT` | Compose host bind | Optional | Default `8080`; Nginx config assumes this. |
| `FRONTEND_PORT` | Compose host bind | Optional | Default `3000`; Nginx config assumes this. |
| `ADMIN_PORT` | Compose host bind | Optional | Default `3001`; Nginx config assumes this. |
| `LANDING_PORT` | Compose host bind | Optional | Default `3002`; Nginx config assumes this. |
| `GRAFANA_PORT` | Compose host bind | Optional | Default `3003`; binds to `127.0.0.1` for SSH-tunnel-only log access. |

All host app ports are bound to `127.0.0.1`. Public traffic should go through Nginx only.

## Redis

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `STATE_STORE` | Backend | Set by Compose | Production Compose forces `redis`; local development defaults to `memory`. |
| `REDIS_URL` | Backend | Optional | Leave empty for bundled Compose Redis. Set only for managed Redis/Valkey. |
| `REDIS_KEY_PREFIX` | Backend | Optional | Default `salespilot`. Keeps keys namespaced. |
| `REDIS_ADDR` | Backend | Set by Compose | Defaults to `redis:6379` in Compose. |
| `REDIS_PASSWORD` | Backend | Optional | Only for non-URL Redis config. |
| `REDIS_DB` | Backend | Optional | Default `0`. |

## Landing/Public Site

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Landing build/runtime | Yes | Public landing origin, e.g. `https://salespilot.lk`. |
| `NEXT_PUBLIC_APP_URL` | Landing build/runtime | Yes | Public tenant app origin, e.g. `https://app.salespilot.lk`. |
| `NEXT_APPLICATION_URL` | Landing build/runtime | Optional/local | Legacy fallback used by landing code. Production Compose derives it from `NEXT_PUBLIC_APP_URL`. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Landing build/runtime | Recommended | Public support email in landing/legal content. |
| `NEXT_PUBLIC_SUPPORT_PHONE_NUMBER` | Landing build/runtime | Recommended | Public support phone number. |
| `NEXT_PUBLIC_COMPANY_NAME` | Landing build/runtime | Recommended | Legal/company display name. |
| `NEXT_PUBLIC_COMPANY_ADDRESS` | Landing build/runtime | Recommended | Legal/company address. |

## App And Admin Frontends

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `BACKEND_URL` | Frontend server rewrites | Set by Compose | Internal backend URL, `http://backend:8080`. |
| `NEXT_PUBLIC_API_URL` | Frontend/admin browser code | Set by Compose from `SERVER_URL` | Public API origin. Rebuild after changing `SERVER_URL`. |

Do not usually set `BACKEND_URL` or `NEXT_PUBLIC_API_URL` directly in `.env.production`; Compose derives them.

## Error Tracking / Sentry

The frontend Sentry project is `frontend-salespilot` in org `salespilot-5b`.
The Sentry wizard command for that app is:

```bash
cd frontend
npx @sentry/wizard@latest -i nextjs --saas --org salespilot-5b --project frontend-salespilot
```

This repo uses a manual setup so deployment stays non-interactive.

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `SENTRY_ENABLED` | Frontend server runtime | Optional | Set `true` after `SENTRY_FRONTEND_DSN` is filled. |
| `SENTRY_ENVIRONMENT` | Frontend server runtime | Optional | Use `production` on the VPS. |
| `SENTRY_RELEASE` | Frontend server runtime | Optional | Prefer the git SHA or image tag for release grouping. |
| `SENTRY_TRACES_SAMPLE_RATE` | Frontend server runtime | Optional | Start at `0`; raise later only if tracing is needed. |
| `SENTRY_AUTH_TOKEN` | Frontend build | Optional | Needed only for source map uploads. Keep secret. |
| `SENTRY_ORG` | Frontend build | Optional | Default `salespilot-5b`. |
| `SENTRY_FRONTEND_PROJECT` | Frontend build | Optional | Default `frontend-salespilot`. |
| `SENTRY_FRONTEND_DSN` | Frontend server runtime | Optional | Same DSN as the public frontend DSN. Not secret, but keep in env for consistency. |
| `NEXT_PUBLIC_SENTRY_ENABLED` | Frontend browser build/runtime | Optional | Set `true` after `NEXT_PUBLIC_SENTRY_FRONTEND_DSN` is filled. |
| `NEXT_PUBLIC_SENTRY_FRONTEND_DSN` | Frontend browser build/runtime | Optional | Public DSN for `frontend-salespilot`. Rebuild after changing. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Frontend browser build/runtime | Optional | Use `production` on the VPS. |
| `NEXT_PUBLIC_SENTRY_RELEASE` | Frontend browser build/runtime | Optional | Match `SENTRY_RELEASE`. Rebuild after changing. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Frontend browser build/runtime | Optional | Start at `0`; raise later only if tracing is needed. |

Sentry is configured with `sendDefaultPii: false` and extra scrubbing for request
cookies, auth headers, tokens, phone-like keys, and WhatsApp-token-like keys.
Do not enable Session Replay until masking and retention are reviewed.

## Log Aggregation

The production Compose stack includes Loki, Grafana Alloy, and Grafana. See
`docs/log-aggregation.md` for access, LogQL queries, and retention notes.

Grafana is local-only by default. Use an SSH tunnel:

```bash
ssh -L 3003:127.0.0.1:3003 deploy@YOUR_VPS_IP
```

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `GRAFANA_PORT` | Compose `grafana` | Optional | Default `3003`; bound to localhost only. |
| `GRAFANA_ADMIN_USER` | Grafana | Yes | Default `admin`. |
| `GRAFANA_ADMIN_PASSWORD` | Grafana | Yes | Generate a strong value; required by Compose. |
| `GRAFANA_ROOT_URL` | Grafana | Optional | Default `http://localhost:3003`. Change only if later exposing behind Nginx. |
| `GRAFANA_IMAGE_TAG` | Compose `grafana` | Optional | Default `13.0.0`. |
| `LOKI_IMAGE_TAG` | Compose `loki` | Optional | Default `3.7.0`. |
| `ALLOY_IMAGE_TAG` | Compose `alloy` | Optional | Default `v1.17.0`. |
| `ALLOY_PORT` | Compose `alloy` | Optional | Default `12345`; local-only Alloy UI/debug port. |

Do not expose Grafana publicly until SSL, auth hardening, and an IP allowlist or
VPN are in place.

## Auth And Admin

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `JWT_SECRET` | Backend | Yes | Generate with `openssl rand -hex 32`. |
| `MASTER_API_KEY` | Backend | Yes | Generate with `openssl rand -hex 24`. |
| `SUPER_ADMIN_EMAIL` | Backend startup | Optional | If no super admin exists, creates an owner account when this and `SUPER_ADMIN_INITIAL_PASSWORD` are set. |
| `SUPER_ADMIN_INITIAL_PASSWORD` | Backend startup | Optional | Use only for first boot; remove after login/password rotation. |

## Meta / WhatsApp

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `META_VERIFY_TOKEN` | Backend webhook verification | Yes for WhatsApp | Must match Meta webhook setup. |
| `META_APP_SECRET` | Backend webhook signature verification | Yes for WhatsApp | App secret from Meta developer console. |
| `OWNER_PHONE` | Backend | Recommended | Owner/admin phone number fallback. |
| `WHATSAPP_OTP_TEMPLATE` | Backend | Optional | Defaults to `salespilot_otp`. |

WhatsApp phone IDs and access tokens are connected per tenant and stored in
PostgreSQL. Global `WA_PHONE_NUMBER_ID` and `WA_ACCESS_TOKEN` env variables are
not read by the backend.

Meta webhook URL:

```text
https://api.salespilot.lk/api/whatsapp/webhook
```

## AI

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Backend | Yes | Required at boot. Used across chat, onboarding, rule generation, image analysis, receipt scanning, and reports. |

## Cloudinary

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `CLOUDINARY_URL` | Backend | Recommended | Product images and payment proof uploads can use this. |
| `CLOUDINARY_RECEIPTS_URL` | Backend | Optional | Separate Cloudinary account/cloud for receipt screenshots. Falls back to `CLOUDINARY_URL`. |

If Cloudinary is missing, some image workflows fall back to local uploads or cannot persist public media URLs reliably.

## Email

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | Backend | Recommended | Sends OTPs, activation codes, and alerts. Missing key logs simulated sends. |
| `RESEND_FROM_EMAIL` | Backend | Recommended | Sender shown in transactional emails, e.g. `SalesPilot <noreply@salespilot.lk>`. |

## Payments

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `PAYHERE_MERCHANT_ID` | Backend | Required for PayHere | PayHere merchant ID. |
| `PAYHERE_MERCHANT_SECRET` | Backend | Required for PayHere | PayHere merchant secret. |
| `PAYHERE_SANDBOX` | Backend | Yes | Use `false` in live production. Any value other than `false` is treated as sandbox. |

PayHere notify URL:

```text
https://api.salespilot.lk/api/v1/billing/notify
```

## R2 / App Object Storage

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `R2_ACCOUNT_ID` | Backend config | Reserved | Loaded by backend config, but no active app storage client consumes it. |
| `R2_ACCESS_KEY_ID` | Backend config | Reserved | Loaded but currently unused. Do not confuse with backup S3 keys. |
| `R2_SECRET_ACCESS_KEY` | Backend config | Reserved | Loaded but currently unused. Do not confuse with backup S3 keys. |
| `R2_BUCKET_NAME` | Backend config | Reserved | Loaded but currently unused. |

## Discord Alerts

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `DISCORD_GENERAL_ISSUES_WEBHOOK_URL` | Backend | Optional | General operational alerts. |
| `DISCORD_CRITICAL_ISSUES_WEBHOOK_URL` | Backend | Optional | Critical operational alerts. |

## Dangerous / Maintenance

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `SEED_DB` | Backend startup | Optional | Keep `false`. If `true`, drops and reseeds core tables. |
| `API_KEY` | Backend config | Retired | Loaded but not consumed; tenant API keys live in PostgreSQL. |
| `DB_PATH` | Backend | Retired | Ignored; the primary database uses `DATABASE_URL`. |

## Common VPS Values

For the default single-VPS deployment:

```env
POSTGRES_DB=salespilot
POSTGRES_USER=salespilot
POSTGRES_PASSWORD=REPLACE_WITH_RANDOM_64_CHAR_HEX
DATABASE_URL=postgresql://salespilot:REPLACE_WITH_RANDOM_64_CHAR_HEX@postgres:5432/salespilot?sslmode=disable

REDIS_URL=
REDIS_KEY_PREFIX=salespilot

SERVER_URL=https://api.salespilot.lk
FRONTEND_URL=https://app.salespilot.lk,https://admin.salespilot.lk
NEXT_PUBLIC_SITE_URL=https://salespilot.lk
NEXT_PUBLIC_APP_URL=https://app.salespilot.lk

GRAFANA_PORT=3003
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=REPLACE_WITH_RANDOM_STRONG_PASSWORD
GRAFANA_ROOT_URL=http://localhost:3003
```

For managed Postgres later, change both:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require
```

and remove/ignore the Compose `postgres` service only after migration and restore testing.

For managed Redis later:

```env
REDIS_URL=rediss://:PASSWORD@HOST:6379/0
```

## Preflight

Before deploy:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
```

After deploy:

```bash
curl -I https://api.salespilot.lk/health
```
