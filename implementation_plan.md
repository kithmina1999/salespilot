# SalesPilot v2 — New Project Architecture Plan

> **Decision**: Build fresh at `c:\Users\rkksg\Documents\golang-projects\salespilot-v2`
> **Keep old project**: `whatsapp-business-SAAS` stays untouched as reference
> **Core change**: whatsmeow → Meta WhatsApp Cloud API (official, ban-free)

---

## What We're Building

A clean, production-ready WhatsApp Business SaaS with:
- **Official Meta Cloud API** — no bans, no breaking updates
- **2-Plan pricing**: Free / Growth (Rs. 1,500) / Unlimited (Rs. 4,500)
- **New onboarding flow**: registers users through Meta Business Manager
- **Reused core**: FAQ engine, chat CRM, settings, AI pipeline

---

## Project Structure

```
salespilot-v2/
├── backend/                    ← Go (Gin) API server
│   ├── main.go
│   ├── config/
│   ├── database/
│   ├── middleware/
│   ├── models/
│   ├── handlers/
│   ├── bot/                    ← NEW name for whatsapp/ (no more WA-specific)
│   │   ├── pipeline.go         ← COPY + update send calls
│   │   ├── normalize.go        ← COPY as-is
│   │   ├── embedding.go        ← COPY as-is
│   │   ├── cache.go            ← COPY as-is
│   │   ├── client.go           ← NEW: Meta Graph API sender
│   │   └── webhook.go          ← NEW: Meta webhook receiver + router
│   ├── services/
│   └── utils/
│
└── frontend/                   ← Next.js
    ├── app/
    │   ├── (landing)/          ← NEW: public marketing site
    │   ├── (auth)/             ← REDESIGN: signup/login
    │   ├── (onboarding)/       ← REDESIGN: 4-step onboarding
    │   └── dashboard/
    │       ├── (home)/         ← REDESIGN: new dashboard
    │       ├── rules/          ← COPY from old project
    │       ├── chats/          ← COPY from old project
    │       ├── settings/       ← COPY + update connect flow
    │       ├── usage/          ← REDESIGN: new 2-plan pricing UI  
    │       └── connect/        ← NEW: Meta credentials setup
```

---

## Backend: File-by-File Decision

### ✅ COPY AS-IS (zero changes needed)
| File | Reason |
|------|--------|
| `bot/normalize.go` | Sinhala normalization — 100% reusable |
| `bot/embedding.go` | Gemini embedding logic — no WA coupling |
| `bot/cache.go` | FAQ in-memory cache — no WA coupling |
| `middleware/auth.go` | JWT auth — unchanged |
| `middleware/rate_limit.go` | Rate limiting — unchanged |
| `middleware/tenant_auth.go` | API key auth — unchanged |
| `utils/*` | Phone normalization helpers — unchanged |
| `config/config.go` | Load env vars (update keys) |
| `database/db.go` | GORM init — unchanged |
| `services/cron.go` | Background jobs — unchanged |
| `services/backup.go` | Backup jobs — unchanged |
| `handlers/rule_handler.go` | FAQ CRUD — unchanged |
| `handlers/customer_handler.go` | Customer CRUD — unchanged |
| `handlers/product_handler.go` | Product CRUD — unchanged |
| `handlers/order_handler.go` | Orders — unchanged |
| `handlers/chat_handler.go` | Chat CRM — minor update (remove JID) |
| `handlers/audit_handler.go` | Audit logs — unchanged |
| `handlers/dashboard_handler.go` | Stats — unchanged |
| `handlers/blacklist_handler.go` | Blacklist — unchanged |
| `handlers/settings_handler.go` | Settings — unchanged |
| `handlers/admin_handler.go` | Super admin — unchanged |
| `handlers/template_data.go` | 50+ rule templates — unchanged |
| `handlers/system_*` | System routes — unchanged |

### 🔄 COPY + UPDATE (minor changes)
| File | What changes |
|------|-------------|
| `models/business.go` | Remove `WhatsAppJID`, add `WAPhoneNumberID`, `WABAID`, `WAAccessToken`; rename plans (Free/Growth/Unlimited) |
| `models/user.go` | No change needed |
| `models/rule.go` | No change |
| `models/message.go` | Remove `whatsapp_jid` if present |
| `handlers/billing_handler.go` | New amounts: Growth Rs.1500, Unlimited Rs.4500 |
| `handlers/activation_handler.go` | New plan names: `growth`, `unlimited` |
| `handlers/usage_handler.go` | Update limit values |
| `bot/pipeline.go` | Same logic — only `SendTextMessage` call signature changes |
| `main.go` | Remove whatsmeow init, add webhook route, remove QR routes |

### 🆕 NEW (write from scratch)
| File | What it does |
|------|-------------|
| `bot/client.go` | Sends messages via Meta Graph API (plain HTTP POST) |
| `bot/webhook.go` | Receives Meta webhooks, routes by `phone_number_id` |
| `handlers/connect_handler.go` | Save/validate/test Meta credentials per tenant |
| `handlers/whatsapp_handler.go` | Rewritten: connection status, save credentials, test |

### ❌ DELETE (whatsmeow-specific, not needed)
| File | Reason |
|------|--------|
| `whatsapp/service.go` | whatsmeow client manager — replaced by stateless HTTP |
| `whatsapp/service_methods.go` | WA send — replaced by `bot/client.go` |
| `handlers/sse_handler.go` | QR stream SSE — not needed with Meta API |

---

## The Core Architecture Change

### OLD: whatsmeow (stateful, persistent connections)
```
Server boots
└── For each business with saved session:
    └── Connect WhatsApp WebSocket (persistent WS)
        └── Events fire on incoming messages
            └── Pipeline handles

Problem: N businesses = N open WebSocket connections
         Phone must stay online with WhatsApp linked
         Breaks when WhatsApp updates protocol
```

### NEW: Meta Cloud API (stateless, webhook-driven)
```
Server boots
└── Register ONE webhook URL with Meta
    (POST /api/whatsapp/webhook)

When customer messages any tenant:
└── Meta sends HTTP POST to your webhook
    └── Parse phone_number_id from payload
    └── Look up business in DB by phone_number_id
    └── Run pipeline (same logic as before)
    └── Reply via HTTP POST to Meta Graph API
        using tenant's access_token

Zero persistent connections. No phone online required.
Scales to 1000 tenants with zero extra infrastructure.
```

---

## New Database Schema Changes

### `businesses` table additions
```go
// REMOVE:
WhatsAppJID  string  // whatsmeow session identifier — gone

// ADD:
WAPhoneNumberID  string  // e.g. "123456789012345"
WABAID           string  // e.g. "987654321098765"
WAAccessToken    string  // Meta system user token (store encrypted)
WAConnectedAt    *time.Time
WAStatus         string  // "connected" | "disconnected" | "not_connected"

// Plan rename:
// "starter" → "growth"
// "pro"     → "unlimited"
```

---

## New Bot Layer (bot/ package)

### `bot/client.go` — Sending Messages
```go
// Dead simple. One function. No sessions. No state.
func SendText(phoneNumberID, accessToken, toPhone, text string) error {
    url := fmt.Sprintf("https://graph.facebook.com/v20.0/%s/messages", phoneNumberID)
    body := map[string]interface{}{
        "messaging_product": "whatsapp",
        "to":                toPhone,
        "type":              "text",
        "text":              map[string]string{"body": text},
    }
    // POST with Bearer token
    // Return error if non-200
}
```

### `bot/webhook.go` — Receiving Messages
```go
// POST /api/whatsapp/webhook
// Meta sends ALL tenant messages here
func HandleWebhook(c *gin.Context) {
    // 1. Verify X-Hub-Signature-256 header (security)
    // 2. Parse payload
    // 3. Extract phone_number_id from entry[0].changes[0].value
    // 4. Look up business by WAPhoneNumberID
    // 5. For each message in payload:
    //    - Run pipeline.HandleIncomingMessage(business, msg)
    // 6. Respond 200 immediately (Meta requires fast ack)
}

// GET /api/whatsapp/webhook
// Meta calls this once to verify your endpoint
func VerifyWebhook(c *gin.Context) {
    // Check hub.verify_token matches env var
    // Return hub.challenge
}
```

### `bot/pipeline.go` — Updated Send Call
```go
// OLD (whatsmeow):
p.service.SendTextMessage(business, fromRaw, replyText)

// NEW (Meta Cloud API):
bot.SendText(business.WAPhoneNumberID, business.WAAccessToken, from, replyText)

// Everything else in pipeline.go stays IDENTICAL
```

---

## New Frontend: Complete Page Map

### Pages to COPY from old project (minimal changes)
| Page | Copy from | Changes needed |
|------|-----------|---------------|
| `/dashboard/rules` | old `rules/` | None — works as-is |
| `/dashboard/chats` | old `chats/` | Remove JID display |
| `/dashboard/orders` | old `orders/` | None |
| `/dashboard/products` | old `products/` | None |
| `/dashboard/settings` | old `settings/` | Replace QR section with Meta credentials |
| `/dashboard/audit` | old `audit/` | None |

### Pages to REDESIGN from scratch
| Page | What's new |
|------|-----------|
| `/` | Landing page with new 2-plan pricing, value prop |
| `/signup` | Cleaner signup — email + phone + business name only |
| `/login` | Keep but redesign UI |
| `/onboarding` | 4-step: Business Info → Meta Setup Guide → Add Credentials → Test Bot |
| `/dashboard` | Home — new design, no "WhatsApp connecting..." state |
| `/dashboard/usage` | New 2-plan pricing cards, upgrade flow |
| `/dashboard/connect` | NEW: Meta Business setup wizard |

---

## The New Onboarding Flow (Critical UX Redesign)

### OLD (whatsmeow) Onboarding
```
Step 1: Business details
Step 2: QR scan (🤦 user needs phone in hand)
Step 3: FAQ templates
Step 4: Done

Problem: Users drop off at QR scan. They're on desktop, phone is elsewhere.
```

### NEW (Meta Cloud API) Onboarding
```
Step 1: Business details (name, phone, category)
        → Same as before

Step 2: Meta Business Setup Guide (visual, step-by-step)
        → "Open business.facebook.com on this device"
        → "Click Add Phone Number → follow prompts"
        → "When done, come back here"
        → [VIDEO/SCREENSHOTS for Sri Lankan users]
        → Sinhala guide available

Step 3: Add Your Credentials (paste 3 values)
        → Phone Number ID: [___________]
        → Access Token: [___________]
        → [Test Connection] button — sends "Hello!" to their number
        → If success → green checkmark → continue

Step 4: Set up AI (FAQ templates)
        → Industry templates
        → Pick Sinhala/English
        → Their bot is live
```

**This is actually BETTER UX** — the user does setup ONCE in a browser, no phone scanning. No re-scanning when server restarts. No "please keep your phone connected."

---

## New WhatsApp Connect Dashboard Page

Replace the QR code page with a credential management page:

```
┌─────────────────────────────────────────────────────┐
│  WhatsApp Business Connection                   ✅  │
├─────────────────────────────────────────────────────┤
│  Status: Connected                                   │
│  Phone: +94 77 xxx xxxx                             │
│  Connected since: April 3, 2026                     │
├─────────────────────────────────────────────────────┤
│  Credentials                                         │
│  Phone Number ID: 123456789 [Change]                │
│  WABA ID: 987654321 [Change]                        │
│  Access Token: ••••••••••• [Rotate]                 │
├─────────────────────────────────────────────────────┤
│  [Test Connection]   [Disconnect]                    │
└─────────────────────────────────────────────────────┘
```

When disconnected (token expired/revoked):
```
┌─────────────────────────────────────────────────────┐
│  ⚠️ WhatsApp Disconnected                            │
│  Your access token has expired or been revoked.     │
│  Generate a new token and update it below.          │
│                                                     │
│  [Step-by-step guide] [Update Token]               │
└─────────────────────────────────────────────────────┘
```

---

## New Pricing & Plan Enforcement

### Plan Constants (backend)
```go
const (
    PlanFree      = "free"
    PlanGrowth    = "growth"    // Rs. 1,500/month
    PlanUnlimited = "unlimited" // Rs. 4,500/month
)
```

### Plan Limits
| Metric | Free | Growth | Unlimited |
|--------|------|--------|-----------|
| Inbound msgs/month | 500 | Unlimited | Unlimited |
| AI (Gemini) replies/month | 0 | 2,000 | 10,000 |
| Active FAQ Rules | 15 | 100 | Unlimited (-1) |
| AI rule generations/month | 5 | 50 | Unlimited (-1) |
| Manual chat (send) | ❌ | ✅ | ✅ |
| Bot pause per customer | ❌ | ✅ | ✅ |
| Products | 20 | Unlimited | Unlimited |
| "Powered by" footer | Yes | No | No |

### Billing amounts
```go
var growthPricing = map[string]float64{
    "monthly":   1500,
    "quarterly": 3600,   // 20% off
    "annual":    12000,  // 33% off
}
var unlimitedPricing = map[string]float64{
    "monthly":   4500,
    "quarterly": 10800,
    "annual":    36000,
}
```

---

## Build Order (Phased Execution)

### Phase 1 — Backend Foundation (Day 1)
- [ ] Create new project at `salespilot-v2/backend/`
- [ ] Initialize Go module: `github.com/kithmina1999/salespilot`
- [ ] Copy: `config/`, `database/`, `middleware/`, `utils/`, `services/`
- [ ] Copy + update: `models/` (new plan names, Meta fields, remove JID)
- [ ] Copy + update: `handlers/` (all the ones marked "copy as-is")

### Phase 2 — Bot Engine (Day 1-2)
- [ ] Create `bot/` package
- [ ] Copy: `normalize.go`, `embedding.go`, `cache.go` from old project
- [ ] Copy + update: `pipeline.go` (change `SendTextMessage` calls)
- [ ] Write NEW: `bot/client.go` (Meta Graph API sender)
- [ ] Write NEW: `bot/webhook.go` (webhook receiver + router)
- [ ] Write NEW: `handlers/connect_handler.go` (save/test credentials)

### Phase 3 — Updated Main + Routes (Day 2)
- [ ] Update `main.go` — remove whatsmeow init, register webhook routes
- [ ] Update billing handler — new pricing
- [ ] Update activation handler — new plan names
- [ ] Remove `sse_handler.go` (QR streaming not needed)
- [ ] Test: POST to webhook with sample Meta payload
- [ ] Test: `bot/client.go` sends to a real WhatsApp number

### Phase 4 — Frontend Foundation (Day 2-3)
- [ ] Create `salespilot-v2/frontend/` with Next.js
- [ ] Set up design system (colours, fonts, components)
- [ ] Build landing page (`/`) — new 2-plan pricing
- [ ] Build auth pages (`/login`, `/signup`)

### Phase 5 — Onboarding + Connect Flow (Day 3-4)
- [ ] Build 4-step onboarding wizard
- [ ] Build `/dashboard/connect` credential management page
- [ ] Step-by-step Meta Business setup guide with screenshots
- [ ] Sinhala language toggle on guide

### Phase 6 — Dashboard + Reused Pages (Day 4-5)
- [ ] Dashboard home (redesigned)
- [ ] Copy + light update: rules, chats, orders, products, settings, audit
- [ ] Usage/billing page with new 2-plan pricing cards
- [ ] Super admin panel updates

### Phase 7 — Testing & Polish (Day 5-6)
- [ ] End-to-end test with real Meta Sandbox number
- [ ] Test Free plan limits enforcement
- [ ] Test Growth plan upgrade via activation code
- [ ] Mobile responsive check on all pages
- [ ] Deploy to production server

---

## go.mod Dependencies (old → new)

### REMOVE from old go.mod:
```
go.mau.fi/whatsmeow         // entire unofficial WA library
go.mau.fi/libsignal         // WA signal protocol 
go.mau.fi/util
github.com/skip2/go-qrcode  // QR code generation — no longer needed
github.com/coder/websocket  // WA WebSocket — no longer needed
```

### KEEP:
```
github.com/gin-gonic/gin
github.com/golang-jwt/jwt/v5
github.com/google/uuid
gorm.io/gorm
gorm.io/driver/postgres
github.com/adrg/strutil      // FAQ fuzzy matching
google.golang.org/protobuf   // Gemini API
github.com/joho/godotenv
golang.org/x/crypto
github.com/aws/aws-sdk-go    // R2/S3 uploads
```

### ADD:
```
// Nothing new! Meta Cloud API = plain HTTP. No SDK needed.
// net/http from stdlib is all we need to call graph.facebook.com
```

The Go standard library's `net/http` handles all Meta API calls. This is the beautiful simplicity of the official API.

---

## Environment Variables (new .env)

```env
# App
PORT=8080
GIN_MODE=debug
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgres://...

# Meta WhatsApp Cloud API
META_VERIFY_TOKEN=your-random-webhook-verify-token  # you choose this
META_APP_SECRET=from-meta-developer-portal          # for HMAC signature verification

# AI
GEMINI_API_KEY=...

# Storage (keep same)
CLOUDINARY_URL=...

# Billing (keep same)
PAYHERE_MERCHANT_ID=...
PAYHERE_MERCHANT_SECRET=...

# Admin
MASTER_API_KEY=...
```

**Removed**: `WA_SESSIONS_DB_PATH` (no more SQLite sessions file)

---

## Open Questions Before Starting

> [!IMPORTANT]
> **Q1: Project location**
> `c:\Users\rkksg\Documents\golang-projects\salespilot-v2` ?
> Or a different name/location?

> [!IMPORTANT]
> **Q2: Meta App ID**
> Do you already have a Meta Developer App created?
> If not, I'll guide you through creation as part of Phase 1.
> You'll need to set a webhook URL — this means the backend needs to be deployed
> (or tunneled via ngrok) for Meta to verify it.

> [!IMPORTANT]
> **Q3: Database**
> New database from scratch (clean slate) or migrate data from old SQLite/Postgres?
> Recommendation: new DB — old data was test data anyway.

> [!IMPORTANT]
> **Q4: Frontend stack**
> Same: Next.js 14+, TypeScript, Vanilla CSS?
> Or switch to something different now that we're starting fresh?

> [!IMPORTANT]
> **Q5: First target customer**
> Do you have anyone in mind to be the FIRST real user?
> If yes, we can create a manual onboarding checklist for them specifically.
> This would drive the design of the setup guide/UX.
