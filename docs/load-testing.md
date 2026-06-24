# Load Testing

SalesPilot includes a small standard-library Go load test tool:

```text
backend/cmd/loadtest
```

It is intentionally dependency-free so we do not need k6, Artillery, wrk, or hey
installed on the VPS or dev machine.

## Target

Production-readiness target:

- 100 concurrent virtual users
- Less than 1% failed requests
- `p95` latency under 1 second for `/health`
- No container crash loops
- No database connection exhaustion

For authenticated dashboard/API flows, choose a realistic endpoint-specific
threshold after a staging baseline. Some AI/image/provider-backed endpoints will
naturally be slower and should not share the `/health` threshold.

## Safety Rules

Do not run 100-user load tests against production unless:

- You have explicit approval.
- You have a rollback window.
- You are watching logs.
- You are not testing destructive write endpoints.

Default target should be local or staging.

## Harness Verification

From the backend module:

```bash
cd backend
go test ./cmd/loadtest
```

This test starts an in-memory HTTP server and verifies the tool can drive 100
concurrent requests.

## Baseline API Health Test

Start the app locally or deploy to staging first. Then run:

```bash
cd backend
go run ./cmd/loadtest \
  --url http://127.0.0.1:8080/health \
  --vus 100 \
  --duration 2m \
  --timeout 30s \
  --expect-status 200 \
  --max-error-rate 0.01 \
  --max-p95 1s
```

For staging:

```bash
cd backend
go run ./cmd/loadtest \
  --url https://api.staging.salespilot.lk/health \
  --vus 100 \
  --duration 2m \
  --timeout 30s \
  --expect-status 200 \
  --max-error-rate 0.01 \
  --max-p95 1s
```

## Authenticated API Test

Use a staging tenant token only. Do not paste production tenant tokens into
shared logs or screenshots.

```bash
cd backend
go run ./cmd/loadtest \
  --url https://api.staging.salespilot.lk/api/v1/dashboard/stats \
  --header "Authorization: Bearer STAGING_JWT" \
  --vus 100 \
  --duration 2m \
  --timeout 30s \
  --expect-status 200 \
  --max-error-rate 0.01 \
  --max-p95 2s
```

Good candidate read endpoints:

- `/health`
- `/api/v1/dashboard/stats`
- `/api/v1/orders`
- `/api/v1/products`
- `/api/v1/settings/business`

Avoid load testing these write/provider endpoints without a staging data plan:

- WhatsApp webhook POST
- order creation
- payment proof upload
- product image upload
- AI generation/translation
- PayHere notify

## Reading Results

Example output:

```text
Load test summary
  requests: 12000 total, 12000 success, 0 failed
  elapsed:  2m0s
  rps:      100.00
  errors:   0.00%
  latency:  min=3ms p50=12ms p95=88ms p99=140ms max=300ms
  status codes:
    200: 12000
```

Pass criteria for the 100-user baseline:

- `failed` is `0`, or error rate is under `1%`
- `p95` is under the configured threshold
- status codes are expected
- backend logs do not show DB connection exhaustion
- Postgres logs do not show connection errors
- containers remain healthy

## Watch During Test

In another shell:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
```

Grafana LogQL:

```logql
{compose_project="salespilot", service="backend"} |~ "(error|failed|timeout|database|too many connections)"
```

Check local resources on the VPS:

```bash
docker stats
df -h
```

## Reporting Template

Record each run:

```text
Date:
Target:
Commit/image tag:
Endpoint:
VUs:
Duration:
Total requests:
RPS:
Failure rate:
p50:
p95:
p99:
Max:
Result: pass/fail
Notes:
```

## Launch Gate

Before launch with real customers:

- `go test ./cmd/loadtest` passes.
- 100-user `/health` test passes against staging or final VPS.
- One authenticated read endpoint test passes against staging or final VPS.
- No app/database containers restart during the test.
- Any bottleneck has an issue filed before launch.
