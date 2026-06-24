# Production Error Handling

This document defines the implemented timeout, retry, circuit-breaker,
correlation, structured-logging, and backend error-reporting behavior.

## Status

| Capability | Status | Implementation |
| --- | --- | --- |
| External request deadlines | Complete | `backend/httpclient` applies one total operation budget, including retries. |
| Request cancellation | Complete for request-driven provider calls | Gin request contexts reach handler calls; webhook work uses detached, bounded contexts after acknowledgement. |
| Exponential retry | Complete for explicitly repeatable operations | Maximum three attempts, jitter, capped delay, and `Retry-After`. |
| Circuit breakers | Complete | One breaker per dependency with a half-open probe. |
| Correlation IDs | Complete | `X-Request-ID`, JSON logs, async webhook context, and debug pipeline records. |
| Structured logs | Complete | Production uses JSON `slog`; legacy `log.Printf` output is bridged into JSON. |
| Backend error aggregation | Complete for launch | Loki stores all events; repeated critical events are deduplicated before Discord notification. |

## Dependency Budgets

The timeout is an overall budget. Retries do not receive a fresh timeout, so a
three-attempt operation cannot silently become a 90-second request.

| Dependency | Total budget | Retry behavior |
| --- | ---: | --- |
| Gemini | 30 seconds | Explicit AI generation, embedding, and analysis operations may retry transient failures. |
| Meta | 15 seconds | GET/read and credential inspection may retry. Message sends and webhook subscription do not retry. |
| Cloudinary | 30 seconds | Uploads do not retry without a deterministic idempotency design. |
| Resend | 10 seconds | Email sends do not retry to avoid duplicate messages. |
| Discord | 5 seconds | Alerts do not retry or recursively report their own delivery failure. |
| Unknown external dependency | 30 seconds | GET/HEAD/OPTIONS may retry; mutations do not. |

The transport also uses bounded connection, TLS handshake, response-header, and
idle-connection settings.

## Retry Policy

Repeatable operations use at most three attempts.

- Initial delay: `250ms`.
- Delay doubles after each failed attempt.
- Delay is capped at `2s`.
- Random jitter is plus or minus 25 percent.
- A valid provider `Retry-After` header takes precedence.
- Sleep ends immediately when the operation context is canceled or expires.
- Response bodies are drained and closed before retrying.
- A request body must be replayable before a retry is allowed.

Transient failures are:

- network errors;
- context deadline expiration;
- HTTP `408`, `429`, `500`, `502`, `503`, or `504`.

Authentication, validation, permission, and other `4xx` responses are not
retried and do not count as dependency outages.

## Circuit Breakers

Each dependency has an independent in-process breaker:

1. Five consecutive transient failures open the breaker.
2. The breaker rejects new calls for 30 seconds.
3. After 30 seconds, one half-open probe is allowed.
4. A successful probe closes the breaker and resets failures.
5. A failed probe opens it for another 30 seconds.

Only transient dependency failures affect circuit state. A tenant's expired Meta
token therefore cannot open the global Meta breaker.

Circuit state is process-local, matching the current single-backend production
architecture. A multi-replica deployment should move state or health signaling
to a shared resilience layer.

## Correlation

`middleware.RequestContext` validates an incoming `X-Request-ID` containing up
to 64 letters, numbers, dots, underscores, or hyphens. Invalid or absent values
are replaced with a UUID. The ID is:

- returned in the `X-Request-ID` response header;
- stored in the Go request context;
- attached to request and dependency logs;
- preserved when webhook processing detaches from the HTTP request;
- stored with Meta message IDs in debug `PipelineLog` records;
- returned in panic responses.

Never use `request_id` as a Loki label. It has high cardinality. Parse it as a
JSON field during a targeted query.

## Structured Logging

Production configuration:

```env
APP_ENV=production
APP_RELEASE=GIT_SHA_OR_IMAGE_TAG
LOG_FORMAT=json
LOG_LEVEL=info
```

Every backend log line includes `service`, `environment`, and `release`.
Request and dependency logs add fields such as:

- `request_id`
- `business_id`
- `route`
- `status`
- `duration_ms`
- `dependency`
- `operation`
- `attempt`
- `error_code`

Existing standard-library logs are wrapped with `legacy_log=true`. New code
should use `observability.Logger(ctx)` and structured attributes.

The logger redacts attributes named `access_token`, `api_key`, `authorization`,
`cookie`, `jwt`, `otp`, `password`, `secret`, or `token`.

Do not log:

- access tokens, API keys, passwords, OTPs, cookies, or authorization headers;
- raw customer messages, bot replies, email addresses, or phone numbers;
- payment proof contents or provider request/response bodies;
- full external URLs when query parameters may contain credentials.

## Error Aggregation

The backend reports these classes centrally:

- recovered panics;
- HTTP `5xx` responses;
- exhausted dependency resilience policies;
- dependency circuit-open transitions.

All events remain in Loki. The error reporter places critical events into a
bounded queue, creates a safe fingerprint from error class and operation, and
sends the first occurrence to the critical Discord channel. Identical events
are suppressed for five minutes to avoid an alert storm.

Only these fields may enter Discord reports:

- `request_id`
- `business_id`
- `dependency`
- `operation`
- `error_code`
- `route`
- `status`

The reporter interface is provider-independent. A Sentry Go adapter can be
added later for longer retention and issue grouping without changing handlers,
middleware, or the dependency module.

## Loki Queries

Backend errors:

```logql
{compose_project="salespilot", service="backend"} | json | level="ERROR"
```

One request:

```logql
{compose_project="salespilot", service="backend"} | json | request_id="REPLACE_ME"
```

Dependency retries:

```logql
{compose_project="salespilot", service="backend"} | json | msg="retrying transient dependency failure"
```

Open circuits:

```logql
{compose_project="salespilot", service="backend"} | json | error_code="circuit_opened"
```

Legacy logs still needing migration:

```logql
{compose_project="salespilot", service="backend"} | json | legacy_log="true"
```

## Verification

Before launch:

1. Set `LOG_FORMAT=json` and an immutable `APP_RELEASE`.
2. Call `/health` with `X-Request-ID: production-smoke-test` and verify the same
   response header and Loki field.
3. Trigger a safe staging `500` and verify one critical Discord alert arrives
   without customer data.
4. Repeat the same failure and verify it is suppressed during the cooldown.
5. Test a retryable fake dependency response and verify attempts stop at three.
6. Test an unsafe Meta-send failure and verify only one send attempt occurs.
7. Search Loki for tokens, OTP labels, emails, and test phone numbers before
   allowing production traffic.

## Related Documentation

- `docs/environment-variables.md`
- `docs/log-aggregation.md`
- `docs/architecture.md`
- `docs/incident-response-playbook.md`
- `docs/on-call-rotation.md`
