# Incident Response Playbook

Use this playbook when SalesPilot has a production incident.

Related docs:

- `docs/on-call-rotation.md` for alert ownership, coverage, and handoff
- `docs/architecture.md` for runtime dependencies and request flows
- `docs/error-handling.md` for correlation IDs, dependency retries, circuits, and error queries
- `docs/disaster-recovery.md` for database restore, total VPS rebuild, and security recovery
- `docs/deployment-runbook.md` for normal deploy and rollback flow
- `docs/log-aggregation.md` for Grafana/Loki log queries
- `docs/database-backups.md` for backup and restore details

## Goals

During an incident, optimize for:

1. Protecting customer data.
2. Restoring critical service.
3. Communicating clearly.
4. Preserving enough evidence to understand what happened.
5. Preventing recurrence.

Do not optimize for perfect diagnosis before mitigation. If rollback or provider
failover is the safest path, do that first and investigate after service is stable.

## Severity Levels

| Severity | Definition | Examples | Response target | Update cadence |
| --- | --- | --- | --- | --- |
| SEV1 | Critical outage, data loss risk, security incident, or payments/orders blocked for most users. | API down, database unavailable, bad migration, leaked secret, Meta webhook fully silent. | Start within 10 minutes. | Every 15 minutes until mitigated. |
| SEV2 | Major degradation affecting important workflows or a subset of users. | WhatsApp replies delayed, payment proof upload failing, admin dashboard unavailable, Gemini outage causing fallback replies. | Start within 30 minutes. | Every 30-60 minutes. |
| SEV3 | Minor degradation with workaround. | One report job failing, Sentry noise, non-critical email issue. | Same business day. | At start and resolution. |
| SEV4 | Low-risk issue or investigation. | Documentation issue, isolated warning, cosmetic deploy concern. | Planned work. | No incident cadence required. |

Escalate severity when:

- Customer data may be lost, corrupted, or exposed.
- Payments, order creation, or WhatsApp messaging are blocked.
- The incident has lasted longer than expected.
- The blast radius is unclear.
- You need help from a provider or another owner.

## Roles

For a small team, one person may hold multiple roles. Still name the roles in the
incident notes so decision-making is clear.

| Role | Responsibility |
| --- | --- |
| Incident Commander | Owns severity, coordination, decisions, and closure. |
| Technical Lead | Diagnoses and applies fixes or rollback. |
| Communications Lead | Sends merchant/customer/internal updates. |
| Scribe | Records timeline, commands, decisions, and links. |
| Business Owner | Approves customer-facing statements, refunds, and security disclosures. |

Solo mode:

- First 10 minutes: act as Incident Commander and Technical Lead.
- After mitigation starts: write down timeline notes.
- If customers are affected: switch briefly into Communications Lead every cadence interval.

## Contact Matrix

Fill this before launch.

| Contact | Owner | Where |
| --- | --- | --- |
| VPS provider login | CHANGE_ME | CHANGE_ME |
| DNS provider login | CHANGE_ME | CHANGE_ME |
| Meta Business admin | CHANGE_ME | CHANGE_ME |
| PayHere admin | CHANGE_ME | CHANGE_ME |
| Cloudinary admin | CHANGE_ME | CHANGE_ME |
| Resend admin | CHANGE_ME | CHANGE_ME |
| Sentry admin | CHANGE_ME | CHANGE_ME |
| R2/S3 backup bucket admin | CHANGE_ME | CHANGE_ME |
| Emergency customer support contact | CHANGE_ME | CHANGE_ME |

## Detection Sources

Expected signals:

- Uptime monitor alerts, once configured
- Sentry frontend errors, once DSNs are enabled
- Discord operational alerts
- Grafana/Loki logs
- `docker compose ps` health
- Meta webhook/dashboard errors
- PayHere/Resend/Cloudinary provider dashboards
- Merchant or customer reports

If the first report comes from a customer, assume monitoring missed something and
create a follow-up task to close that detection gap.

## Incident Start Checklist

Create an incident note immediately:

```text
Incident ID: YYYY-MM-DD-short-title
Severity: SEV?
Started at: YYYY-MM-DD HH:MM UTC
Detected by:
Incident Commander:
Technical Lead:
Communications Lead:
Customer impact:
Current hypothesis:
Next update due:
```

Run initial checks:

```bash
cd /opt/salespilot-v2
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -I https://api.salespilot.lk/health
curl -I https://app.salespilot.lk
curl -I https://admin.salespilot.lk
curl -I https://salespilot.lk
sudo systemctl status nginx --no-pager
sudo systemctl status salespilot --no-pager
```

Capture logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 postgres
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 redis
```

If Grafana is reachable:

```logql
{compose_project="salespilot"} |~ "(panic|fatal|failed|timeout|connection refused|database|Meta API|Gemini)"
```

## Safety Rules

Do not run:

```bash
docker compose down -v
```

Do not:

- Delete Docker volumes manually.
- Rotate secrets without recording which systems need redeploy.
- Restore the database while app writers are running.
- Keep retrying a destructive command after failure.
- Publicly expose Grafana during an incident.
- Debug live customer data in screenshots or public channels.

If data is at risk, take a fresh encrypted backup before repair when possible:

```bash
sudo systemctl start salespilot-db-backup.service
journalctl -u salespilot-db-backup.service -n 100 --no-pager
```

## Triage Decision Tree

1. Is there suspected data exposure, data loss, or credential compromise?
   - Yes: classify SEV1 and use `docs/disaster-recovery.md` security procedure.
   - No: continue.
2. Are most public endpoints down?
   - Yes: check Nginx, Docker, VPS, and DNS.
   - No: continue.
3. Is API `/health` failing?
   - Yes: check backend, Postgres, Redis, env, and recent deploy.
   - No: continue.
4. Is only WhatsApp affected?
   - Yes: check Meta credentials, webhook, backend logs, and tenant tokens.
   - No: continue.
5. Is only AI/image/reporting affected?
   - Yes: check Gemini, Cloudinary, and timeout/fallback behavior.
   - No: continue.
6. Is only payment/subscription affected?
   - Yes: check PayHere, payment proof upload, activation code/email path.
   - No: continue with provider-specific checks.

## Common Response Procedures

### API Or Backend Down

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps backend postgres redis
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 backend
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 postgres
```

If caused by a bad deploy:

```bash
cd /opt/salespilot-v2
git log --oneline -n 10
git checkout PREVIOUS_GOOD_COMMIT
sudo /bin/bash deploy/scripts/deploy-production.sh
```

If caused by database corruption or missing data, switch to
`docs/disaster-recovery.md`.

### Frontend, Admin, Or Landing Down

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps frontend admin landing
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=160 frontend
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=160 admin
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=160 landing
```

Check Nginx:

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
```

If browser app is stale after env changes, rebuild the affected Next.js image.

### WhatsApp Silent Or Delayed

Check:

- Backend logs for Meta API status codes.
- Meta webhook URL: `https://api.salespilot.lk/api/whatsapp/webhook`
- `META_VERIFY_TOKEN`
- `META_APP_SECRET`
- Tenant token and phone number ID.
- Meta app permission: `whatsapp_business_messaging`
- Worker queue/backpressure warnings.

Commands:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=300 backend
curl -I https://api.salespilot.lk/health
```

Customer impact language should say "WhatsApp automation is delayed" rather than
"SalesPilot is down" if dashboard/API still work.

### Database Issue

Check:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps postgres
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200 postgres
df -h
```

If Postgres is running but data is wrong, stop and use the database restore
procedure in `docs/disaster-recovery.md`.

### Payment Or Activation Issue

Check:

- PayHere credentials and sandbox/live mode.
- PayHere notify URL.
- Backend logs around billing/payment handlers.
- Resend activation email behavior.
- Admin proof approval flow.

Commands:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=250 backend
curl -I https://api.salespilot.lk/health
```

If payments are duplicated or incorrectly activated, classify as SEV1 or SEV2
depending on customer impact and preserve database evidence.

### Gemini Or AI Degradation

Check:

- `GEMINI_API_KEY`
- quota/billing/provider status
- backend logs for timeout/errors
- fallback replies

If core order flow still works, this is usually SEV2. If the bot cannot answer
at all and merchants depend on it live, escalate to SEV1.

### Log Aggregation Down

Log aggregation down is usually SEV3 unless it blocks another investigation.

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps loki alloy grafana
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 loki
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100 alloy
curl -fsSL http://127.0.0.1:3003/api/health
```

Use `docker compose logs` directly while Grafana is unavailable.

## Communications

Default cadence:

- SEV1: every 15 minutes until mitigated.
- SEV2: every 30-60 minutes.
- SEV3: start and resolution.

Internal update template:

```text
Status: investigating | identified | mitigating | monitoring | resolved
Severity:
Impact:
Started:
Current finding:
Action underway:
Next update:
Owner:
```

Merchant/customer initial update:

```text
We are investigating an issue affecting [feature/service]. Some users may see [impact].
We are working on it now and will share the next update by [time].
```

Merchant/customer mitigation update:

```text
We have identified the issue affecting [feature/service] and are applying a fix.
Current impact: [impact]. Next update by [time].
```

Resolution update:

```text
The issue affecting [feature/service] is resolved. Impact window: [start]-[end].
We are monitoring and will follow up if any user action is required.
```

Security/data incident update must be approved by the Business Owner before any
external message is sent.

## Escalation

Escalate immediately when:

- Data exposure or credential compromise is suspected.
- Database restore may be needed.
- Payment/order data may be incorrect.
- A provider outage blocks core functionality.
- Incident is SEV1 and not mitigated within 30 minutes.
- You are uncertain whether a command is destructive.

Escalation paths:

| Area | Escalate to |
| --- | --- |
| VPS/network | VPS provider support |
| DNS | DNS provider support |
| WhatsApp | Meta Business support / app admin |
| Payments | PayHere support / merchant owner |
| Email | Resend dashboard/support |
| Images/media | Cloudinary dashboard/support |
| AI | Gemini/Google AI Studio dashboard/support |
| Backups | R2/S3 provider support |
| Security | Business Owner and external security help if needed |

## Incident Closure Criteria

Close an incident only when:

- Customer-facing impact is gone.
- Health checks pass.
- Logs show no repeated crash loop or error spike.
- Any rollback/restore is complete.
- Data integrity checks are complete for affected workflows.
- Customer/internal resolution update was sent if needed.
- Follow-up actions are recorded.

Closure note:

```text
Resolved at:
Final severity:
Impact window:
Root cause summary:
Mitigation:
Customer impact:
Follow-up issues:
Owner:
```

## Post-Incident Review

Create a review within:

- 24 hours for SEV1
- 3 business days for SEV2
- Optional for SEV3

Post-incident template:

```text
# Incident Review: YYYY-MM-DD short title

Severity:
Impact:
Started:
Detected:
Mitigated:
Resolved:
Detection source:

## Timeline
- HH:MM Event

## Root Cause

## What Went Well

## What Went Poorly

## Customer Impact

## Data Impact

## Follow-Up Actions
| Action | Owner | Due |
| --- | --- | --- |

## Prevention
```

Follow-up actions should become issues/tasks, not live only in the review doc.

## Launch Readiness For Incident Response

Before real customer launch:

- Fill the contact matrix.
- Configure uptime monitoring.
- Confirm Discord alert webhooks.
- Enable Sentry when DSNs are available.
- Confirm Grafana logs are searchable.
- Confirm offsite database backups.
- Run one restore drill.
- Decide who can approve customer-facing incident messages.
- Decide where incident notes live.
