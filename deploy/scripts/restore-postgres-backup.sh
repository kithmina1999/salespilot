#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

die() {
  log "ERROR: $*"
  exit 1
}

if [[ $# -ne 1 ]]; then
  die "usage: CONFIRM_RESTORE=salespilot $0 /path/to/salespilot-postgres-YYYYMMDDTHHMMSSZ.dump.gpg"
fi

if [[ "${CONFIRM_RESTORE:-}" != "salespilot" ]]; then
  die "set CONFIRM_RESTORE=salespilot to confirm this destructive restore"
fi

BACKUP_FILE="$1"
[[ -f "$BACKUP_FILE" ]] || die "backup file does not exist: $BACKUP_FILE"

BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/salespilot/backup.env}"
if [[ -f "$BACKUP_ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$BACKUP_ENV_FILE"
fi

APP_DIR="${APP_DIR:-/opt/salespilot-v2}"
APP_ENV_FILE="${APP_ENV_FILE:-$APP_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
BACKUP_PASSPHRASE_FILE="${BACKUP_PASSPHRASE_FILE:-/etc/salespilot/backup-passphrase}"

command -v docker >/dev/null 2>&1 || die "missing required command: docker"
command -v gpg >/dev/null 2>&1 || die "missing required command: gpg"
[[ -f "$APP_ENV_FILE" ]] || die "app env file does not exist: $APP_ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || die "compose file does not exist: $COMPOSE_FILE"
[[ -f "$BACKUP_PASSPHRASE_FILE" ]] || die "backup passphrase file does not exist: $BACKUP_PASSPHRASE_FILE"

cd "$APP_DIR"

log "restoring $BACKUP_FILE into the compose postgres service"
gpg --batch --quiet --pinentry-mode loopback --decrypt --passphrase-file "$BACKUP_PASSPHRASE_FILE" "$BACKUP_FILE" \
  | docker compose --env-file "$APP_ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres sh -c \
      'pg_restore --clean --if-exists --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

log "restore complete"
