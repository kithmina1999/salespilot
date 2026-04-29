# SalesPilot v2 — Super Admin Control Centre Analysis

## What You Already Have

Before adding anything, let's acknowledge what's **already wired up** in the
`/system` route group (protected by the `X-Master-Key` header via `MasterAuth`):

| Endpoint | What it does |
|---|---|
| `GET /system/metrics` | Total businesses, plan breakdown, trial count, message usage |
| `GET/POST /system/businesses` | List all tenants, create a new one |
| `GET /system/businesses/:id` | Full detail on one tenant |
| `PATCH /system/businesses/:id/plan` | Force-override any tenant's plan + expiry |
| `POST/GET/DELETE /system/activation-codes` | Generate, list, revoke activation codes |
| `GET /system/payments` | Queue of bank-transfer proof submissions |
| `POST /system/payments/:id/approve\|reject` | Approve or reject payment proofs |
| `GET/POST/PUT/DELETE /system/global-rules` | Manage platform-wide WhatsApp FAQ rules |
| `GET /system/audit-logs` | Filtered, cross-tenant audit log viewer |
| `GET /system/audit-logs/download` | CSV export of audit logs |

> [!NOTE]
> A `SuperAdminRequired()` middleware already exists in `auth_middleware.go`
> but is **not wired to any route** yet. The current protection is a raw
> `X-Master-Key` header comparison — stateless and good for an internal ops
> tool, but you'll want a proper JWT-based super-admin session for the
> eventual web UI.

---

## What's Missing — The Full Roadmap

Grouped by area of control, from highest to lowest priority for launch.

---

### 🔔 1. Platform Communications  
*"Post a notice to users"* — your top ask

#### 1a. Platform Announcement / Notice Board

Users see a banner or bell-notification inside their dashboard the next time they log in.

**Backend — new model:**
```go
type PlatformNotice struct {
    ID          uint       `gorm:"primaryKey"`
    Title       string     `json:"title"`        // "Scheduled Maintenance"
    Body        string     `json:"body"`         // Rich text / markdown
    Type        string     `json:"type"`         // "maintenance" | "feature" | "bugfix" | "warning"
    TargetPlan  string     `json:"target_plan"`  // "" = all, "free", "starter", "pro"
    StartsAt    *time.Time `json:"starts_at"`    // When to start showing it
    ExpiresAt   *time.Time `json:"expires_at"`   // Auto-hide after this
    IsPinned    bool       `json:"is_pinned"`    // Sticky / dismissible
    CreatedAt   time.Time  `json:"created_at"`
}
```

**Backend — new system routes:**
```
POST   /system/notices          → Create notice
GET    /system/notices          → List all (including expired, for history)
PATCH  /system/notices/:id      → Edit body/expiry
DELETE /system/notices/:id      → Remove early
```

**Backend — tenant route (no auth change needed):**
```
GET /api/v1/dashboard/notices   → Returns active un-expired notices for that plan
```

**Frontend:** a dismissible banner at the top of every dashboard page, colour-coded by `type`. Store dismissed IDs in `localStorage` so they don't reappear.

---

#### 1b. Targeted Email / WhatsApp Blast

Send an announcement to a specific cohort (e.g., all Growth plan users, all trial users expiring in 7 days).

**Backend — new system route:**
```
POST /system/broadcast
Body: {
  "channel": "email" | "whatsapp",
  "target": "all" | "free" | "starter" | "pro" | "trial",
  "subject": "...",
  "body": "..."
}
```
This queries businesses matching `target`, then fires your existing email or WhatsApp send service for each. **Rate-limit the loop** (e.g., 5/second) to avoid flooding Meta or your email provider.

---

### 🐛 2. In-App Bug Reporting

Users hit a "Report a Bug" button from anywhere in the dashboard.

**Backend — new model:**
```go
type BugReport struct {
    ID          uint      `gorm:"primaryKey"`
    BusinessID  uint      `gorm:"index"`
    UserID      uint
    Title       string
    Description string    `gorm:"type:text"`
    Steps       string    `gorm:"type:text"`  // Steps to reproduce
    Severity    string    // "low" | "medium" | "high" | "critical"
    PageURL     string    // Frontend sends current window.location.href
    UserAgent   string
    Status      string    `gorm:"default:'open'"` // open | investigating | resolved | wontfix
    AdminNote   string    // Super admin's reply shown back to user
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```

**Backend — tenant routes:**
```
POST   /api/v1/bugs             → Submit report
GET    /api/v1/bugs             → User's own past reports + status updates
```

**Backend — system routes:**
```
GET    /system/bugs             → All reports, filterable by status/severity/business
PATCH  /system/bugs/:id         → Change status + add admin note (shown to user)
```

**Frontend (user side):** A floating `?` button or a "Report Issue" menu item. Pre-fills `PageURL` and `UserAgent` automatically. Shows a history tab with status badges.

**Frontend (admin side):** A kanban or table view with severity badges. Changing status to `resolved` can trigger an optional WhatsApp/email notification back to the user.

---

### 🚨 3. Unusual Activity Detection

You already have a rich `AuditLog` table tagged with `risk: high | medium | low`. Build on top of it.

#### 3a. Automatic Anomaly Flags (Backend Cron)

Add to your existing `services.StartCronJobs()`:

```go
// Every hour: flag businesses with suspicious patterns
func detectAnomalies() {
    // Rule 1: > 500 messages/hour from one business (bot spam)
    // Rule 2: > 10 high-risk audit events in 24h
    // Rule 3: Multiple login failures from different IPs in 1 hour
    // Rule 4: Plan expires in 3 days but no payment submitted
    // Rule 5: Business active trial but zero WhatsApp messages sent
}
```

**New model:**
```go
type AnomalyFlag struct {
    ID          uint      `gorm:"primaryKey"`
    BusinessID  uint      `gorm:"index"`
    BusinessName string
    Type        string    // "message_spike" | "auth_bruteforce" | "payment_overdue" | "inactive_trial"
    Detail      string    `gorm:"type:text"` // JSON detail
    Severity    string    // "low" | "medium" | "high" | "critical"
    Status      string    `gorm:"default:'open'"` // open | reviewed | dismissed
    CreatedAt   time.Time
}
```

**System route:**
```
GET    /system/anomalies        → List open flags, filterable by severity/type/status
PATCH  /system/anomalies/:id    → Mark reviewed or dismissed
```

#### 3b. Business Behaviour Dashboard (UI)

A table showing **per-tenant health signals at a glance**:

| Tenant | Plan | WA Status | Msgs/Month | AI Usage % | Last Login | Flag |
|---|---|---|---|---|---|---|
| Shop A | Pro | ✅ | 4,200 | 87% | 2h ago | — |
| Shop B | Free | ❌ | 0 | 0% | 14d ago | ⚠️ Inactive |
| Shop C | Trial | ✅ | 890 | 102% | 1h ago | 🔴 Over-limit |

This is entirely derived from existing `Business` model fields — no new DB work needed for the basic version.

---

### 💰 4. Revenue & Business Intelligence

Your current `GET /system/metrics` returns raw counts. You need **trend data**.

#### Missing: Revenue Dashboard

```
GET /system/revenue
→ {
    mrr: 47500,                  // monthly recurring revenue in LKR
    arr: 570000,
    churn_rate: 4.2,             // % of paid tenants who lapsed this month
    trial_to_paid_rate: 31.5,    // % of trials that converted
    new_mrr_this_month: 8900,    // from new sign-ups
    expansion_mrr: 2980,         // from plan upgrades
    plans: { free: 42, starter: 18, pro: 7 },
    historical: [                // last 6 months MRR for the chart
        { month: "2025-11", mrr: 31200 },
        ...
    ]
  }
```

This means adding a **`RevenueSnapshot`** model that your cron records monthly (or you compute it on-the-fly from payment records).

#### Missing: Churn Early Warning

```
GET /system/churn-risk
→ List of businesses whose plan expires within 14 days
   AND who have NOT submitted a payment proof
   AND were previously paid (not free)
```

This is a pure DB query — no new model. Pairs with the **broadcast blast** above (send renewal reminders automatically).

---

### 🏥 5. Platform Health Monitor

#### Missing: System Health Dashboard

```
GET /system/health/detailed
→ {
    database: "connected",
    db_response_ms: 12,
    active_wa_connections: 18,   // count of businesses with wa_status = "connected"
    failed_webhook_deliveries_24h: 3,
    total_orders_today: 247,
    errors_last_hour: 0,
    uptime_since: "2026-04-01T00:00:00Z"
  }
```

You already have `GET /health` (simple ping). This is the **expanded version** for the admin panel only.

#### Missing: WhatsApp Health per Tenant

```
GET /system/wa-health
→ [
    { business_id: 5, name: "Shop A", wa_status: "connected", last_webhook: "2m ago" },
    { business_id: 9, name: "Shop B", wa_status: "disconnected", last_webhook: "3d ago" },
  ]
```

Derived from the `Business` model's existing `wa_status` + `connected_at` fields. Lets you proactively reach out to disconnected tenants.

---

### 🛡️ 6. Tenant Control (Trust & Safety)

#### Missing: Suspend / Ban Tenant

```
PATCH /system/businesses/:id/suspend
Body: { "reason": "Payment fraud detected", "notify": true }
```

Set a new `is_suspended` flag on `Business`. The auth middleware should reject all requests from suspended businesses with `HTTP 403 – Account suspended. Contact support.`

```go
// In Business model — add:
IsSuspended   bool   `json:"is_suspended" gorm:"default:false"`
SuspendReason string `json:"suspend_reason"`
```

#### Missing: Force-Disconnect WhatsApp

```
POST /system/businesses/:id/wa-disconnect
```

Wipes `wa_access_token`, `wa_phone_number_id`, sets `wa_status = "disconnected"`. Useful if a tenant is abusing the WhatsApp API and you need to cut them off without deleting their account.

#### Missing: Extend Trial

```
PATCH /system/businesses/:id/trial
Body: { "extend_days": 7, "reason": "User had signup issues" }
```

Updates `trial_expires_at`. Logs a `trial_extended` audit event under `super_admin` actor type.

#### Missing: Credit / Refund Days to Plan

```
POST /system/businesses/:id/credit
Body: { "days": 30, "note": "Compensating for downtime" }
```

Adds days to `plan_expires_at`. The audit log entry acts as your paper trail.

---

### 🎛️ 7. Feature Flags (Per Tenant or Per Plan)

Control rollout of new features without code deployments.

**New model:**
```go
type FeatureFlag struct {
    ID          uint   `gorm:"primaryKey"`
    Key         string `gorm:"uniqueIndex"` // e.g., "native_wa_commerce", "ai_rule_gen"
    Description string
    EnabledFor  string `gorm:"type:text"` // JSON: ["all"] or ["pro"] or [business_id:5, business_id:9]
    IsActive    bool   `gorm:"default:false"`
}
```

**System routes:**
```
GET    /system/flags            → List all flags
POST   /system/flags            → Create flag
PATCH  /system/flags/:key       → Toggle or change target audience
```

**Tenant route (cached):**
```
GET /api/v1/settings/features   → Returns { native_wa_commerce: true, ai_rule_gen: false }
```

This is one of the highest-value features for a SaaS — it lets you do **beta rollouts, emergency kills, and per-customer deals** without touching code.

---

### 🗂️ 8. Data & Compliance

#### Missing: Tenant Data Export (GDPR-style)

```
GET /system/businesses/:id/export
→ ZIP or JSON dump of all products, orders, customers, rules, messages for that tenant
```

#### Missing: Account Deletion (with Cascading Wipe)

```
DELETE /system/businesses/:id
Body: { "confirm": "DELETE", "reason": "..." }
```

Soft-deletes or hard-deletes all records for that tenant. **Requires a confirmation token** to prevent accidental wipes.

---

## Priority Build Order

| Priority | Feature | Effort | Impact |
|---|---|---|---|
| 🔴 P0 | Platform Notices + Announcement Banner | Low | High — users see it on next login |
| 🔴 P0 | Tenant Suspend / Unsuspend | Low | High — critical for abuse control |
| 🔴 P0 | Trial Extension + Plan Credit | Low | High — support tool you'll use daily |
| 🟠 P1 | In-App Bug Report | Medium | High — reduces email support volume |
| 🟠 P1 | Unusual Activity Flags (cron + UI) | Medium | High — catch abuse before it escalates |
| 🟠 P1 | Revenue Dashboard (MRR, churn) | Medium | High — you need to see your business |
| 🟡 P2 | WhatsApp health per tenant | Low | Medium — proactive support |
| 🟡 P2 | Targeted Email/WA Blast | Medium | Medium — renewal nudges |
| 🟡 P2 | Feature Flags | Medium | Medium — enables safe rollouts |
| 🟢 P3 | Force WA Disconnect | Low | Low-medium — edge case |
| 🟢 P3 | Data Export / Account Delete | High | Medium — compliance |

---

## Auth Architecture Note

> [!IMPORTANT]
> Right now the `/system` group uses a raw `X-Master-Key` header. This is fine
> for a single-operator tool where only you access it. If you ever want a
> **web-based admin UI with a login screen**, you should:
> 1. Create a `super_admins` table with hashed passwords
> 2. Issue a short-lived JWT with `role: "superadmin"` on login
> 3. Wire the existing `SuperAdminRequired()` middleware to the `/system` group
>    **in addition to** JWT validation
>
> The `SuperAdminRequired()` middleware in `auth_middleware.go` is already
> written — it just needs to be connected to routes.

---

## Admin Panel Frontend (salespilot-admin-main)

Your `/salespilot-admin-main` directory exists as a Next.js app. It needs these pages:

```
/                     → Dashboard (metrics + anomaly count + MRR widget)
/businesses           → Tenant table with search, plan badge, WA status
/businesses/:id       → Tenant detail — plan override, suspend, trial extend, credit
/notices              → Create / manage platform announcements
/bugs                 → Bug report inbox with status management
/anomalies            → Unusual activity flags
/payments             → Payment proof approval queue (already exists in backend)
/revenue              → MRR chart, churn rate, trial conversion
/audit-logs           → Cross-tenant audit log with filters
/flags                → Feature flag management
/broadcast            → Send email/WA blast to a cohort
```

Each page should be read-only by default with individual **action buttons** (approve, suspend, extend) that confirm before firing. This prevents catastrophic mistakes when you're tired at 2am 😄
