# 🔍 SalesPilot — Deep Market-Readiness Analysis

> **System**: WhatsApp AI Sales Bot SaaS for Sri Lankan SMBs
> **Stack**: Go (Gin) + Next.js + SQLite + Gemini AI + WhatsApp Web (whatsmeow)
> **Analysis Date**: April 1, 2026

---

## 📊 Executive Summary

SalesPilot is **80% built** — the core engine (AI pipeline, FAQ matching, billing, multi-tenancy) is solid. However, there are **critical gaps** that would cause churn, trust issues, and security vulnerabilities if you launch without fixing them. Below is a brutally honest breakdown of what's missing and what strategies would help you **dominate the Sri Lankan SMB market**.

---

## 🚨 CRITICAL — Must Fix Before Launch

### 1. **SECRETS ARE EXPOSED IN `.env` (SECURITY EMERGENCY)**

> [!CAUTION]
> Your `.env` file contains **live API keys, R2 credentials, Gemini keys, PayHere secrets, and your Master API Key** — all in plain text and likely committed to Git. If this repo is public or ever leaked, your entire platform is compromised.

**What to do:**
- Immediately rotate ALL keys (Gemini, PayHere, R2, Master API Key)
- Add `.env` to `.gitignore` (it's probably already there but verify no commit history)
- Use environment variables injected via your deployment platform (Railway, Render, etc.)
- The `MASTER_API_KEY` default is literally `your-very-long-random-secret-here` — generate a real one

### 2. **SQLite Will Not Scale for Production SaaS**

> [!WARNING]
> SQLite is single-writer. With 50+ concurrent tenants sending WhatsApp messages, you'll hit `database is locked` errors under load. This is the **#1 reason Go+SQLite SaaS products die**.

**What to do:**
- **Short-term**: Enable WAL mode (`PRAGMA journal_mode=WAL`) if not already — this allows concurrent reads
- **Medium-term**: Migrate to PostgreSQL (Supabase free tier, Neon, or Railway Postgres). GORM makes this a 5-line config change.
- SQLite is fine for 1-10 tenants during beta. Beyond that, you need Postgres.

### 3. **No Landing Page / Marketing Website**

Your `app/page.tsx` is just a redirect to `/login`. There is **zero public-facing marketing presence**. No visitor can learn what SalesPilot does without registering first.

**What you need:**
- A stunning landing page at `/` explaining the value proposition
- Sections: Hero, Features, Pricing, Testimonials, FAQ, CTA
- Bilingual (English + Sinhala) — this alone will differentiate you in SL
- WhatsApp demo widget: "See it working right now → Message our demo bot"

### 4. **No Password Reset / Forgot Password Flow**

If a user forgets their password, they're permanently locked out. In Sri Lanka where business owners reuse devices and forget credentials frequently, this will cause immediate support overload.

**What to do:**
- Implement OTP-to-WhatsApp password reset (you already have the WhatsApp infrastructure!)
- This is a **unique differentiator** — most SaaS tools use email, but your target users check WhatsApp 100x more than email

### 5. **No Email Verification**

Anyone can register with any email. This means:
- Fake accounts will flood your system
- No way to contact users for billing/marketing
- No trust signal for the user

### 6. **Health Check Naming Mismatch**

```go
// Line 97 says "StyleBot API" but the product is "SalesPilot"
c.JSON(http.StatusOK, gin.H{
    "status":  "ok",
    "service": "StyleBot API",  // ← Old name!
```

This leaks the old product name and looks unprofessional in monitoring.

---

## ⚠️ HIGH Priority — Fix Before Paid Launch

### 7. **No Stripe/PayHere Integration Working**

The PayHere integration exists in code but is **commented out** (`// dash.POST("/billing/initiate", handlers.BillingInitiate)`). Your only payment method is manual activation codes created by super admin.

**For SL market**, activation codes actually work well (bank transfer → WhatsApp screenshot → code), but you need:
- A clear "How to Pay" page/modal in the dashboard
- Bank account details prominently displayed
- Automatic activation code delivery after admin confirms payment

### 8. **No Terms of Service or Privacy Policy**

The register page says "By continuing, you agree to the Terms of Service & Privacy Policy" — but there are **no actual pages for these**. This is legally required, especially with GDPR-like compliance and WhatsApp's Business Policy.

### 9. **No Mobile Responsive Dashboard**

The sidebar is fixed at `w-56` with no hamburger menu or responsive collapse. **90% of Sri Lankan business owners will access this from their phone**. If the dashboard doesn't work on mobile, they'll abandon immediately.

### 10. **No Multi-User Support per Business**

Each business can only have 1 admin user. Many Sri Lankan businesses have:
- Owner (views analytics)
- Staff member (manages chats, orders)
- VA / assistant (adds products)

You need role-based access (admin, staff, viewer) eventually.

### 11. **WhatsApp Session Fragility**

The whatsmeow library requires the phone to periodically validate the linked device. If it disconnects:
- There's a `ConnectionBanner` but no **WhatsApp alert** sent to the business owner's phone
- Owner may not check the dashboard for days
- All incoming customer messages during downtime are **silently lost**

**Fix**: Send a WhatsApp message to the owner's phone when their bot disconnects (you already have the infrastructure).

### 12. **No Image/Media Message Handling**

The pipeline only processes text messages:
```go
text := evt.Message.GetConversation()
if text == "" {
    return // ignore non-text messages for now
}
```

Sri Lankan customers frequently send:
- Product screenshots asking "Do you have this?"
- Payment screenshots for COD confirmation
- Voice notes asking questions

At minimum, reply with "I can only read text messages right now. Please type your question! 😊"

---

## 🟡 MEDIUM Priority — Improve Before Scaling

### 13. **AI Usage Double-Counting Bug**

In `pipeline.go`, AI message count is incremented **twice**:
- Line 352: `database.DB.Model(business).Update("ai_message_count", business.AIMessageCount+1)`
- Line 798: `database.DB.Model(business).UpdateColumn("ai_message_count", business.AIMessageCount+1)`

This means users burn through their AI quota 2x faster than they should. **Fix this immediately**.

### 14. **No Webhook/Notification System for Orders**

When a new order comes in via WhatsApp, the business owner has no push notification. They have to manually check the dashboard. Add:
- Browser push notifications
- WhatsApp notification to owner for new orders
- SSE-based real-time dashboard updates (you have the SSE infrastructure)

### 15. **No Data Export / Backup for Tenants**

Business owners should be able to export:
- Customer contacts (CSV)
- Chat history
- Product catalog
- Order history

This builds trust and reduces lock-in anxiety.

### 16. **Cron Jobs Use `time.NewTicker` Instead of Proper Scheduler**

If the server restarts at 9:01 AM, the daily cron jobs miss their window until the next day. Use a proper cron library like `robfig/cron/v3`.

---

## 🎯 Sri Lanka Market-Capture Strategies

### Strategy 1: **"WhatsApp DP Referral" Viral Loop** 🔥
When a customer gets an impressive AI reply from a SalesPilot-powered business, add a tiny footer:
> `Powered by SalesPilot.lk — Get your own AI bot free!`

This is how Mailchimp and ChatGPT grew — **branded free tier responses**. Every message you send becomes an ad. **Only do this for Free plan users** — paid users get clean responses.

### Strategy 2: **"Deploy in 5 Minutes" YouTube/TikTok Sinhala Tutorials** 📹
Sri Lankan SMB owners learn from **Sinhala video tutorials**, not documentation. Create:
- 2-minute setup video in Sinhala
- Show a real business going from 0 to AI bot responses in 5 minutes
- Post on Sinhala business Facebook groups (there are 50+ with 100K+ members)

### Strategy 3: **Facebook Group Invasion + Free Setup Service** 🎯
- Join the top Sri Lanka business groups: "Online Business Sri Lanka", "Daraz Sellers LK", "Lanka Dropshipping"
- Offer: "I'll set up your WhatsApp AI bot for FREE — you just register"
- This gives you the first 50 users who become your case studies

### Strategy 4: **Integration with Popular SL Payment Gateways**
- Add **Frimi deep-link** (most used mobile wallet in SL)
- Add **eZ Cash/mCash** payment codes
- Allow business owners to generate payment links for customers directly in WhatsApp

### Strategy 5: **"WhatsApp Catalog Sync" Feature** 📦
Let businesses upload their product catalog and the AI bot automatically creates a browsable menu:
> Customer: "What do you sell?"
> Bot: "Here's our menu! 📦\n1. Coconut Oil Rs. 450\n2. Turmeric Powder Rs. 280\n...\nReply with the number to order!"

This is what 90% of SL WhatsApp businesses need.

### Strategy 6: **Referral Commission System** 💰
- Give existing users a referral code
- When someone signs up with their code, both get 7 extra free days
- In SL's tight-knit business community, word-of-mouth is everything

### Strategy 7: **"Smart Reply Suggestions" for Manual Chats** 💡
When a business owner opens a chat in the dashboard to manually reply:
- Show AI-suggested replies based on the conversation
- One-click to send
- This saves time and converts Free users who see the AI value

---

## 🎨 UI Improvements Needed

### A. **Landing Page (MISSING — #1 Priority)**
You need a public-facing website. Without it, you have no way to acquire organic users. Use:
- Hero with animated WhatsApp message mockup showing the bot in action
- Social proof: "Trusted by X businesses in Sri Lanka"
- Live demo: embed a QR code to message your demo bot
- Pricing cards with comparison table
- Sinhala language toggle

### B. **Login/Register Pages**
| Issue | Fix |
|-------|-----|
| No social proof on auth pages | Add "Join 100+ Sri Lankan businesses" below the form |
| No password visibility toggle | Add eye icon to toggle password field |
| Phone field is SL-only (+94) | Fine for now, but mention "WhatsApp number" more prominently |
| No loading skeleton | The redirect from `/` is a blank white flash |

### C. **Onboarding Flow**
| Issue | Fix |
|-------|-----|
| Step 3 scrollbar uses amber color | Inconsistent with the emerald theme |
| No progress percentage | Add "Step 2 of 4 — 50% complete" |
| No skip option for templates | Some users may want to start blank |
| No "preview" of how the bot will respond | Show a WhatsApp-style chat bubble preview |

### D. **Dashboard**
| Issue | Fix |
|-------|-----|
| No mobile hamburger menu | Dashboard is unusable on phones |
| "Command Center" header has no greeting | Add "Good morning, [Business Name]!" |
| No quick-action buttons | "Add Product", "Create FAQ Rule", "View Chats" cards |
| Chart shows "7-Day Traffic" but empty for new users | Show educational placeholder instead of blank |
| No revenue/order value metrics | Add total order value, conversion rate |

### E. **Chat Page**
| Issue | Fix |
|-------|-----|
| No typing indicator | Show "Bot is typing..." when AI is processing |
| No message status (sent/delivered/read) | WhatsApp has this data via whatsmeow |
| No search across chats | Business owners need to find specific customer conversations |

### F. **Usage & Plan Page**
| Issue | Fix |
|-------|-----|
| 43KB page.tsx | This is a massive single file — consider splitting |
| Pricing is buried | Users need to see value before seeing price |
| No comparison table | Free vs Starter vs Pro side-by-side |
| Activation code input isn't prominent | Should be a prominent card with glowing "Enter Code" button |

### G. **Settings Page**
| Issue | Fix |
|-------|-----|
| No profile picture upload | Business logo/avatar builds brand |
| No notification preferences | Users should control what alerts they get |
| No delete account option | Required for trust |

---

## 🏗️ Missing Features for Market Readiness

| Feature | Priority | Effort | Impact |
|---------|----------|--------|--------|
| Landing page / marketing site | 🔴 Critical | 2 days | Organic acquisition |
| Forgot password (OTP via WhatsApp) | 🔴 Critical | 1 day | User retention |
| Mobile responsive dashboard | 🔴 Critical | 2 days | 90% of your users |
| Media message handling (images/voice) | 🟡 High | 1 day | Customer experience |
| WhatsApp disconnect alerting | 🟡 High | 0.5 day | Prevent silent downtime |
| Tenant data export (CSV) | 🟡 High | 0.5 day | Trust building |
| Branded free-tier responses | 🟢 Medium | 0.5 day | Viral growth |
| Referral system | 🟢 Medium | 1 day | User acquisition |
| Multi-user per business | 🟢 Medium | 2 days | Enterprise readiness |
| PostgreSQL migration | 🟡 High | 1 day | Scalability |
| WhatsApp catalog/menu system | 🟢 Medium | 2 days | Product differentiation |
| Browser push notifications | 🟢 Medium | 1 day | Engagement |

---

## 🛡️ Security Audit Summary

| Finding | Severity | Status |
|---------|----------|--------|
| All secrets in `.env` with weak defaults | 🔴 Critical | Needs rotation NOW |
| `MASTER_API_KEY` has placeholder default | 🔴 Critical | Must change |
| No CSRF protection | 🟡 Medium | JWT mitigates partially |
| No brute-force login protection | 🟡 Medium | Add account lockout after 5 failed attempts |
| JWT secret appears to be hardcoded | 🟡 Medium | Move to env var |
| No HTTPS enforcement | 🟡 Medium | Add redirect in production |
| Token in URL query param for SSE | 🟢 Low | Acceptable workaround but log separately |
| No input sanitization on rule responses | 🟡 Medium | XSS risk in dashboard |

---

## 🚀 Recommended Launch Roadmap

### Phase 1: "Soft Launch" (1-2 weeks)
1. ✅ Fix the `.env` security issue
2. ✅ Fix the AI double-counting bug
3. ✅ Build landing page with Sinhala support
4. ✅ Make dashboard mobile-responsive
5. ✅ Add forgot password via WhatsApp OTP
6. ✅ Handle non-text messages gracefully
7. ✅ Fix health check naming ("StyleBot" → "SalesPilot")

### Phase 2: "Growth Setup" (2-4 weeks)
8. Add branded responses for free tier
9. Build referral system
10. Create Sinhala YouTube tutorial
11. Join 10 SL Facebook business groups
12. Add WhatsApp catalog/menu system
13. Migrate to PostgreSQL

### Phase 3: "Scale" (1-2 months)
14. Stripe integration for international payments
15. Multi-user roles per business
16. Browser push notifications
17. Advanced analytics (conversion rate, response time)
18. API for third-party integrations

---

## 💡 Final Verdict

**Your core product is genuinely good.** The AI pipeline with keyword → semantic → Gemini fallback is sophisticated. The bilingual support is a huge differentiator. The activation code system is clever for the SL market.

But you're building a **B2B SaaS product with no front door** (no landing page), a **locked bathroom** (no password reset), and **handing out the house keys** (exposed secrets). Fix these 3 things and you have a real product that can capture the Sri Lankan market.

The biggest risk isn't technology — it's **distribution**. Sri Lankan SMBs don't Google for tools. They discover them from Facebook groups, YouTube videos, and WhatsApp forwards from friends. Your go-to-market strategy should be **100% social, 0% SEO** for the first 6 months.
