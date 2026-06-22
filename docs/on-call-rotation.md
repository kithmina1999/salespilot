# On-Call Rotation

This document defines who watches SalesPilot production, how ownership changes
hands, and when another person must be involved. Use
`docs/incident-response-playbook.md` after an alert becomes an incident.

## Current Operating Mode

Choose and record one mode before every launch phase:

| Mode | Coverage | Use when |
| --- | --- | --- |
| Staging | Best effort during agreed working hours | There are no paying customers and no production data. Do not advertise an SLA. |
| Limited production | Named primary plus reachable secondary; SEV1 paging at all hours | A small number of customers are actively using the service. |
| Customer production | Weekly primary/secondary rotation; SEV1 paging at all hours | SalesPilot is relied on for live WhatsApp commerce. |

Current mode: `STAGING - CHANGE_ME before first customer launch`

Required private records:

| Record | Location |
| --- | --- |
| Primary and secondary phone numbers | Team password manager or private contact directory |
| Weekly schedule | Shared `SalesPilot On-Call` calendar |
| Provider account owners | Private copy of the incident contact matrix |
| Recovery secrets and break-glass access | Team password manager, outside the VPS |

Do not put personal phone numbers, recovery codes, or provider passwords in this
repository.

## Coverage Policy

Times use `Asia/Colombo` unless an incident note explicitly states otherwise.

| Severity | Paging window | Acknowledge | Secondary escalation | Operating expectation |
| --- | --- | ---: | ---: | --- |
| SEV1 | 24 hours in limited/customer production | 5 minutes | After 5 minutes without acknowledgement | Begin incident response within 10 minutes. |
| SEV2 | 07:00-22:00 daily | 15 minutes | After 15 minutes without acknowledgement | Begin response within 30 minutes. Escalate to SEV1 if orders, payments, or all WhatsApp replies are blocked. |
| SEV3 | Business hours | 4 business hours | At primary's discretion | Triage the same business day. |
| SEV4 | Planned work | Next planning session | None | Track as normal maintenance. |

Severity definitions and communication cadence live in
`docs/incident-response-playbook.md` and take precedence during an incident.

## Rotation Model

The rotation changes every Monday at `09:00 Asia/Colombo`. The primary owns
alerts for seven days; the secondary must be reachable and capable of taking
over. Never schedule one person as both roles.

Minimum two-person pattern:

| Rotation week | Primary | Secondary |
| --- | --- | --- |
| Week A | `CHANGE_ME_PERSON_A` | `CHANGE_ME_PERSON_B` |
| Week B | `CHANGE_ME_PERSON_B` | `CHANGE_ME_PERSON_A` |

For three or more responders, rotate the primary weekly and select the next
person in the sequence as secondary. Publish at least four weeks of schedule in
advance.

### Solo Operator Interim

A solo operator may run staging, but is not a resilient 24-hour production
rotation. Before onboarding paying customers, name a secondary who can at least:

- acknowledge alerts and contact the primary;
- access the VPS, DNS, and provider status pages;
- stop a damaging deployment or restart the existing stack;
- follow the incident and disaster-recovery runbooks;
- reach the Business Owner for customer and payment decisions.

When no secondary is available, freeze risky deployments and tell affected
customers the actual support hours. Do not claim continuous coverage that the
team cannot provide.

## Responsibilities

### Primary

- Keep the paging device charged, audible, and connected.
- Acknowledge alerts within the target window.
- Determine severity and open the incident note.
- Act as Incident Commander until explicitly handing that role over.
- Use the runbooks; ask the secondary before destructive database or DNS work.
- Send updates at the incident severity cadence.
- Record temporary fixes and create follow-up work before closing the incident.

### Secondary

- Remain reachable during the coverage window.
- Take over when the primary does not acknowledge or asks for relief.
- Provide a second set of eyes for rollback, restore, credential rotation, and
  customer-impact decisions.
- Assume primary ownership if the incident lasts more than four hours or the
  current primary is too fatigued to continue safely.

### Business Owner

- Approve customer statements, refunds, payment decisions, and security
  disclosures.
- Maintain provider ownership and emergency spending authority.
- Ensure the rotation has enough people and does not quietly become permanent
  unpaid availability for one operator.

## Alert Ownership

| Signal | First owner | Page as | First check |
| --- | --- | --- | --- |
| Public API `/health` unavailable | Primary | SEV1 after two confirmed failures | Nginx, backend health, then PostgreSQL health |
| Landing, tenant app, or admin unavailable | Primary | SEV2; SEV1 if all public surfaces fail | Nginx and the affected container |
| Meta webhook or all WhatsApp replies silent | Primary | SEV1 | Meta status, webhook signature errors, worker queue, backend logs |
| Order/payment workflow failing broadly | Primary | SEV1 | Backend logs, PostgreSQL, PayHere or media provider status |
| Elevated frontend errors | Primary | SEV2 or SEV3 by customer impact | Sentry release and recent deploy |
| Critical Discord application alert | Primary | Assess immediately | Linked business, pipeline logs, provider health |
| Database backup failed | Primary | SEV2 if no valid backup within 24 hours; otherwise SEV3 | Backup systemd unit, disk space, offsite upload |
| Disk, memory, or container health warning | Primary | SEV2 if service risk is immediate; otherwise SEV3 | VPS resources and `docker compose ps` |

Until an alert source has automatic paging, the primary must check it at the
start and end of each coverage day. Uptime, Sentry, Discord, and backup failure
signals are not considered operationally complete until a test notification has
reached both primary and secondary devices.

## Handoff

The outgoing primary posts a handoff by Sunday `18:00`. The incoming primary
acknowledges it before Monday `09:00`.

Handoff template:

```text
Rotation window:
Outgoing primary:
Incoming primary:
Secondary:
Open incidents:
Recent deployments and image tag:
Known degraded providers:
Last successful database backup:
Offsite backup verified at:
Open high-risk changes or migrations:
Muted alerts and expiry time:
Customer commitments due this week:
```

Incoming-primary checklist:

- Confirm SSH, `sudo`, Docker, Grafana tunnel, and provider dashboard access.
- Confirm the paging device receives a test alert.
- Read unresolved incident actions and recent deployment notes.
- Confirm the latest local and offsite database backups exist.
- Check certificate expiry and VPS disk space.
- Reject the handoff if access is missing or an alert is muted without an owner
  and expiry time.

## Swap And Unavailability Rules

- Arrange swaps at least 48 hours ahead when possible.
- Record the swap in the shared calendar and have the replacement acknowledge.
- The outgoing person remains primary until that acknowledgement exists.
- A person who handled a SEV1 overnight should not remain primary for the next
  working day without explicit relief.
- After four continuous incident hours, transfer Incident Commander or
  Technical Lead duties to a rested responder.
- Never make production changes while impaired, dangerously tired, or without a
  second reviewer for destructive operations.

## Escalation Path

1. Primary acknowledges and classifies the alert.
2. Secondary is paged automatically on missed acknowledgement or manually when
   severity is SEV1, data integrity is uncertain, or a destructive action is
   being considered.
3. Business Owner joins for customer communication, payments, refunds, legal,
   security, or spending decisions.
4. Provider support is engaged using the contact matrix in the incident
   playbook.
5. External security or database help is engaged when the team cannot bound the
   risk safely.

## Rotation Readiness Checklist

Complete this before changing the operating mode from staging:

- [ ] Primary and secondary are named for the next four weeks.
- [ ] Both can receive and acknowledge test pages.
- [ ] Both have MFA-protected VPS, DNS, Meta, backup, and observability access.
- [ ] Both have read the deployment, incident, and disaster-recovery runbooks.
- [ ] A restore drill has been completed and recorded.
- [ ] Alert routes have no placeholder destinations.
- [ ] Provider and customer escalation contacts are current.
- [ ] Support hours and any SLA shown to customers match real coverage.

## Review And Metrics

Review the rotation monthly and after every SEV1 or SEV2. Track:

- page acknowledgement time;
- time to mitigation and resolution;
- pages per person per week;
- false-positive and duplicate pages;
- incidents first reported by customers;
- after-hours pages and interrupted sleep;
- handoffs rejected because access or context was missing.

Repeated noisy pages are reliability work, not an expected cost of being
on-call. Assign an owner and due date to fix or remove each unactionable alert.

## Related Runbooks

- `docs/architecture.md`
- `docs/incident-response-playbook.md`
- `docs/deployment-runbook.md`
- `docs/disaster-recovery.md`
- `docs/log-aggregation.md`
- `docs/database-backups.md`
