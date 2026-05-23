# SalesPilot v2 vs WhatChimp — Competitive Analysis

> [!NOTE]
> This is an honest, code-backed comparison. WhatChimp data is from their live
> pricing page (April 2026). SalesPilot data is from the actual codebase.

---

## The Fundamental Difference — Different Games Entirely

Before any feature table, this is the most important thing to understand:

| | WhatChimp | SalesPilot |
|---|---|---|
| **Product Category** | WhatsApp Marketing Platform | WhatsApp Commerce & Sales Bot |
| **Primary User** | Marketing teams, agencies, bulk broadcast senders | Small retail / e-commerce businesses |
| **Core Value Prop** | "Send bulk messages to thousands" | "Turn WhatsApp into your full store" |
| **Target Market** | Global (90+ countries, international SaaS pricing) | Sri Lanka (local market, LKR pricing) |
| **Business Model** | 0% markup on Meta fees, pure SaaS revenue | SaaS subscription, no conversation markup |

**You are not directly competing.** WhatChimp's customers want to *blast* messages at audiences. SalesPilot's customers want to *automate their store* on WhatsApp — take orders, manage inventory, track deliveries. These attract different buyers. This is actually good news.

---

## Pricing Comparison

### WhatChimp Plans (USD, converted to approx LKR)

| Plan | Monthly | Annual | Per year |
|---|---|---|---|
| Basic | ~$19/mo | ~$11-14/mo | ~LKR 50,000–75,000/yr |
| Pro | ~$49/mo | ~$29-35/mo | ~LKR 130,000–190,000/yr |
| Enterprise | Custom | Custom | — |

*(Exact USD prices not shown on page — they use a popup to reveal them)*

### SalesPilot Plans (LKR)

| Plan | Monthly | Annual |
|---|---|---|
| Free | Rs. 0 | Rs. 0 |
| Starter | Rs. 1,490/mo | Rs. 14,900/yr |
| Pro | Rs. 3,490/mo | Rs. 34,900/yr |

### Pricing Verdict

**SalesPilot wins on price for Sri Lankan businesses.** WhatChimp prices in USD which means a small Sri Lankan shop would pay 5–10x more. Your Rs. 1,490 Starter plan is likely ~$5 USD — an aggressively competitive price point for the local market.

> [!TIP]
> This is your #1 weapon in Sri Lanka. A local shop owner won't pay Rs. 6,000+/month
> for WhatChimp when SalesPilot does what they need for Rs. 1,490.

---

## Feature-by-Feature Comparison

### ✅ Features SalesPilot Has That WhatChimp Does NOT

These are your **genuine competitive advantages**:

| Feature | SalesPilot | WhatChimp |
|---|---|---|
| **Full order management system** | ✅ Orders, status tracking, Kanban, late alerts | ❌ None — they only send messages about orders |
| **Built-in product catalog with stock control** | ✅ Products, stock, categories, Cloudinary images | ❌ WA Catalog only (no backend stock management) |
| **Finance analytics** | ✅ Revenue charts, top products, monthly stats | ❌ Campaign reporting only (delivery/reads, not revenue) |
| **Customer blacklist** | ✅ Block abusive customers by phone | ❌ Not mentioned |
| **Monthly Intelligence Report** | ✅ Auto WhatsApp business report to owner | ❌ Not mentioned |
| **Payment proof verification workflow** | ✅ Bank slip upload → admin queue → approve/reject | ❌ Has WhatsApp Payments but not bank transfer proof flow |
| **Multi-language bot (Sinhala-first)** | ✅ `sinhala_first` / `english_first` setting | ❌ Translation only on Pro (incoming only) |
| **Onboarding seed data** | ✅ One-click demo products + rules seeding | ❌ Not mentioned |
| **Delivery follow-up cron** | ✅ 7-day automated follow-up for orders | ❌ Only generic "automated follow-up bot" for leads |
| **Session management (device revocation)** | ✅ Active sessions, revoke individual/all, login history | ❌ Not mentioned |
| **Audit log per tenant** | ✅ Append-only ledger, CSV export, risk tags | ❌ Not mentioned |
| **Vertically integrated** | ✅ One system: bot + store + orders + CRM | ❌ Horizontal tool — needs integrations for all of this |

---

### ❌ Features WhatChimp Has That SalesPilot Is Missing

These are your **gaps to close** (or consciously ignore):

| Feature | WhatChimp | SalesPilot | Priority to add |
|---|---|---|---|
| **Bulk broadcast / campaign blast** | ✅ Core feature | ❌ No broadcast feature | 🟠 Medium |
| **Drag & drop chatbot builder (visual)** | ✅ No-code flow builder | ❌ Rules are text-based JSON/form | 🟡 Low (complex to build) |
| **Shared team inbox (multi-agent)** | ✅ 2–5 agents, assigned chats | ❌ No agent assignment | 🟠 Medium |
| **SMS Broadcasting** | ✅ Via Twilio | ❌ WhatsApp only | 🟢 Very low |
| **Omnichannel (Instagram + Facebook)** | ✅ Pro plan | ❌ WhatsApp only | 🟢 Not needed now |
| **Appointment Booking** | ✅ Pro plan | ❌ No booking system | 🟡 Low |
| **Click-to-WhatsApp Ad Integration** | ✅ Pro plan | ❌ No ad integration | 🟡 Low |
| **AI trained on PDF/Website** | ✅ "Train on your website" | ❌ FAQ rules + Gemini, not document-trained | 🟠 Medium |
| **Native WhatsApp Forms (Flows API)** | ✅ Pro plan | ❌ No WhatsApp Flows | 🟡 Low |
| **Contact segmentation & tagging** | ✅ Segment subscribers | ❌ Tags exist on customers but no segmented broadcast | 🟠 Medium |
| **Zapier / Make / N8N integrations** | ✅ All included | ❌ None | 🟡 Low (different audience) |
| **Campaign read/delivery tracking** | ✅ Per-campaign reporting | ❌ Message counts only | 🟠 Medium |
| **Number Coexistence (app + WhatChimp)** | ✅ Key differentiator | ❌ Standard Meta Cloud API setup | 🟢 Low |
| **Phone number masking (agents)** | ✅ Pro plan | ❌ No agents system | 🟢 Low |
| **White-label (remove branding)** | ✅ Pro plan | ✅ Already no "Powered by" text | ✅ Already done |

---

## What WhatChimp Does Better (Honestly)

1. **Marketing-focused features** — Their broadcast, campaign analytics, and lead nurturing flows are more mature. If a Sri Lankan marketing agency wants to run WhatsApp campaigns, WhatChimp is the right tool.

2. **Integrations ecosystem** — Zapier, Make, N8N, Shopify, WooCommerce, Google Sheets, webhooks. SalesPilot has zero third-party integrations.

3. **AI trained on documents** — Their AI Agent can ingest PDFs and websites. SalesPilot's AI uses Gemini but is limited to FAQ rules you manually enter.

4. **Multi-agent shared inbox** — Proper chat assignment, routing, manager monitoring. SalesPilot has a single-tenant CRM inbox with no agent assignment.

5. **Scale and polish** — They're a global company (GrowMeOrganic LLC, US-based), Meta Business Partner (verified ID), 90+ countries, 7-year-old product. SalesPilot is earlier stage.

---

## What SalesPilot Does Better (Your Real Advantages)

1. **It's an actual store, not just a messaging tool.** WhatChimp cannot manage your inventory, process orders, or show you your revenue. SalesPilot does all three.

2. **LKR pricing for Sri Lankan businesses.** This alone eliminates WhatChimp as a practical competitor for your target market.

3. **End-to-end commerce flow.** Customer messages → bot responds → adds to cart → places order → payment proof submitted → order tracked → delivery follow-up sent. WhatChimp needs 5 different integrations to replicate this.

4. **Sinhala language support.** No global tool targets Sinhala-first communication. This is a moat.

5. **Simpler onboarding for non-technical users.** Your seeded demo data, activation code flow, and guided setup are built for a shop owner, not a marketing team.

---

## Strategic Recommendation

> [!IMPORTANT]
> **Don't try to copy WhatChimp's feature list.** That's a losing game — they 
> have 7 years head start, a US engineering team, and 90-country scale. You 
> will run out of runway trying to match them feature-for-feature.

**Your winning strategy is to go DEEPER, not wider:**

### Go Deeper on Commerce (Your Moat)
- **Quotation/Invoice generation** — create a PDF invoice from an order and send it via WhatsApp
- **Return/Refund flow** — customer says "I want to return this" → bot handles it
- **Pre-order & deposit collection** — partial payment for made-to-order items
- **Loyalty points or repeat customer discounts** — reward returning WhatsApp customers
- **WhatsApp-native checkout** — use Meta's native cart (you started this with Meta Catalog)

### Add Just Enough Marketing to Not Lose Deals
- **Simple broadcast to existing customers** — "Hey we have a sale" to your customer list
- This is the one WhatChimp feature your users will actually ask for

### Protect the Localisation Moat
- Keep Sinhala first-class, not an afterthought
- Build for Sri Lankan business norms (bank transfer, COD, delivery zones)
- Consider Tamil as a second language for Northern/Eastern markets

---

## Verdict

| Dimension | Winner | Notes |
|---|---|---|
| Price (Sri Lanka) | **SalesPilot** | 5–10x cheaper in LKR |
| Commerce Features | **SalesPilot** | WhatChimp has none |
| Marketing/Broadcast | **WhatChimp** | Their core product |
| Integrations | **WhatChimp** | Zapier, Shopify, etc. |
| Local Language | **SalesPilot** | Only Sinhala-first product |
| AI Quality | **Tied** | Both use LLM APIs |
| Multi-agent Inbox | **WhatChimp** | SalesPilot has no agents |
| Maturity/Polish | **WhatChimp** | 7 years vs early stage |
| Vertical Focus | **SalesPilot** | WhatChimp is horizontal |

**For a Sri Lankan retail/e-commerce business: SalesPilot wins on price, local fit, and end-to-end commerce.**  
**For a Sri Lankan marketing agency running campaigns: WhatChimp is the better tool.**

These are different customers. You don't need to beat WhatChimp — you need to be the obvious choice for *your* customer.
