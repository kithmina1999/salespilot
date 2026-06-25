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

is_true() {
  case "${1:-}" in
    true | TRUE | 1 | yes | YES | y | Y) return 0 ;;
    *) return 1 ;;
  esac
}

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-/etc/salespilot/deploy.env}"
if [[ -f "$DEPLOY_ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$DEPLOY_ENV_FILE"
else
  log "deploy env file not found at $DEPLOY_ENV_FILE; using script defaults"
fi

APP_DIR="${APP_DIR:-/opt/salespilot-v2}"
APP_ENV_FILE="${APP_ENV_FILE:-$APP_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.prod.yml}"
DEPLOY_STRATEGY="${DEPLOY_STRATEGY:-compose}"
SYSTEMD_SERVICE="${SYSTEMD_SERVICE:-salespilot}"
RUN_PRE_DEPLOY_BACKUP="${RUN_PRE_DEPLOY_BACKUP:-true}"
BACKUP_SERVICE="${BACKUP_SERVICE:-salespilot-db-backup.service}"
BACKUP_ENV_FILE="${BACKUP_ENV_FILE:-/etc/salespilot/backup.env}"
REQUIRED_SERVICES="${REQUIRED_SERVICES:-postgres redis backend frontend admin landing loki alloy grafana}"
LOCAL_HEALTH_URLS="${LOCAL_HEALTH_URLS:-http://127.0.0.1:8080/health http://127.0.0.1:3000 http://127.0.0.1:3001 http://127.0.0.1:3002 http://127.0.0.1:3003/api/health}"
CHECK_PUBLIC_HEALTH="${CHECK_PUBLIC_HEALTH:-true}"
PUBLIC_HEALTH_URLS="${PUBLIC_HEALTH_URLS:-https://api.salespilot.lk/health https://app.salespilot.lk https://admin.salespilot.lk https://salespilot.lk}"
CHECK_NGINX="${CHECK_NGINX:-true}"
RUN_DATABASE_MIGRATIONS="${RUN_DATABASE_MIGRATIONS:-true}"
MIGRATION_SERVICE="${MIGRATION_SERVICE:-migrate}"
HEALTH_TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-240}"
HEALTH_INTERVAL_SECONDS="${HEALTH_INTERVAL_SECONDS:-5}"
CURL_MAX_TIME_SECONDS="${CURL_MAX_TIME_SECONDS:-10}"

compose() {
  docker compose --env-file "$APP_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

print_failure_context() {
  log "docker compose ps"
  compose ps || true
  log "recent compose logs"
  compose logs --tail=160 || true
}

preflight() {
  require_command docker
  require_command curl

  [[ -d "$APP_DIR" ]] || die "APP_DIR does not exist: $APP_DIR"
  [[ -f "$APP_ENV_FILE" ]] || die "APP_ENV_FILE does not exist: $APP_ENV_FILE"
  [[ -f "$COMPOSE_FILE" ]] || die "COMPOSE_FILE does not exist: $COMPOSE_FILE"

  cd "$APP_DIR"

  if command -v git >/dev/null 2>&1 && [[ -d .git ]]; then
    log "deploying git commit $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  fi

  docker info >/dev/null 2>&1 || die "docker daemon is not available"
  compose config --quiet

  if command -v grep >/dev/null 2>&1 && grep -Eq 'REPLACE_WITH_|CHANGE_ME' "$APP_ENV_FILE"; then
    log "warning: $APP_ENV_FILE still contains placeholder-looking values"
  fi

  if is_true "$CHECK_NGINX"; then
    if command -v nginx >/dev/null 2>&1; then
      nginx -t
    else
      log "nginx not found; skipping nginx config check"
    fi
  fi
}

run_pre_deploy_backup() {
  if ! is_true "$RUN_PRE_DEPLOY_BACKUP"; then
    log "pre-deploy backup disabled"
    return
  fi

  log "running pre-deploy database backup"
  if command -v systemctl >/dev/null 2>&1 && systemctl cat "$BACKUP_SERVICE" >/dev/null 2>&1; then
    systemctl start "$BACKUP_SERVICE"
    return
  fi

  if [[ -f "$APP_DIR/deploy/scripts/backup-postgres.sh" ]]; then
    BACKUP_ENV_FILE="$BACKUP_ENV_FILE" /bin/bash "$APP_DIR/deploy/scripts/backup-postgres.sh"
    return
  fi

  die "backup enabled, but neither $BACKUP_SERVICE nor backup-postgres.sh is available"
}

wait_for_services() {
  local deadline all_ok svc cid state health
  local -a services statuses
  services=("$@")
  deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))

  log "waiting for container health: ${services[*]}"
  while (( SECONDS < deadline )); do
    all_ok=true
    statuses=()

    for svc in "${services[@]}"; do
      cid="$(compose ps -q "$svc" 2>/dev/null || true)"
      if [[ -z "$cid" ]]; then
        all_ok=false
        statuses+=("$svc=missing")
        continue
      fi

      state="$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || echo unknown)"
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid" 2>/dev/null || echo unknown)"

      if [[ "$health" == "healthy" || ( "$health" == "none" && "$state" == "running" ) ]]; then
        statuses+=("$svc=ok")
      else
        all_ok=false
        statuses+=("$svc=$state/$health")
      fi
    done

    if [[ "$all_ok" == "true" ]]; then
      log "containers healthy"
      return
    fi

    log "waiting: ${statuses[*]}"
    sleep "$HEALTH_INTERVAL_SECONDS"
  done

  print_failure_context
  die "containers did not become healthy within ${HEALTH_TIMEOUT_SECONDS}s"
}

run_database_migrations() {
  if ! is_true "$RUN_DATABASE_MIGRATIONS"; then
    log "database migrations disabled"
    return
  fi

  cd "$APP_DIR"
  log "starting postgres for database migrations"
  compose up -d --build postgres
  wait_for_services postgres

  log "building migration image"
  compose build "$MIGRATION_SERVICE"

  log "running database migrations"
  compose run --rm --no-deps "$MIGRATION_SERVICE"
}

deploy_stack() {
  cd "$APP_DIR"
  log "deploying stack using strategy: $DEPLOY_STRATEGY"

  case "$DEPLOY_STRATEGY" in
    compose)
      compose up -d --build --remove-orphans
      ;;
    systemd)
      require_command systemctl
      if systemctl is-active --quiet "$SYSTEMD_SERVICE"; then
        systemctl reload "$SYSTEMD_SERVICE"
      else
        systemctl start "$SYSTEMD_SERVICE"
        compose up -d --build --remove-orphans
      fi
      ;;
    *)
      die "unknown DEPLOY_STRATEGY: $DEPLOY_STRATEGY"
      ;;
  esac
}

wait_for_container_health() {
  local -a services
  read -r -a services <<< "$REQUIRED_SERVICES"
  wait_for_services "${services[@]}"
}

wait_for_urls() {
  local label urls deadline all_ok url status
  local -a url_list
  label="$1"
  urls="$2"

  read -r -a url_list <<< "$urls"
  if [[ "${#url_list[@]}" -eq 0 ]]; then
    log "no $label URLs configured"
    return
  fi

  deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
  log "checking $label URLs: ${url_list[*]}"

  while (( SECONDS < deadline )); do
    all_ok=true
    for url in "${url_list[@]}"; do
      if curl -fsSL --max-time "$CURL_MAX_TIME_SECONDS" -o /dev/null "$url"; then
        status="ok"
      else
        status="failed"
        all_ok=false
      fi
      log "$label health $url = $status"
    done

    if [[ "$all_ok" == "true" ]]; then
      log "$label URL health checks passed"
      return
    fi

    sleep "$HEALTH_INTERVAL_SECONDS"
  done

  print_failure_context
  die "$label URLs did not pass health checks within ${HEALTH_TIMEOUT_SECONDS}s"
}

main() {
  preflight
  run_pre_deploy_backup
  run_database_migrations
  deploy_stack
  wait_for_container_health
  wait_for_urls "local" "$LOCAL_HEALTH_URLS"

  if is_true "$CHECK_PUBLIC_HEALTH"; then
    wait_for_urls "public" "$PUBLIC_HEALTH_URLS"
  else
    log "public health checks disabled"
  fi

  log "deployment complete"
}

main "$@"
