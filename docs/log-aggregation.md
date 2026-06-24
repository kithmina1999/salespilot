# Log Aggregation

Production log aggregation runs inside the Docker Compose stack:

- Loki stores logs on the VPS in the `loki_data` Docker volume.
- Grafana Alloy reads Docker container logs and pushes them to Loki.
- Grafana is pre-provisioned with Loki as the default data source.

Application containers should continue writing logs to stdout/stderr. Docker keeps
short local json-file logs for `docker compose logs`, while Alloy aggregates them
into Loki for search and retention.

Promtail is intentionally not used for new production setup because Grafana has
deprecated it and moved new collector work to Grafana Alloy.

## Access

Grafana is intentionally bound to localhost only:

```text
127.0.0.1:${GRAFANA_PORT:-3003}
```

Use an SSH tunnel from your laptop:

```bash
ssh -L 3003:127.0.0.1:3003 deploy@YOUR_VPS_IP
```

Then open:

```text
http://localhost:3003
```

Login with:

- Username: `GRAFANA_ADMIN_USER` from `.env.production`
- Password: `GRAFANA_ADMIN_PASSWORD` from `.env.production`

Do not expose Grafana publicly until we add SSL, authentication hardening, and
preferably an IP allowlist or VPN.

## Useful Queries

All SalesPilot Compose logs:

```logql
{compose_project="salespilot"}
```

Backend only:

```logql
{compose_project="salespilot", service="backend"}
```

Errors across app services:

```logql
{compose_project="salespilot", service=~"backend|frontend|admin|landing"} |= "error"
```

Structured backend errors:

```logql
{compose_project="salespilot", service="backend"} | json | level="ERROR"
```

Trace one backend request without creating a high-cardinality Loki label:

```logql
{compose_project="salespilot", service="backend"} | json | request_id="REPLACE_ME"
```

Dependency circuit transitions:

```logql
{compose_project="salespilot", service="backend"} | json | error_code="circuit_opened"
```

WhatsApp failures:

```logql
{compose_project="salespilot", service="backend"} |= "WhatsApp"
```

Deployment-related container failures:

```logql
{compose_project="salespilot"} |~ "(panic|fatal|failed|timeout|connection refused)"
```

## Retention And Disk

Loki retention is configured in `deploy/observability/loki-config.yml`:

```yaml
retention_period: 168h
```

That is 7 days. Increase only after checking VPS disk size. If the VPS is small,
keep 7 days and rely on Sentry/alerts for long-term incident history.

## VPS Notes

Alloy uses the Docker socket to discover container names and Compose service
labels. This is useful but privileged; keep the observability services on the
private Docker network and never expose the Docker socket to public traffic.

If we later buy a domain for logs, use a separate hostname such as:

```text
logs.salespilot.lk
```

Before exposing it, add:

- Nginx SSL for the logs hostname
- Basic auth or SSO
- IP allowlist or VPN-only access
- Strong `GRAFANA_ADMIN_PASSWORD`

For now, the SSH tunnel flow is the safer default.

## Checks

After deployment:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps loki alloy grafana
curl -fsSL http://127.0.0.1:3003/api/health
```

If logs are not appearing:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 alloy
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 loki
```
