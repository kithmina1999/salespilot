# Disaster Recovery Procedures

This document explains how to recover SalesPilot after a production incident.

Use `docs/deployment-runbook.md` for normal deployment. Use this document when
something is already broken, data may be at risk, or a VPS must be rebuilt.
Use `docs/incident-response-playbook.md` to run severity, roles,
communications, escalation, and post-incident review.
Use `docs/on-call-rotation.md` to identify the primary, secondary, and handoff
owner. Use `docs/architecture.md` to trace affected dependencies.

## Recovery Targets

Current practical targets for the default single-VPS deployment:

| Scenario | Target RTO | Target RPO | Notes |
| --- | ---: | ---: | --- |
| Bad app deploy | 15-30 minutes | 0 minutes | Roll back code/images; no database restore. |
| Single unhealthy container | 15-30 minutes | 0 minutes | Restart/redeploy after checking logs. |
| Database corruption or bad migration | 30-90 minutes | Up to last successful backup | Daily backups run at `02:30` VPS time with up to 30m randomized delay. |
| Total VPS loss | 1-4 hours | Up to last offsite backup | Requires offsite backup, `.env.production`, backup passphrase, and provider credentials. |

These are goals, not guarantees. They depend on having backups, secrets, DNS
access, and provider accounts available outside the failed VPS.

## Critical Assets

Store these outside the VPS before launch:

- `.env.production`
- `/etc/salespilot/backup.env`
- `/etc/salespilot/backup-passphrase`
- Offsite backup bucket credentials
- VPS provider credentials
- DNS provider credentials
- Meta developer/business credentials
- PayHere credentials
- Cloudinary credentials
- Resend credentials
- Sentry credentials
- SSH deploy key or access method for the repo

Without the backup passphrase, encrypted database backups cannot be restored.
Without `.env.production`, the app can be rebuilt but provider integrations will
not work correctly.

## Backup Coverage

Covered today:

- PostgreSQL database through encrypted custom-format dumps
- Local backup storage under `/mnt/salespilot-backups/postgres`
- Optional offsite upload to S3-compatible storage
- Backup verification with `pg_restore --list`

Not fully covered today:

- `backend_uploads` Docker volume
- `backend_data` Docker volume
- `redis_data` Docker volume
- `loki_data` and `grafana_data` observability volumes

Operational meaning:

- PostgreSQL is the system of record and must be restored first.
- Redis can usually be rebuilt empty; active rate-limit counters and transient
  workflow state may reset.
- Loki/Grafana logs are useful for investigation but not required to restore the
  app.
- Local uploads are a risk if Cloudinary is not configured. Before real launch,
  either use Cloudinary consistently or add backup coverage for `backend_uploads`.

## Incident Rules

During any disaster:

1. Preserve evidence before changing state when possible.
2. Do not run `docker compose down -v` in production.
3. Do not delete Docker volumes manually.
4. Stop app writers before restoring the database.
5. Prefer rollback for bad deploys; use database restore only for data loss or corruption.
6. If data is at risk, take a fresh encrypted backup before attempting repair.

## First Five Minutes

Run:

```bash
cd /opt/salespilot-v2
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -I https://api.salespilot.lk/health
sudo systemctl status nginx --no-pager
sudo systemctl status salespilot --no-pager
```

Capture recent logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 postgres
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 redis
```

If Grafana is reachable through SSH tunnel, check:

```logql
{compose_project="salespilot"} |~ "(panic|fatal|failed|timeout|connection refused|database)"
```

Classify the incident:

- App-only failure
- Database failure
- Host/VPS failure
- DNS/SSL/Nginx failure
- External provider failure
- Security incident

## Procedure A - Bad Deploy Rollback

Use this when the previous release worked and the new release broke app behavior.

Do not restore the database unless the deploy changed data incorrectly.

```bash
cd /opt/salespilot-v2
git log --oneline -n 10
git checkout PREVIOUS_GOOD_COMMIT
sudo /bin/bash deploy/scripts/deploy-production.sh
```

Verify:

```bash
curl -I https://api.salespilot.lk/health
curl -I https://app.salespilot.lk
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

If using image tags later:

```bash
IMAGE_TAG=PREVIOUS_GOOD_TAG docker compose --env-file .env.production -f docker-compose.prod.yml up -d --remove-orphans
```

After recovery, create a follow-up task to fix the release and add regression tests.

## Procedure B - App Or Container Recovery

Use this when one service is unhealthy but the VPS and database are intact.

Inspect:

```bash
cd /opt/salespilot-v2
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 SERVICE_NAME
```

Restart one service:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml restart SERVICE_NAME
```

Restart the full stack through systemd:

```bash
sudo systemctl restart salespilot
```

Verify:

```bash
curl -I https://api.salespilot.lk/health
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

If the same service keeps restarting, stop and diagnose. Repeated restarts can
make data incidents worse.

## Procedure C - Database Restore

Use this when the database is corrupted, accidentally modified, or a bad migration
must be reversed.

This is destructive. Confirm the target backup before running restore.

Optional but recommended: take a final backup of current state for forensics:

```bash
sudo systemctl start salespilot-db-backup.service
journalctl -u salespilot-db-backup.service -n 100 --no-pager
```

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

Restart:

```bash
sudo systemctl restart salespilot
```

Verify:

```bash
curl -I https://api.salespilot.lk/health
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Smoke test:

- Login
- Load dashboard
- Load orders
- Send or simulate a WhatsApp message
- Check latest orders and payment proof records
- Confirm no app service is restarting

## Procedure D - Restore From Offsite Backup

Use this when local backup volume is lost or the VPS is gone.

On the new VPS:

1. Follow `docs/deployment-runbook.md` through base VPS setup.
2. Clone/copy the repo to `/opt/salespilot-v2`.
3. Restore `.env.production`.
4. Restore `/etc/salespilot/backup.env`.
5. Restore `/etc/salespilot/backup-passphrase`.
6. Install Docker, Nginx, Certbot, `gpg`, and `awscli`.
7. Start only infrastructure enough to restore Postgres.

Create local backup directory:

```bash
sudo mkdir -p /mnt/salespilot-backups/postgres
sudo chmod 700 /mnt/salespilot-backups/postgres
```

Download backup from S3-compatible storage:

```bash
sudo -s
source /etc/salespilot/backup.env
export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$BACKUP_S3_REGION"

aws s3 cp \
  "s3://$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX/salespilot-postgres-YYYYMMDDTHHMMSSZ.dump.gpg" \
  /mnt/salespilot-backups/postgres/ \
  --endpoint-url "$BACKUP_S3_ENDPOINT_URL"
exit
```

Start Postgres:

```bash
cd /opt/salespilot-v2
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres
```

Restore:

```bash
sudo CONFIRM_RESTORE=salespilot /bin/bash deploy/scripts/restore-postgres-backup.sh \
  /mnt/salespilot-backups/postgres/salespilot-postgres-YYYYMMDDTHHMMSSZ.dump.gpg
```

Start full stack:

```bash
sudo systemctl restart salespilot
```

If the VPS IP changed, update DNS `A` records and wait for propagation.

Verify all public URLs:

```bash
curl -I https://salespilot.lk
curl -I https://app.salespilot.lk
curl -I https://admin.salespilot.lk
curl -I https://api.salespilot.lk/health
```

## Procedure E - DNS, SSL, Or Nginx Failure

Check Nginx:

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo journalctl -u nginx -n 100 --no-pager
```

Check certificates:

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

Reload safe config:

```bash
sudo systemctl reload nginx
```

If certificates were recreated with a different path, update
`deploy/nginx/salespilot.ssl.conf`, reinstall it to `/etc/nginx/sites-available`,
run `sudo nginx -t`, and reload Nginx.

If DNS changed, verify:

```bash
dig +short salespilot.lk
dig +short api.salespilot.lk
```

## Procedure F - External Provider Failure

Meta/WhatsApp:

- Check backend logs for Meta status codes.
- Confirm tenant access token is valid.
- Confirm webhook URL is `https://api.salespilot.lk/api/whatsapp/webhook`.
- Confirm `META_VERIFY_TOKEN` and `META_APP_SECRET`.
- Confirm app permissions include `whatsapp_business_messaging`.

Gemini:

- Check `GEMINI_API_KEY`.
- Check quota/billing in Google AI Studio or Google Cloud.
- Confirm the app returns fallback replies instead of hanging.

Cloudinary:

- Check `CLOUDINARY_URL` and `CLOUDINARY_RECEIPTS_URL`.
- If Cloudinary is down, avoid relying on local uploads as the long-term record.

Resend:

- Check `RESEND_API_KEY` and `RESEND_FROM_EMAIL`.
- If email is down, use WhatsApp/manual activation communication temporarily.

PayHere:

- Confirm `PAYHERE_SANDBOX`.
- Confirm merchant ID/secret.
- Confirm notify URL reaches the backend.

## Procedure G - Suspected Security Incident

Immediate actions:

1. Preserve logs and current backups.
2. Rotate `MASTER_API_KEY`.
3. Rotate `JWT_SECRET` if session compromise is suspected.
4. Rotate Meta, Gemini, Resend, Cloudinary, PayHere, Sentry, Discord, and S3 keys as needed.
5. Rebuild and redeploy containers.
6. Review admin users and tenant access.
7. Review payment proof/order status changes.

Commands:

```bash
cd /opt/salespilot-v2
sudo systemctl start salespilot-db-backup.service
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=1000 backend > /tmp/salespilot-backend-incident.log
```

After key rotation:

```bash
sudo /bin/bash deploy/scripts/deploy-production.sh
```

If database tampering is confirmed, restore from a known-good backup and preserve
the compromised database backup separately for investigation.

## Fresh VPS Rebuild Checklist

Use this checklist for total VPS loss:

- New VPS created.
- Firewall allows only SSH, HTTP, and HTTPS.
- Docker and Compose installed.
- Repo restored to `/opt/salespilot-v2`.
- `.env.production` restored from secure external copy.
- `/etc/salespilot/backup.env` restored.
- `/etc/salespilot/backup-passphrase` restored.
- Offsite backup downloaded.
- Postgres restored.
- Full stack started.
- Nginx SSL config installed.
- DNS updated if IP changed.
- Database backup timer reinstalled.
- Manual backup test passes.
- Grafana logs visible through SSH tunnel.
- Meta webhook tested.
- Payment/order smoke test passes.

## DR Drill Schedule

Run these drills:

| Drill | Frequency | Success criteria |
| --- | --- | --- |
| Backup job check | Weekly | Latest encrypted dump exists locally and offsite. |
| Restore to temporary VPS or local test stack | Monthly before launch, quarterly after launch | App boots from restored DB and smoke tests pass. |
| Bad deploy rollback drill | Quarterly | Previous release restored within 30 minutes. |
| Secret escrow review | Quarterly | `.env.production`, backup passphrase, and provider credentials are accessible to the owner. |
| DNS/SSL renewal check | Monthly | `certbot renew --dry-run` passes. |

## Launch Gate For DR

Do not launch with real customer data until:

- Offsite DB backups are enabled.
- Backup passphrase is stored outside the VPS.
- `.env.production` is stored securely outside the VPS.
- At least one restore drill has passed.
- Cloudinary is configured or `backend_uploads` backup coverage is added.
- DNS provider access is confirmed.
- VPS provider access is confirmed.
- The primary and secondary responders can access backups and recovery secrets.
- The owner knows how to run `docs/deployment-runbook.md` and this DR document.
