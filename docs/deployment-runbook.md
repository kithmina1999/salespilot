# SalesPilot Deployment Runbook

This is the canonical runbook for deploying SalesPilot to production.

Use this file during the actual VPS deployment. The deeper reference docs are:

- `docs/architecture.md` for system, deployment, backend, and data-flow diagrams
- `docs/environment-variables.md` for the complete configuration reference
- `docs/error-handling.md` for dependency resilience, correlation, and backend error reporting
- `docs/production-env.md` for preparing `.env.production`
- `docs/nginx-ssl-vps-deployment.md` for Nginx and Let's Encrypt details
- `docs/database-backups.md` for backup and restore details
- `docs/incident-response-playbook.md` for severity, roles, triage, communications, and postmortems
- `docs/on-call-rotation.md` for coverage, paging ownership, and handoff
- `docs/disaster-recovery.md` for outage, restore, and total-VPS-loss procedures
- `docs/deployment-script.md` for the deploy script behavior
- `docs/log-aggregation.md` for Loki, Alloy, and Grafana log access
- `docs/load-testing.md` for the 100-concurrent-user readiness check
- `docs/security-audit-owasp-top-10.md` for the OWASP security audit and launch gate

## Deployment Shape

Default production is one VPS running:

- Docker Compose app stack:
  - `backend` on `127.0.0.1:8080`
  - `frontend` on `127.0.0.1:3000`
  - `admin` on `127.0.0.1:3001`
  - `landing` on `127.0.0.1:3002`
  - `postgres`
  - `redis`
  - `loki`
  - `alloy`
  - `grafana` on `127.0.0.1:3003`
- Host Nginx terminates HTTPS and proxies public traffic to localhost ports.
- Host systemd can keep the Compose stack running.
- Database backups run through a separate systemd timer.

Do not expose raw Docker app ports publicly. Only ports `80` and `443` should be public.

## Change Later

Fill these after buying the VPS/domain:

| Placeholder | Replace with |
| --- | --- |
| `YOUR_VPS_IP` | Public IPv4 of the VPS. |
| `deploy@YOUR_VPS_IP` | Real SSH user and host. |
| `salespilot.lk` | Real root domain, if different. |
| `app.salespilot.lk` | Real tenant app domain, if different. |
| `admin.salespilot.lk` | Real admin app domain, if different. |
| `api.salespilot.lk` | Real API domain, if different. |
| `CHANGE_ME_EMAIL` | Email for Let's Encrypt renewal notices. |
| `/opt/salespilot-v2` | Real repo path, if different. |
| `/mnt/salespilot-backups` | Real mounted backup disk path, if different. |
| `GRAFANA_ADMIN_PASSWORD` | Strong random password. |
| R2/S3 settings | Offsite backup provider, bucket, endpoint, and keys. |

Do not create DNS `AAAA` records unless the VPS has working IPv6.

## Phase 0 - Local Release Preparation

Run this before touching the VPS:

```bash
git status --short
```

Review the release diff and confirm no secrets are committed:

```bash
git diff --check
```

Backend checks:

```bash
cd backend
go test ./httpclient ./handlers ./services ./utils
go test ./whatsapp -run TestDoesNotExist
```

Frontend build checks should be run before a real release. Use the project runtime
or CI command already configured for each Next.js app.

Known current caveat: full `go test ./...` can fail in existing WhatsApp payment
flow tests because they hit real Meta-like paths and test DB state. Fix/mocking
that test gap before treating full-suite green as a release gate.

Go/no-go:

- Go if focused tests pass, build checks pass, and secrets are clean.
- Stop if database migrations, environment variables, or payment/WhatsApp flows changed and were not manually reviewed.

## Phase 1 - VPS Base Setup

SSH into the VPS:

```bash
ssh deploy@YOUR_VPS_IP
```

Install base packages:

```bash
sudo apt update
sudo apt install -y curl git nginx certbot gnupg awscli
```

Install Docker Engine and Docker Compose plugin using the official Docker install
path for the VPS OS.

Open firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"
sudo ufw --force enable
sudo ufw status
```

Prepare the app directory:

```bash
sudo mkdir -p /opt/salespilot-v2
sudo chown -R "$USER":"$USER" /opt/salespilot-v2
cd /opt/salespilot-v2
```

Clone or copy the repo into `/opt/salespilot-v2`.

## Phase 2 - DNS

Create DNS `A` records pointing to `YOUR_VPS_IP`:

```text
salespilot.lk
www.salespilot.lk
app.salespilot.lk
admin.salespilot.lk
api.salespilot.lk
```

Verify:

```bash
dig +short salespilot.lk
dig +short app.salespilot.lk
dig +short admin.salespilot.lk
dig +short api.salespilot.lk
```

Go/no-go:

- Go when all records resolve to the VPS IPv4.
- Stop if DNS still points elsewhere.

## Phase 3 - Production Environment

Create `.env.production`:

```bash
cd /opt/salespilot-v2
cp .env.production.example .env.production
chmod 600 .env.production
```

Generate secrets:

```bash
openssl rand -hex 32
openssl rand -hex 24
```

Required values to fill first:

```env
POSTGRES_PASSWORD=...
DATABASE_URL=postgresql://salespilot:POSTGRES_PASSWORD@postgres:5432/salespilot?sslmode=disable
JWT_SECRET=...
MASTER_API_KEY=...
GEMINI_API_KEY=...
SERVER_URL=https://api.salespilot.lk
FRONTEND_URL=https://app.salespilot.lk,https://admin.salespilot.lk
NEXT_PUBLIC_SITE_URL=https://salespilot.lk
NEXT_PUBLIC_APP_URL=https://app.salespilot.lk
GRAFANA_ADMIN_PASSWORD=...
```

Fill provider values as available:

- Meta webhook secrets; tenant WhatsApp credentials are connected after deploy
- Cloudinary credentials
- Resend credentials
- PayHere credentials
- Discord alert webhooks
- Sentry DSNs and release values
- R2 app object-storage values, if used later

Validate Compose config:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
```

Go/no-go:

- Go if Compose config renders cleanly.
- Stop if any value still contains `REPLACE_WITH_`, `CHANGE_ME`, or placeholder domains.

## Phase 4 - First App Boot

Start the Compose stack:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Check containers:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Local health checks:

```bash
curl -fsSL http://127.0.0.1:8080/health
curl -fsSL http://127.0.0.1:3000 >/dev/null
curl -fsSL http://127.0.0.1:3001 >/dev/null
curl -fsSL http://127.0.0.1:3002 >/dev/null
curl -fsSL http://127.0.0.1:3003/api/health
```

Check logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=120 backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=80 loki
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=80 alloy
```

Go/no-go:

- Go if all local health checks pass.
- Stop if backend cannot connect to Postgres/Redis or if any required container restarts repeatedly.

## Phase 5 - Nginx And SSL

Install bootstrap Nginx config:

```bash
sudo cp deploy/nginx/salespilot.bootstrap.conf /etc/nginx/sites-available/salespilot
sudo ln -sf /etc/nginx/sites-available/salespilot /etc/nginx/sites-enabled/salespilot
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Issue certificates:

```bash
sudo certbot certonly --webroot \
  -w /var/www/letsencrypt \
  --email CHANGE_ME_EMAIL \
  --agree-tos \
  --no-eff-email \
  -d salespilot.lk \
  -d www.salespilot.lk \
  -d app.salespilot.lk \
  -d admin.salespilot.lk \
  -d api.salespilot.lk
```

Install SSL config:

```bash
sudo cp deploy/nginx/salespilot-ssl-params.conf /etc/nginx/snippets/salespilot-ssl-params.conf
sudo cp deploy/nginx/salespilot-security-headers.conf /etc/nginx/snippets/salespilot-security-headers.conf
sudo cp deploy/nginx/salespilot-api-proxy.conf /etc/nginx/snippets/salespilot-api-proxy.conf
sudo cp deploy/nginx/salespilot.ssl.conf /etc/nginx/sites-available/salespilot
sudo nginx -t
sudo systemctl reload nginx
```

Verify HTTPS:

```bash
curl -I https://salespilot.lk
curl -I https://app.salespilot.lk
curl -I https://admin.salespilot.lk
curl -I https://api.salespilot.lk/health
```

Verify renewal:

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

Go/no-go:

- Go if all HTTPS checks pass.
- Stop if certificate paths differ from the Nginx config. Update `deploy/nginx/salespilot.ssl.conf` before continuing.

## Phase 6 - Systemd Service

Install the app service:

```bash
sudo cp deploy/systemd/salespilot.service /etc/systemd/system/salespilot.service
sudo systemctl daemon-reload
sudo systemctl enable salespilot
sudo systemctl start salespilot
sudo systemctl status salespilot
```

Useful commands:

```bash
sudo systemctl restart salespilot
journalctl -u salespilot -f
```

## Phase 7 - Database Backups

Create local backup storage:

```bash
sudo mkdir -p /mnt/salespilot-backups/postgres
sudo chmod 700 /mnt/salespilot-backups/postgres
```

Create backup secrets:

```bash
sudo install -d -m 700 /etc/salespilot
openssl rand -base64 48 | sudo tee /etc/salespilot/backup-passphrase >/dev/null
sudo chmod 600 /etc/salespilot/backup-passphrase
sudo cp deploy/backups/salespilot-backup.env.example /etc/salespilot/backup.env
sudo chmod 600 /etc/salespilot/backup.env
```

Edit `/etc/salespilot/backup.env`.

For first deployment, local-only is acceptable:

```env
BACKUP_OFFSITE_ENABLED=false
```

Before launch with real customer data, configure offsite R2/S3:

```env
BACKUP_OFFSITE_ENABLED=true
BACKUP_S3_ENDPOINT_URL=https://CHANGE_ME_S3_ENDPOINT
BACKUP_S3_BUCKET=CHANGE_ME_S3_BUCKET
BACKUP_S3_PREFIX=postgres
BACKUP_S3_REGION=auto
BACKUP_S3_ACCESS_KEY_ID=CHANGE_ME_S3_ACCESS_KEY_ID
BACKUP_S3_SECRET_ACCESS_KEY=CHANGE_ME_S3_SECRET_ACCESS_KEY
```

Install timer:

```bash
sudo cp deploy/systemd/salespilot-db-backup.service /etc/systemd/system/salespilot-db-backup.service
sudo cp deploy/systemd/salespilot-db-backup.timer /etc/systemd/system/salespilot-db-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now salespilot-db-backup.timer
systemctl list-timers | grep salespilot-db-backup
```

Run a manual test:

```bash
sudo systemctl start salespilot-db-backup.service
journalctl -u salespilot-db-backup.service -n 100 --no-pager
sudo ls -lah /mnt/salespilot-backups/postgres
```

Go/no-go:

- Go if a backup file is created and verification passes.
- Stop before real customer launch if no offsite backup exists.

## Phase 8 - Log Aggregation

Grafana is local-only. Open it with an SSH tunnel:

```bash
ssh -L 3003:127.0.0.1:3003 deploy@YOUR_VPS_IP
```

Open:

```text
http://localhost:3003
```

Useful LogQL queries:

```logql
{compose_project="salespilot"}
```

```logql
{compose_project="salespilot", service="backend"}
```

```logql
{compose_project="salespilot", service=~"backend|frontend|admin|landing"} |~ "(error|failed|panic|timeout)"
```

Do not expose Grafana publicly until Nginx SSL, strong auth, and an IP allowlist
or VPN are in place.

## Phase 9 - Checked Deploys

Install deploy env:

```bash
sudo install -d -m 700 /etc/salespilot
sudo cp deploy/deploy.env.example /etc/salespilot/deploy.env
sudo chmod 600 /etc/salespilot/deploy.env
sudo chmod +x deploy/scripts/deploy-production.sh
```

For first deploy before DNS/SSL is ready, edit `/etc/salespilot/deploy.env`:

```env
CHECK_PUBLIC_HEALTH=false
```

For normal deploys:

```bash
cd /opt/salespilot-v2
sudo /bin/bash deploy/scripts/deploy-production.sh
```

The script does:

- Docker/Compose preflight
- Nginx config check
- Optional pre-deploy backup
- Compose rebuild/recreate
- Container health checks
- Local URL checks
- Public HTTPS checks

Go/no-go:

- Go if the script ends with `deployment complete`.
- Stop and inspect logs if it prints container or URL failures.

## Phase 10 - External Provider Checks

After deployment, verify these manually:

- Meta webhook verification:
  - Webhook URL: `https://api.salespilot.lk/api/whatsapp/webhook`
  - Verify token matches `META_VERIFY_TOKEN`
  - App secret matches `META_APP_SECRET`
- Send a WhatsApp test message from a connected tenant.
- Create a test product and upload an image.
- Submit a test payment proof.
- Confirm Resend sends OTP/activation email if enabled.
- Confirm PayHere sandbox/live mode matches `PAYHERE_SANDBOX`.
- Confirm Sentry receives frontend errors only after DSNs are enabled.
- Confirm Discord alert webhooks receive a test alert if configured.

## Rollback

Use rollback when deploy health checks fail or a critical flow breaks after deploy.

Fast rollback to previous Git commit:

```bash
cd /opt/salespilot-v2
git log --oneline -n 5
git checkout PREVIOUS_GOOD_COMMIT
sudo /bin/bash deploy/scripts/deploy-production.sh
```

If using image tags later:

```bash
IMAGE_TAG=PREVIOUS_GOOD_TAG docker compose --env-file .env.production -f docker-compose.prod.yml up -d --remove-orphans
```

After rollback:

```bash
curl -I https://api.salespilot.lk/health
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=160 backend
```

Do not run:

```bash
docker compose down -v
```

That removes volumes and can destroy production data.

## Restore Drill

A database restore is destructive. Only do this after confirming the target backup.

Pick a backup:

```bash
sudo ls -lah /mnt/salespilot-backups/postgres/*.dump.gpg
```

Stop app writers:

```bash
cd /opt/salespilot-v2
docker compose --env-file .env.production -f docker-compose.prod.yml stop backend frontend admin landing
```

Restore:

```bash
sudo CONFIRM_RESTORE=salespilot /bin/bash deploy/scripts/restore-postgres-backup.sh \
  /mnt/salespilot-backups/postgres/salespilot-postgres-YYYYMMDDTHHMMSSZ.dump.gpg
```

Restart and verify:

```bash
sudo systemctl restart salespilot
curl -I https://api.salespilot.lk/health
```

Run a restore drill on a fresh test VPS before trusting the backup process for launch.

## Routine Operations

Check stack:

```bash
cd /opt/salespilot-v2
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Tail backend logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
```

Check disk:

```bash
df -h
docker system df
```

Check backups:

```bash
systemctl list-timers | grep salespilot-db-backup
sudo ls -lah /mnt/salespilot-backups/postgres
```

Check Nginx:

```bash
sudo nginx -t
sudo systemctl status nginx
```

Check certificates:

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

## Incident First Response

If public site is down:

```bash
curl -I https://api.salespilot.lk/health
sudo systemctl status nginx
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

If backend is unhealthy:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 postgres
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 redis
```

If WhatsApp is silent:

- Check backend logs for Meta API errors.
- Confirm tenant access token is still valid.
- Confirm webhook URL and `META_VERIFY_TOKEN`.
- Confirm Meta app has `whatsapp_business_messaging` permission.

If database disk is filling:

- Confirm backup volume is mounted.
- Check Loki retention and Docker disk usage.
- Avoid deleting Postgres files manually.

## Launch Gate

Production launch is ready only when:

- DNS resolves to the VPS.
- HTTPS works for landing, app, admin, and API.
- `.env.production` has no placeholders.
- Deploy script passes.
- Database backup timer is active.
- At least one manual backup succeeded.
- Offsite backup is configured before real customer data.
- Grafana logs are visible through SSH tunnel.
- Backend logs are valid JSON with `request_id`, `environment`, and an immutable `release`.
- A staging `5xx` reaches the critical Discord channel without secrets or customer data.
- Gemini retry and Meta no-retry smoke tests match `docs/error-handling.md`.
- 100-concurrent-user load test passes against staging or the final VPS.
- OWASP security audit has no open High findings.
- Sentry DSN is configured or intentionally deferred.
- Uptime monitoring is configured or intentionally deferred.
- Primary and secondary on-call owners are scheduled for the next four weeks.
- Both on-call owners received a test page and passed the access checklist.
- Meta webhook receives and responds to real WhatsApp messages.
- Payment proof and order flow have been smoke-tested.
