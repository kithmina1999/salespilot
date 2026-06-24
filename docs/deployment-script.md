# Deployment Script

`deploy/scripts/deploy-production.sh` deploys the production stack and verifies it before declaring success.

For the full end-to-end VPS procedure, start with `docs/deployment-runbook.md`.

It performs:

- Docker/Compose preflight checks
- Optional Nginx config check with `nginx -t`
- Optional pre-deploy database backup
- Docker Compose rebuild/recreate
- Container health checks for `postgres`, `redis`, `backend`, `frontend`, `admin`, `landing`, `loki`, `alloy`, and `grafana`
- Local URL checks against `127.0.0.1`
- Optional public HTTPS checks through Nginx

## Requirements

On Ubuntu 22.04/24.04:

```bash
sudo apt install -y curl
```

Docker, Docker Compose, Nginx, and the backup timer should already be installed
by the main VPS deployment flow.

## Install

On the VPS:

```bash
sudo install -d -m 700 /etc/salespilot
sudo cp deploy/deploy.env.example /etc/salespilot/deploy.env
sudo chmod 600 /etc/salespilot/deploy.env
sudo chmod +x deploy/scripts/deploy-production.sh
```

Edit `/etc/salespilot/deploy.env` for the real VPS.

## Run

```bash
cd /opt/salespilot-v2
sudo /bin/bash deploy/scripts/deploy-production.sh
```

Before DNS, Nginx, or SSL are ready, set:

```bash
CHECK_PUBLIC_HEALTH=false
```

in `/etc/salespilot/deploy.env`.

Before database backups are installed, also set:

```bash
RUN_PRE_DEPLOY_BACKUP=false
```

## Important Settings

| Variable | Default | Notes |
| --- | --- | --- |
| `APP_DIR` | `/opt/salespilot-v2` | Repo path on the VPS. |
| `APP_ENV_FILE` | `/opt/salespilot-v2/.env.production` | Docker Compose env file. Do not source it. |
| `COMPOSE_FILE` | `/opt/salespilot-v2/docker-compose.prod.yml` | Production Compose file. |
| `DEPLOY_STRATEGY` | `compose` | `compose` always runs `up -d --build`; `systemd` uses `salespilot.service`. |
| `RUN_PRE_DEPLOY_BACKUP` | `true` | Runs `salespilot-db-backup.service` or `backup-postgres.sh` before deploy. |
| `CHECK_NGINX` | `true` | Runs `nginx -t` when Nginx is installed. |
| `CHECK_PUBLIC_HEALTH` | `true` | Disable until DNS/SSL are ready. |
| `HEALTH_TIMEOUT_SECONDS` | `240` | Max wait for container and URL checks. |

## Health URLs

Local checks:

```text
http://127.0.0.1:8080/health
http://127.0.0.1:3000
http://127.0.0.1:3001
http://127.0.0.1:3002
http://127.0.0.1:3003/api/health
```

Public checks:

```text
https://api.salespilot.lk/health
https://app.salespilot.lk
https://admin.salespilot.lk
https://salespilot.lk
```

If ports or domains change, update `/etc/salespilot/deploy.env` and `deploy/nginx/salespilot.ssl.conf`.

Grafana/log aggregation stays local-only by default. Access it with:

```bash
ssh -L 3003:127.0.0.1:3003 deploy@YOUR_VPS_IP
```
