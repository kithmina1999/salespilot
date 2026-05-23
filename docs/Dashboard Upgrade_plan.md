# Dashboard Upgrade + AI Business Intelligence Report
### *(Updated with all feedback incorporated)*

---

## Summary of Changes from Feedback

| Feedback | Decision |
|---|---|
| Use Gemini AI for intelligent analysis | ✅ Gemini Flash generates smart market-aware analysis in owner's language |
| Growth % on all KPI cards | ✅ All 6 cards show +/- % vs previous 30-day period |
| Report phone = registered number | ✅ Pre-filled from `Business.Phone` (editable) |
| Move report settings to /settings | ✅ New tab/section in `/dashboard/settings` page |
| Last 3 reports downloadable | ✅ New `monthly_reports` DB table, stored as text, downloadable as PDF-like view |
| LKR currency | ✅ `Rs.` prefix everywhere |
| WhatsApp OTP at registration | ✅ Replace email OTP with WhatsApp OTP via SalesPilot's own system WA number |

---

## Part 1 — Dashboard Upgrade

### 1A. Backend: Extended Dashboard API

#### [MODIFY] [dashboard_handler.go](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/backend/handlers/dashboard_handler.go)

Extend `GetDashboardStats` to return richer data. All "current" metrics also come with a "previous period" counterpart so the frontend can calculate % change:

**New fields returned:**
```json
{
  // Revenue (current month + last month for % change)
  "revenue_this_month": 128500.00,
  "revenue_last_month": 109200.00,
  "orders_today": 4,
  "orders_this_month": 47,
  "orders_last_month": 38,
  "avg_order_value": 2734.00,
  "pending_orders": 5,

  // Order status breakdown for donut chart
  "orders_by_status": {
    "new": 5, "confirmed": 8, "shipped": 12, "delivered": 32, "cancelled": 3
  },

  // 30-day daily revenue + order count trend
  "revenue_daily_30d": [
    { "date": "2026-03-07", "revenue": 4500.00, "orders": 2 }
  ],

  // Customer growth (with previous period for % change)
  "new_customers_this_week": 12,
  "new_customers_last_week": 8,
  "total_customers_this_month": 38,
  "total_customers_last_month": 29,

  // Bot metrics (with previous period)
  "ai_resolution_rate": 87.4,
  "ai_resolution_rate_prev": 81.2,
  "bot_automation_pct": 74.1,
  "bot_automation_pct_prev": 70.5,

  // Keep existing fields
  "total_customers": 187,
  "total_products": 24,
  "total_rules": 31,
  "no_sinhala_coverage": 7,
  "top_unmatched": [...],
  "daily_stats": [...]  // existing 7-day traffic
}
```

---

### 1B. Frontend: Upgraded Dashboard Page

#### [MODIFY] [page.tsx](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/frontend/app/dashboard/page.tsx)

**Complete redesign in 4 sections:**

#### Section 1 — 6 KPI Cards with Growth Badges

Every card shows current value + a **colored growth pill** (green ▲ / red ▼) compared to the previous period:

| # | Card | Value | Period Compare |
|---|---|---|---|
| 1 | 💰 Revenue This Month | `Rs. 128,500` | vs last month |
| 2 | 📦 Orders Today | `4` | vs yesterday |
| 3 | 👥 Unique Leads | `187` | vs last month |
| 4 | ⚡ Pending Orders | `5` | clickable → `/orders?status=new` |
| 5 | 🤖 AI Resolution Rate | `87.4%` | vs prev 30d |
| 6 | ⚙️ Bot Automation | `74.1%` | vs prev 30d |

Pending orders card: amber/red alert style when > 0, click navigates to orders filtered by "new".

---

#### Section 2 — Charts Row (2:1 split)

**Left (2 cols): Revenue & Orders 30-Day Trend**
- `ComposedChart` (bars = daily revenue LKR, line = order count)
- Tab switcher: "Revenue" / "Orders" / "Both"
- Gradient fill bars in emerald, line in blue

**Right (1 col): Order Status Donut**
- `PieChart` with center label showing total orders
- Color scheme: `new`=zinc, `confirmed`=blue, `shipped`=amber, `delivered`=emerald, `cancelled`=red
- Click segment → links to `/orders?status={status}`

---

#### Section 3 — Intelligence Row (3 equal cards)

**Card 1: Customer Growth Sparkline**
- Mini 7-day area chart for new customers
- Badge: "↑ 50% vs last week" (or ↓ if negative)

**Card 2: Bot Efficiency Gauges**
- Two `RadialBarChart` arcs: Resolution Rate + Automation %
- Trend indicator and numeric value

**Card 3: Knowledge Score**
- Progress ring showing `(rules_with_coverage / total_rules) × 100`
- Red warning if < 70%
- "Add X FAQs" quick-action button

---

#### Section 4 — Missing Knowledge Feed (existing, full width polished)

Keep current feed, stretch to full width, style improvements.

---

### 1C. `recharts` Chart Types Needed (all already installed)
- `ComposedChart`, `Bar`, `Line` — for 30-day trend
- `PieChart`, `Pie`, `Cell` — for order status donut
- `RadialBarChart`, `RadialBar` — for bot efficiency

---

## Part 2 — Gemini AI Monthly Business Intelligence Report

### 2A. What the Report Does

On the **1st of every month at 6:00 AM**, for each business with `monthly_report_enabled = true`:

1. **Aggregate** previous month's raw stats (revenue, orders, customers, bot metrics, top gaps)
2. **Call Gemini Flash** with a structured prompt including:
   - Raw business stats
   - Sri Lanka economic context (e.g., exchange rate pressure, consumer spending, festive calendar)
   - Business category/industry context
   - Instruction to write in owner's `response_language` (Sinhala or English)
3. **Send via WhatsApp** to owner's `report_phone`
4. **Save** the report text to `monthly_reports` DB table

**Report Structure (WhatsApp message):**

```
📊 *SalesPilot Monthly Report — March 2026*
Saman Electronics

─────────────────────
💰 REVENUE SNAPSHOT
─────────────────────
Total: Rs. 128,500 (+17.7% vs Feb)
Orders: 47 | Avg value: Rs. 2,734
Delivered: 32 | Cancelled: 3

─────────────────────
👥 CUSTOMERS
─────────────────────
New contacts: 38 (+31% vs Feb)
Total engaged: 187

─────────────────────
🤖 BOT PERFORMANCE
─────────────────────
Resolution: 87% | Automation: 74%
AI replies: 1,240 / 1,500 (83%)

─────────────────────
🧠 AI BUSINESS ANALYSIS
─────────────────────
[Gemini-generated paragraph — written in owner's preferred language]

Example (Sinhala):
"මාර්තු මාසයේ ඔබේ ව්‍යාපාරය හොඳ වර්ධනයක් දක්වා ඇත. 
ශ්‍රී ලංකාවේ වර්තමාන ආර්ථික තත්ත්වය සහ නිරිතදිග ආසියාවේ 
e-commerce විකුණුම් ඉහළ යාම සැලකිල්ලට ගත් කල, ඔබේ 
Rs. 2,734 සාමාන්‍ය ඇණවුම් වටිනාකම ශක්තිමත් ලෙස 
පෙනේ. COD ගොනු 23 වතාවක් විමසා ඇති නිසා, COD 
සේවාව ලැයිස්තුගත කිරීමෙන් ඔබේ conversion rate 
සැලකිය යුතු ලෙස වැඩිදියුණු කළ හැකිය..."

─────────────────────
🔍 TOP KNOWLEDGE GAPS
─────────────────────
1. "cod available?" — 23x → Add FAQ
2. "colour options?" — 18x → Add FAQ  
3. "can i return?" — 11x → Add FAQ

─────────────────────
— SalesPilot AI 🧠
salespilot.lk
```

---

### 2B. Backend: New Model + Service

#### [MODIFY] [business.go](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/backend/models/business.go)

Add 2 fields:
```go
MonthlyReportEnabled bool   `json:"monthly_report_enabled" gorm:"default:true"`
ReportPhone          string `json:"report_phone"`  // defaults to Phone if empty
```

#### [NEW] [monthly_report.go](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/backend/models/monthly_report.go)

```go
type MonthlyReport struct {
    ID         uint      `json:"id" gorm:"primaryKey"`
    BusinessID uint      `json:"business_id" gorm:"index;not null"`
    Month       string    `json:"month"` // "2026-03"
    ReportText  string    `json:"report_text" gorm:"type:text"`
    SentTo      string    `json:"sent_to"`
    SentAt      time.Time `json:"sent_at"`
    CreatedAt   time.Time `json:"created_at"`
}
```

#### [NEW] [monthly_report.go](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/backend/services/monthly_report.go)

Full Gemini-powered report generation and delivery service.

#### [MODIFY] [cron.go](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/backend/services/cron.go)

Add a daily 6 AM ticker. On day == 1, call `SendMonthlyReports()`.

#### [MODIFY] [main.go](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/backend/main.go)

Add AutoMigrate for `MonthlyReport`. Register report settings routes.

---

### 2C. Backend: Report Settings API

3 new endpoints registered under `dash` (JWT-protected):

```
GET  /api/v1/settings/report          → get monthly_report_enabled + report_phone
PUT  /api/v1/settings/report          → save settings
POST /api/v1/settings/report/test     → generate + send test report now
GET  /api/v1/settings/report/history  → last 3 sent reports (id, month, sent_at, report_text)
```

---

### 2D. Frontend: Report Settings in /settings Page

#### [MODIFY] [settings/page.tsx](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/frontend/app/dashboard/settings/page.tsx)

Add new **"Monthly Intelligence Report"** section with:

- **Toggle switch** — Enable/Disable (auto-saves)
- **Phone field** — Pre-filled from `Business.Phone` (registered WhatsApp number), editable
- **Report preview accordion** — "What will the report contain?" expandable
- **"Send Test Report Now" button** → POST + spinner + success toast
- **"Last 3 Reports" section**:
  - Table: Month | Sent To | Sent At | [View] button
  - [View] opens a modal with the full report text (nicely formatted)
  - Optional: "Copy to clipboard" button

---

## Part 3 — WhatsApp OTP Registration (Replace Email Verification)

> [!IMPORTANT]
> This replaces the current email OTP verification with **WhatsApp OTP**, sent from **SalesPilot's own system WhatsApp number** (not the tenant's number). Requires `SYSTEM_WA_PHONE_NUMBER_ID` + `SYSTEM_WA_ACCESS_TOKEN` in `.env`.

### 3A. Backend

#### [MODIFY] [.env (backend)](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/backend/.env)

Add:
```
SYSTEM_WA_PHONE_NUMBER_ID=your_salespilot_phone_id
SYSTEM_WA_ACCESS_TOKEN=your_salespilot_access_token
```

#### [MODIFY] [config/config.go]

Load the two new env vars.

#### [MODIFY] [auth_handler.go](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/backend/handlers/auth_handler.go)

`Register` endpoint changes:
1. Accept `phone` in the registration payload (the owner's WhatsApp number)
2. After creating the user, generate a 6-digit OTP
3. Store OTP in `whatsapp_verifications` table with 10 min expiry
4. Send OTP via `whatsapp.SendSystemText(phone, "Your SalesPilot code: 123456")`
5. Return `{ "requires_wa_verification": true }`

New endpoint `POST /api/v1/auth/verify-wa` — verify WhatsApp OTP, activate account.

#### [NEW] [whatsapp/system.go](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/backend/whatsapp/system.go)

`SendSystemText(to, message string)` — uses the platform's own `SYSTEM_WA_*` credentials to send messages (for OTP delivery, system alerts).

> [!NOTE]
> We keep `EmailVerificationToken` model in DB for now (soft deprecation). The new `WAVerification` model stores phone + OTP + expiry. Email verification routes remain but won't be called from the new frontend.

### 3B. Frontend

#### [MODIFY] [register/page.tsx](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/frontend/app/register/page.tsx)

- Add `phone` field to the registration form (with LK flag + country code `+94`)
- On submit → redirect to `/verify-wa` instead of email verification page

#### [NEW] [verify-wa/page.tsx](file:///c:/Users/rkksg/Documents/golang-projects/salespilot-v2/frontend/app/verify-wa/page.tsx)

- 6-digit OTP input (auto-focus, auto-advance digits)
- "Resend OTP" button with 60s countdown
- Success → redirect to onboarding
- WhatsApp branding (green theme, WA icon)

---

## Verification Plan

### Backend
```bash
go build ./...
```
- New endpoints respond correctly
- Report generates valid Gemini content
- WhatsApp OTP sends successfully to test number
- Monthly cron triggered manually: `SendMonthlyReports()` call

### Frontend
```bash
npm run build
```
- All 6 KPI cards render with growth badges
- 30-day trend chart renders
- Order status donut renders
- Settings page shows report toggle + history
- Register flow → WA OTP page → onboarding

### Integration
1. Register a new account → get OTP on WhatsApp → verify → onboard
2. POST `/api/v1/settings/report/test` → WhatsApp message delivered
3. Open dashboard → all charts populated from real data
