# Environment Variable Reference

This is the authoritative environment-variable inventory for SalesPilot. It
covers the application stack, local development, deployment automation, and
database backups. The production template remains `.env.production.example`.

## Status Legend

| Status | Meaning |
| --- | --- |
| Required | The production stack or a core application path cannot work without it. |
| Conditional | Required only when the named integration or workflow is enabled. |
| Optional | Has a safe default or enables non-core behavior. |
| Managed | Set by Docker Compose or the framework; normally do not set it yourself. |
| Reserved | Loaded by the code but has no active runtime consumer yet. |
| Retired | Ignored by the current application and should be removed from env files. |

## Configuration Files

| File | Consumer | Commit it? |
| --- | --- | --- |
| `.env.production` | Docker Compose interpolation and backend runtime | No |
| `.env.production.example` | Production template | Yes |
| `backend/.env` | Go backend during local development | No |
| `frontend/.env.local` | Tenant Next.js app during local development | No |
| `landing/.env.local` | Landing Next.js app during local development | No |
| `salespilot-admin-main/.env.local` | Admin Next.js app during local development | No |
| `/etc/salespilot/deploy.env` | `deploy/scripts/deploy-production.sh` | No |
| `/etc/salespilot/backup.env` | Backup and restore scripts | No |
| `/etc/salespilot/backup-passphrase` | GPG passphrase only; one line | No |

Use `.env.local` for new Next.js local configuration. Existing `.env` or
`.env.development` files are also read by Next.js, but must remain uncommitted.

Do not add `export` to `.env.production`; it is a Docker Compose env file. Do
not source it from a shell. The deploy and backup env files are shell files and
must use shell-safe quoting.

## Core Backend

| Variable | Status | Default | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Required | None | Yes | PostgreSQL connection URL. Use host `postgres` and `sslmode=disable` for bundled Postgres; require TLS for a managed database. |
| `JWT_SECRET` | Required | None | Yes | Signs and verifies tenant and admin JWTs. Use at least 32 random bytes and rotate only with an intentional session invalidation. |
| `MASTER_API_KEY` | Required | None | Yes | Protects master/system API-key routes. The backend exits when missing, known-weak, or shorter than 32 characters. |
| `GEMINI_API_KEY` | Required | None | Yes | Gemini access for chat, embeddings, rules, image and receipt analysis, and reports. The backend exits when missing. |
| `PROVIDER_TOKEN_ENCRYPTION_KEYS` | Required in release | None | Yes | Keyring for envelope-encrypting tenant Meta/WhatsApp access tokens at rest. Format: `key-id:base64-32-byte-key[,old-key-id:base64-32-byte-key]`. The first key encrypts new tokens; all listed keys can decrypt existing tokens. |
| `SERVER_URL` | Required | `http://localhost:8080` | No | Public backend origin with no trailing slash. Used to construct webhook and payment callback URLs. |
| `FRONTEND_URL` | Required | Local app/admin origins | No | Comma-separated CORS allowlist. Put the tenant app first because billing redirects use the first origin. |
| `PORT` | Managed in production | `8080` | No | Backend listen port. Production Compose forces `8080`. |
| `GIN_MODE` | Managed in production | `debug` | No | Gin mode. Production Compose forces `release`. |
| `OWNER_PHONE` | Optional | `+94771234567` | Personal | Fallback owner phone used to locate the system WhatsApp sender for password-reset OTPs. |
| `WHATSAPP_OTP_TEMPLATE` | Optional | `salespilot_otp` | No | Approved Meta template name used for WhatsApp password-reset OTPs. |
| `APP_ENV` | Recommended | `GIN_MODE` or `development` | No | Environment field attached to backend structured logs and error reports. Use `production` on the VPS. |
| `APP_RELEASE` | Recommended | `SENTRY_RELEASE`, `IMAGE_TAG`, or `unknown` | No | Immutable release or Git SHA attached to backend logs and error reports. |
| `LOG_FORMAT` | Recommended | `json` in release; `text` otherwise | No | Backend log encoding. Production must use `json` for Loki parsing. |
| `LOG_LEVEL` | Optional | `info` | No | Minimum backend level: `debug`, `info`, `warn`, or `error`. |
| `DB_AUTO_MIGRATE` | Managed in production | `false` in production, `true` otherwise | No | Controls startup schema mutation. Production Compose sets `false`; reviewed migrations run through `salespilot-migrate` before backend startup. |

`FRONTEND_URL` example:

```env
FRONTEND_URL=https://app.example.com,https://admin.example.com
```

## PostgreSQL And Redis

| Variable | Status | Default | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `POSTGRES_DB` | Required for bundled Postgres | `salespilot` | No | Database created by the Compose Postgres image. Must match `DATABASE_URL`. |
| `POSTGRES_USER` | Required for bundled Postgres | `salespilot` | No | Database role created by the Compose Postgres image. Must match `DATABASE_URL`. |
| `POSTGRES_PASSWORD` | Required for bundled Postgres | None | Yes | Password for the bundled database. Generate once and use its URL-encoded value in `DATABASE_URL`. |
| `STATE_STORE` | Managed in production | `memory` | No | Selects `memory` or `redis`. Production Compose forces `redis`; local development defaults to memory. |
| `REDIS_URL` | Optional | Empty | Potentially | Full `redis://` or `rediss://` URL. Leave empty for bundled Redis; use this for managed Redis/Valkey. |
| `REDIS_ADDR` | Managed in production | `localhost:6379` | No | Host and port used when `REDIS_URL` is empty. Production Compose forces `redis:6379`. |
| `REDIS_PASSWORD` | Optional/local | Empty | Yes | Password for split Redis configuration. Prefer `REDIS_URL` in production. |
| `REDIS_DB` | Optional/local | `0` | No | Redis logical database number when using split configuration. |
| `REDIS_KEY_PREFIX` | Optional | `salespilot` | No | Namespace prefix for Redis keys. |

Changing `POSTGRES_*` after the database volume has been initialized does not
change the existing database role. Follow the migration or disaster-recovery
procedure instead of editing those values in place.

## Meta And WhatsApp

| Variable | Status | Default | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `META_VERIFY_TOKEN` | Conditional | None | Yes | Arbitrary shared token that must match Meta webhook verification settings. |
| `META_APP_SECRET` | Conditional | None | Yes | Verifies Meta webhook signatures. Required before accepting public WhatsApp webhooks. |

Tenant `WA_PHONE_NUMBER_ID` and `WA_ACCESS_TOKEN` values are stored per business
through the WhatsApp connection flow. Access tokens are envelope-encrypted with
`PROVIDER_TOKEN_ENCRYPTION_KEYS`; the backend does not read global versions of
those names from the environment.

Generate a provider-token key with:

```bash
openssl rand -base64 32
```

## Email, Media, Payments, And Alerts

| Variable | Status | Default | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `RESEND_API_KEY` | Conditional | Empty | Yes | Sends verification, activation, reset, and operational emails. Without it, the backend logs simulated sends. |
| `RESEND_FROM_EMAIL` | Conditional | `SalesPilot <onboarding@resend.dev>` | No | Verified sender used by Resend. Set a production-domain sender before launch. |
| `CLOUDINARY_URL` | Conditional | Empty | Yes | Cloudinary URL for product media and fallback receipt storage. |
| `CLOUDINARY_RECEIPTS_URL` | Optional | `CLOUDINARY_URL` | Yes | Separate Cloudinary URL for payment proofs. |
| `PAYHERE_MERCHANT_ID` | Conditional | Empty | Sensitive | PayHere merchant identifier. Required when billing checkout is enabled. |
| `PAYHERE_MERCHANT_SECRET` | Conditional | Empty | Yes | PayHere signing secret. Required when billing checkout is enabled. |
| `PAYHERE_SANDBOX` | Conditional | Sandbox enabled | No | Only exact value `false` enables live PayHere checkout. |
| `DISCORD_GENERAL_ISSUES_WEBHOOK_URL` | Optional | Empty | Yes | Discord webhook for general operational alerts. |
| `DISCORD_CRITICAL_ISSUES_WEBHOOK_URL` | Optional | Empty | Yes | Discord webhook for critical operational alerts. |

## Bootstrap And Maintenance

| Variable | Status | Default | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `SUPER_ADMIN_EMAIL` | Optional | Empty | Personal | Creates the first super-admin only when no super-admin exists and the initial password is also set. |
| `SUPER_ADMIN_INITIAL_PASSWORD` | Conditional | Empty | Yes | One-time bootstrap password. Remove it after first login and password rotation. |
| `SEED_DB` | Optional/dangerous | `false` | No | `true` drops and reseeds core data outside production. Production/release startup exits if this is enabled. |

## Frontend And Landing Builds

Variables beginning with `NEXT_PUBLIC_` are public and embedded in browser
JavaScript. Never place a secret in one. Production changes require rebuilding
the affected image.

| Variable | App | Status | Default | Purpose |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Tenant/admin | Managed in production | `http://localhost:8080` locally | Browser-visible API origin. Compose derives it from `SERVER_URL`. |
| `BACKEND_URL` | Tenant | Managed in production | `http://localhost:8080` | Server-side API rewrite destination. Compose sets `http://backend:8080`. |
| `NEXT_PUBLIC_SITE_URL` | Landing | Required | `https://salespilot.lk` | Canonical public site origin and metadata base. |
| `NEXT_PUBLIC_APP_URL` | Landing | Required | `https://app.salespilot.lk` | Tenant-app destination for landing links. |
| `NEXT_APPLICATION_URL` | Landing | Optional/local alias | Tenant app default | Legacy fallback read by landing code. Production Compose derives it from `NEXT_PUBLIC_APP_URL`. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Landing | Recommended | Project placeholder | Public support address in site and legal content. |
| `NEXT_PUBLIC_SUPPORT_PHONE_NUMBER` | Landing | Recommended | Project placeholder | Public support phone in site and legal content. |
| `NEXT_PUBLIC_COMPANY_NAME` | Landing | Recommended | `SalesPilot` | Public legal/company name. |
| `NEXT_PUBLIC_COMPANY_ADDRESS` | Landing | Recommended | `Sri Lanka` | Public registered/company address. |

## Sentry

| Variable | Scope | Status | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `SENTRY_ENABLED` | Tenant server/edge | Optional | No | Enables server-side Sentry when a DSN is also present. |
| `SENTRY_ENVIRONMENT` | Tenant server/edge | Optional | No | Server event environment, normally `production`. |
| `SENTRY_RELEASE` | Tenant server/edge | Optional | No | Release identifier, preferably the image tag or Git SHA. |
| `SENTRY_TRACES_SAMPLE_RATE` | Tenant server/edge | Optional | No | Number from `0` to `1`; start at `0`. |
| `SENTRY_FRONTEND_DSN` | Tenant server/edge | Conditional | No | Server/edge DSN for the frontend Sentry project. DSNs are public identifiers, not authentication secrets. |
| `NEXT_PUBLIC_SENTRY_ENABLED` | Tenant browser | Optional | No | Enables browser Sentry when a public DSN is present. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Tenant browser | Optional | No | Browser event environment. |
| `NEXT_PUBLIC_SENTRY_RELEASE` | Tenant browser | Optional | No | Browser release identifier; match `SENTRY_RELEASE`. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Tenant browser | Optional | No | Browser trace rate from `0` to `1`; start at `0`. |
| `NEXT_PUBLIC_SENTRY_FRONTEND_DSN` | Tenant browser | Conditional | No | Browser-visible DSN for the frontend Sentry project. |
| `SENTRY_AUTH_TOKEN` | Build only | Conditional | Yes | Uploads source maps during the tenant image build. Do not use a broad or long-lived token. |
| `SENTRY_ORG` | Build only | Optional | No | Sentry organization slug. |
| `SENTRY_FRONTEND_PROJECT` | Build only | Optional | No | Sentry project slug. |

## Compose And Observability

| Variable | Status | Default | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `IMAGE_TAG` | Optional | `latest` | No | Tag applied to SalesPilot images. Prefer an immutable release or Git SHA. |
| `BACKEND_PORT` | Optional | `8080` | No | Loopback host port for the backend. Must match Nginx. |
| `FRONTEND_PORT` | Optional | `3000` | No | Loopback host port for the tenant app. Must match Nginx. |
| `ADMIN_PORT` | Optional | `3001` | No | Loopback host port for the admin app. Must match Nginx. |
| `LANDING_PORT` | Optional | `3002` | No | Loopback host port for the landing app. Must match Nginx. |
| `GRAFANA_PORT` | Optional | `3003` | No | Loopback Grafana port used through an SSH tunnel. |
| `ALLOY_PORT` | Optional | `12345` | No | Loopback Alloy diagnostics port. |
| `GRAFANA_ADMIN_USER` | Required | `admin` | No | Initial Grafana administrator username. |
| `GRAFANA_ADMIN_PASSWORD` | Required | None | Yes | Initial Grafana administrator password; Compose refuses to start without it. |
| `GRAFANA_ROOT_URL` | Optional | `http://localhost:3003` | No | Grafana external root URL. Keep local while Grafana is tunnel-only. |
| `GRAFANA_IMAGE_TAG` | Optional | `13.0.0` | No | Grafana image version. |
| `LOKI_IMAGE_TAG` | Optional | `3.7.0` | No | Loki image version. |
| `ALLOY_IMAGE_TAG` | Optional | `v1.17.0` | No | Grafana Alloy image version. |

All published service ports bind to `127.0.0.1`. Nginx is the only intended
public entry point.

## Deployment Automation

These variables belong in `/etc/salespilot/deploy.env`, copied from
`deploy/deploy.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEPLOY_ENV_FILE` | `/etc/salespilot/deploy.env` | One-command override for the deploy settings file path. |
| `APP_DIR` | `/opt/salespilot-v2` | Repository path on the VPS. |
| `APP_ENV_FILE` | `$APP_DIR/.env.production` | Production Compose env file path. |
| `COMPOSE_FILE` | `$APP_DIR/docker-compose.prod.yml` | Production Compose file path. |
| `DEPLOY_STRATEGY` | `compose` | `compose` builds directly; `systemd` delegates lifecycle to `salespilot.service`. |
| `SYSTEMD_SERVICE` | `salespilot` | Systemd unit used by the systemd strategy. |
| `RUN_PRE_DEPLOY_BACKUP` | `true` | Runs the database backup service before changing containers. |
| `BACKUP_SERVICE` | `salespilot-db-backup.service` | Systemd backup unit to invoke. |
| `BACKUP_ENV_FILE` | `/etc/salespilot/backup.env` | Backup settings passed to the backup service/script. |
| `RUN_DATABASE_MIGRATIONS` | `true` | Runs the Compose migration service before app services start. |
| `MIGRATION_SERVICE` | `migrate` | Compose service that executes `salespilot-migrate up`. |
| `REQUIRED_SERVICES` | All production services | Space-separated Compose services that must be running and healthy. |
| `LOCAL_HEALTH_URLS` | Local service URLs | Space-separated loopback URLs checked before public checks. |
| `CHECK_PUBLIC_HEALTH` | `true` | Enables public HTTPS health checks. Set false before DNS and TLS exist. |
| `PUBLIC_HEALTH_URLS` | Production URLs | Space-separated public URLs checked after deployment. |
| `CHECK_NGINX` | `true` | Runs `nginx -t` and checks Nginx status. |
| `HEALTH_TIMEOUT_SECONDS` | `240` | Total retry window for each health-check phase. |
| `HEALTH_INTERVAL_SECONDS` | `5` | Delay between health-check attempts. |
| `CURL_MAX_TIME_SECONDS` | `10` | Per-request curl timeout. |

## Database Backup And Restore

These variables belong in `/etc/salespilot/backup.env`, copied from
`deploy/backups/salespilot-backup.env.example`.

| Variable | Status | Default | Secret | Purpose |
| --- | --- | --- | --- | --- |
| `APP_DIR` | Optional | `/opt/salespilot-v2` | No | Repository path used by backup and restore scripts. |
| `APP_ENV_FILE` | Optional | `$APP_DIR/.env.production` | Sensitive path | Compose env file used to locate the running database stack. |
| `COMPOSE_FILE` | Optional | `$APP_DIR/docker-compose.prod.yml` | No | Compose file used to run `pg_dump` and restore commands. |
| `BACKUP_DIR` | Required | `/mnt/salespilot-backups/postgres` | Sensitive path | Local backup destination, ideally a separately mounted volume. |
| `BACKUP_RETENTION_DAYS` | Optional | `14` | No | Number of local encrypted backups retained. |
| `BACKUP_PASSPHRASE_FILE` | Required | `/etc/salespilot/backup-passphrase` | Sensitive path | Root-readable file containing the GPG encryption passphrase. |
| `BACKUP_OFFSITE_ENABLED` | Optional | `false` | No | Enables upload to S3-compatible offsite storage. |
| `BACKUP_S3_ENDPOINT_URL` | Conditional | None | No | S3-compatible endpoint, such as Cloudflare R2. |
| `BACKUP_S3_BUCKET` | Conditional | None | No | Offsite backup bucket name. |
| `BACKUP_S3_PREFIX` | Optional | `postgres` | No | Object-key prefix within the bucket. |
| `BACKUP_S3_REGION` | Optional | `auto` | No | S3 region; R2 uses `auto`. |
| `BACKUP_S3_ACCESS_KEY_ID` | Conditional | None | Yes | Restricted write/read credential for the backup bucket. |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Conditional | None | Yes | Secret for the restricted backup credential. |
| `BACKUP_ENV_FILE` | One-command override | `/etc/salespilot/backup.env` | Sensitive path | Alternate backup settings file. |
| `CONFIRM_RESTORE` | Restore only | None | No | Must equal `salespilot` to permit the destructive restore command. |

The backup S3 credentials are separate from the reserved app-level `R2_*`
variables. Do not reuse broad account credentials.

## Reserved, Retired, And Framework Variables

| Variable | Classification | Notes |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | Reserved | Loaded into backend config, but no active app object-storage client consumes it. |
| `R2_ACCESS_KEY_ID` | Reserved secret | Loaded but currently unused. It is not used by database backups. |
| `R2_SECRET_ACCESS_KEY` | Reserved secret | Loaded but currently unused. It is not used by database backups. |
| `R2_BUCKET_NAME` | Reserved | Loaded but currently unused. |
| `API_KEY` | Retired | Loaded into backend config but not consumed. Tenant API keys live in the database. |
| `DB_PATH` | Retired | Ignored. The main database is PostgreSQL through `DATABASE_URL`. |
| `WA_PHONE_NUMBER_ID` | Retired as env config | Ignored globally; stored per tenant in PostgreSQL. |
| `WA_ACCESS_TOKEN` | Retired as env config | Ignored globally; stored per tenant in PostgreSQL. |
| `WA_SESSIONS_DB_PATH` | Managed/reserved | Compose sets `/app/data/whatsapp_sessions.db`; current cloud-API workflows do not consume the config value. |
| `NODE_ENV` | Framework-managed | Production Dockerfiles set `production`. |
| `NEXT_TELEMETRY_DISABLED` | Framework-managed | Production Dockerfiles/Compose set `1`. |
| `NEXT_RUNTIME` | Framework-managed | Next.js sets `nodejs` or `edge` while loading instrumentation. |
| `CI` | Build-system-managed | Used only to control Sentry build output behavior. |

## Applying Changes

| Change | Required action |
| --- | --- |
| Backend runtime variable | Recreate the backend container. |
| `NEXT_PUBLIC_*`, `BACKEND_URL`, or Sentry build variable | Rebuild and recreate the affected Next.js image. |
| Compose image tag, port, Postgres, or Grafana variable | Run Compose again; review database credential changes separately. |
| `/etc/salespilot/deploy.env` | Takes effect on the next deployment-script run. |
| `/etc/salespilot/backup.env` | Takes effect on the next backup or restore run. |

Production validation:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
sudo /bin/bash deploy/scripts/deploy-production.sh
```

Never print the rendered Compose configuration into tickets or logs: it can
contain every backend secret from `.env.production`.
