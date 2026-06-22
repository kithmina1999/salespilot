#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

die() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/salespilot/backup.env}"
if [[ -f "$BACKUP_ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$BACKUP_ENV_FILE"
fi

APP_DIR="${APP_DIR:-/opt/salespilot-v2}"
APP_ENV_FILE="${APP_ENV_FILE:-$APP_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/mnt/salespilot-backups/postgres}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_PASSPHRASE_FILE="${BACKUP_PASSPHRASE_FILE:-/etc/salespilot/backup-passphrase}"
BACKUP_OFFSITE_ENABLED="${BACKUP_OFFSITE_ENABLED:-false}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-postgres}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-auto}"

require_command docker
require_command gpg
require_command sha256sum

[[ -d "$APP_DIR" ]] || die "APP_DIR does not exist: $APP_DIR"
[[ -f "$APP_ENV_FILE" ]] || die "app env file does not exist: $APP_ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || die "compose file does not exist: $COMPOSE_FILE"
[[ -f "$BACKUP_PASSPHRASE_FILE" ]] || die "backup passphrase file does not exist: $BACKUP_PASSPHRASE_FILE"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
backup_name="salespilot-postgres-$timestamp.dump.gpg"
backup_path="$BACKUP_DIR/$backup_name"
checksum_path="$backup_path.sha256"

cd "$APP_DIR"

log "creating encrypted PostgreSQL backup: $backup_path"
docker compose --env-file "$APP_ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=9 --no-owner --no-acl' \
  | gpg --batch --yes --pinentry-mode loopback --symmetric --cipher-algo AES256 \
      --passphrase-file "$BACKUP_PASSPHRASE_FILE" \
      --output "$backup_path"

sha256sum "$backup_path" > "$checksum_path"
chmod 600 "$backup_path" "$checksum_path"

log "verifying encrypted dump can be decrypted and listed"
gpg --batch --quiet --pinentry-mode loopback --decrypt --passphrase-file "$BACKUP_PASSPHRASE_FILE" "$backup_path" \
  | docker compose --env-file "$APP_ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres pg_restore --list >/dev/null

if [[ "$BACKUP_OFFSITE_ENABLED" == "true" ]]; then
  require_command aws
  : "${BACKUP_S3_ENDPOINT_URL:?Set BACKUP_S3_ENDPOINT_URL in $BACKUP_ENV_FILE}"
  : "${BACKUP_S3_BUCKET:?Set BACKUP_S3_BUCKET in $BACKUP_ENV_FILE}"
  : "${BACKUP_S3_ACCESS_KEY_ID:?Set BACKUP_S3_ACCESS_KEY_ID in $BACKUP_ENV_FILE}"
  : "${BACKUP_S3_SECRET_ACCESS_KEY:?Set BACKUP_S3_SECRET_ACCESS_KEY in $BACKUP_ENV_FILE}"

  export AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION="$BACKUP_S3_REGION"

  remote_base="s3://$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX"
  log "uploading backup to $remote_base/"
  aws s3 cp "$backup_path" "$remote_base/$backup_name" \
    --endpoint-url "$BACKUP_S3_ENDPOINT_URL" \
    --only-show-errors
  aws s3 cp "$checksum_path" "$remote_base/$backup_name.sha256" \
    --endpoint-url "$BACKUP_S3_ENDPOINT_URL" \
    --only-show-errors
fi

log "pruning local backups older than $BACKUP_RETENTION_DAYS days"
find "$BACKUP_DIR" -type f \( -name '*.dump.gpg' -o -name '*.dump.gpg.sha256' \) -mtime "+$BACKUP_RETENTION_DAYS" -delete

log "backup complete: $backup_path"
