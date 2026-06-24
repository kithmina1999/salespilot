# Database Backups

SalesPilot production uses two backup layers:

- Local encrypted PostgreSQL dumps on a separate VPS disk or mounted volume
- Optional offsite upload to any S3-compatible storage provider, such as Cloudflare R2, AWS S3, Backblaze B2 S3, or Supabase Storage S3

The primary database is the `postgres` service in `docker-compose.prod.yml`.

For full incident handling, total VPS rebuilds, rollback decisions, and security
events, see `docs/disaster-recovery.md`.

## Files

- `deploy/scripts/backup-postgres.sh`: creates, encrypts, verifies, prunes, and optionally uploads a backup
- `deploy/scripts/restore-postgres-backup.sh`: restores a selected encrypted backup
- `deploy/backups/salespilot-backup.env.example`: backup runtime settings
- `deploy/systemd/salespilot-db-backup.service`: backup job
- `deploy/systemd/salespilot-db-backup.timer`: daily schedule

## Change Later

- `CHANGE_ME_BACKUP_MOUNT`: mount a separate VPS disk or volume at `/mnt/salespilot-backups`
- `CHANGE_ME_BACKUP_PASSPHRASE`: generate and securely store `/etc/salespilot/backup-passphrase`
- `CHANGE_ME_OFFSITE_PROVIDER`: choose R2/S3-compatible offsite storage
- `CHANGE_ME_S3_ENDPOINT`: provider endpoint, for example R2 uses `https://ACCOUNT_ID.r2.cloudflarestorage.com`
- `CHANGE_ME_S3_BUCKET`: bucket name
- `CHANGE_ME_S3_KEYS`: access key ID and secret access key

## Install Requirements

On Ubuntu 22.04/24.04:

```bash
sudo apt update
sudo apt install -y gnupg awscli
```

`awscli` is only needed when `BACKUP_OFFSITE_ENABLED=true`.

## Local Backup Volume

Mount a separate disk or provider volume at:

```bash
/mnt/salespilot-backups
```

Create the backup directory:

```bash
sudo mkdir -p /mnt/salespilot-backups/postgres
sudo chmod 700 /mnt/salespilot-backups/postgres
```

For a real VPS, add the mounted disk to `/etc/fstab` so it survives reboots.

## Backup Secrets

Create backup config and encryption passphrase:

```bash
sudo install -d -m 700 /etc/salespilot
openssl rand -base64 48 | sudo tee /etc/salespilot/backup-passphrase >/dev/null
sudo chmod 600 /etc/salespilot/backup-passphrase
sudo cp deploy/backups/salespilot-backup.env.example /etc/salespilot/backup.env
sudo chmod 600 /etc/salespilot/backup.env
```

Edit `/etc/salespilot/backup.env`.

For local-only backups:

```bash
BACKUP_OFFSITE_ENABLED=false
```

For offsite S3-compatible upload:

```bash
BACKUP_OFFSITE_ENABLED=true
BACKUP_S3_ENDPOINT_URL=https://CHANGE_ME_S3_ENDPOINT
BACKUP_S3_BUCKET=CHANGE_ME_S3_BUCKET
BACKUP_S3_PREFIX=postgres
BACKUP_S3_REGION=auto
BACKUP_S3_ACCESS_KEY_ID=CHANGE_ME_S3_ACCESS_KEY_ID
BACKUP_S3_SECRET_ACCESS_KEY=CHANGE_ME_S3_SECRET_ACCESS_KEY
```

Keep lifecycle/retention rules in the offsite bucket too. The script prunes local backups only.

## Install Timer

```bash
sudo cp deploy/systemd/salespilot-db-backup.service /etc/systemd/system/salespilot-db-backup.service
sudo cp deploy/systemd/salespilot-db-backup.timer /etc/systemd/system/salespilot-db-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now salespilot-db-backup.timer
systemctl list-timers | grep salespilot-db-backup
```

Run a manual backup test:

```bash
sudo systemctl start salespilot-db-backup.service
journalctl -u salespilot-db-backup.service -n 100 --no-pager
```

Check local output:

```bash
sudo ls -lah /mnt/salespilot-backups/postgres
```

## Restore

Restores are destructive. Pick a backup file first:

```bash
sudo ls -lah /mnt/salespilot-backups/postgres/*.dump.gpg
```

Restore one backup into the running `postgres` compose service:

```bash
cd /opt/salespilot-v2
docker compose --env-file .env.production -f docker-compose.prod.yml stop backend frontend admin landing
sudo CONFIRM_RESTORE=salespilot /bin/bash deploy/scripts/restore-postgres-backup.sh \
  /mnt/salespilot-backups/postgres/salespilot-postgres-YYYYMMDDTHHMMSSZ.dump.gpg
```

After restore:

```bash
sudo systemctl restart salespilot
curl -I https://api.salespilot.lk/health
```

## Notes

- Backup files are encrypted before leaving the VPS.
- Store `/etc/salespilot/backup-passphrase` somewhere safe outside the VPS. Without it, encrypted backups cannot be restored.
- For the offsite bucket, enable provider-side object versioning or lifecycle retention when available.
- Test restore on a fresh VPS before trusting the backup process.
