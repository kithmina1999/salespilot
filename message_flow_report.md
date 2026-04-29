# SalesPilot WhatsApp Bot — Complete Message Flow Report

> Generated: 2026-04-08  
> Files covered: `webhook.go`, `pipeline.go`, `order_bot.go`, `hook_engine.go`,
> `intent_classifier.go`, `normalize.go`, `embedding.go`

---

## 1. Entry Point — `webhook.go`

```
POST /webhook/meta
```

### Steps (in order)

| Step | What Happens | File |
|---|---|---|
| 1 | HMAC-SHA256 signature check (`X-Hub-Signature-256` header) | `webhook.go:224` |
| 2 | Return `200 OK` immediately (before any processing) | `webhook.go` |
| 3 | `processWebhookPayload()` runs **synchronously** in same goroutine | `webhook.go:141` |
| 4 | Filter `change.Field != "messages"` — skip status updates | `webhook.go:146` |
| 5 | Lookup `business` by `wa_phone_number_id` | `webhook.go:157` |
| 6 | Build `nameMap` from contacts array for `PushName` | `webhook.go:165` |
| 7 | Per message: extract text from `text.body` or `interactive.button_reply.id` / `list_reply.id` | `webhook.go:173` |
| 8 | Call `pipeline.HandleIncomingMessage(business, incoming)` | `webhook.go:217` |

> [!IMPORTANT]
> **No message-level deduplication exists.** If Meta retries the webhook (after ~60s), the message is processed twice → **duplicate product cards, duplicate replies**. Fix: track `msg.ID` in a short-lived in-memory map.

> [!NOTE]
> Button taps (`button_reply`) and list selections (`list_reply`) are **converted to their ID string** and treated identically to typed text from here on.

---

## 2. Pipeline Entry — `pipeline.go:HandleIncomingMessage`

### 2A. Pre-Flight Checks (Silent / Hard Stops)

```
Message → Layer 1 → Layer 2 → Layer 3 → ...
```

| Layer | Check | Pass | Fail |
|---|---|---|---|
| **L0** | `text == ""` (non-text message) | continue | **silent drop** |
| **L1** | Blacklist check — `blacklisted_numbers` table | continue | **silent drop** |
| **L1.5** | Customer `FirstOrCreate` + identity update (`name`, `whatsapp_jid`) | continue | — |
| **L2** | **Rate Limit Tier 1**: 8 messages / 3 minutes | continue | send "too fast" warning + return |
| **L2** | **Rate Limit Tier 2**: 40 messages / hour → auto-blacklist | continue | send block notice + return |
| **L2 (new)** | If cart is in `pending_address/notes/confirm` → **skip rate limit** | exempt | — |
| **L2.5** | `ScheduleDeliveryCheck` goroutine deferred (fires after reply) | async | — |
| **L3** | Bot Pause check (`customer.BotPaused`) | continue | **silent drop** |
| **L3** | Usage cap: Free plan > 200 system messages | continue | send limit message + return |
| **L3.4** | **Delivery Detection**: `HandleDeliveryDetection()` scans for "received", "ලැබුනා", etc. | handled=true → return | continue |

### 2B. Message Normalization (invisible, runs inside matchFAQ)

`NormalizeMessage(text)` (in `normalize.go`):
1. Sinhala Unicode → Singlish romanization (e.g., `ආයුබෝවන්` → `"greeting"`)
2. Strip leading filler words (oya, api, mama, etc.)
3. Regex rules: price queries → "price", greetings → "greeting", etc.
4. Trim + lowercase

---

## 3. Main Processing Pipeline (Layer 3.5+)

After pre-flight passes, `HandleIncomingMessage` runs these layers in order:

```
L3.5 → Order Bot
L4   → FAQ Keyword Match
L5   → Semantic Embedding Match
L6   → AI Usage Limit Check
L6.5 → Native Catalog (optional)
L7   → Gemini AI
```

---

## 4. Layer 3.5 — Order Bot (`handleCartMessage`)

Called **before** FAQ. Returns `bool`: true = handled (pipeline stops), false = fall through.

### 4A. No Active Cart Path

```
handleCartMessage → DB: find active cart → not found
    ↓
Switch on msg:
  "order_intent"      → startOrderFlow()       → return true
  "browse_more"       → showProductList()       → return true
  "order_status_check"→ showCustomerOrders()    → return true
  "delivery_yes/no"   → handleDelivery*()       → return true
    ↓ (none matched)
isBrowseSignal(msg) || detectCatalogIntent(msg) → showProductList() → return true
detectOrderIntent(msg)                          → startOrderFlow()  → return true
    ↓ (nothing matched)
return false → fall through to FAQ
```

**detectOrderIntent keywords:** `order, buy, purchase, want to buy, add to cart, place order, how to order, ganna, order karanna, mata eka onna, katta ganna`

**isBrowseSignal keywords:** `what else, show more, more products, other products, what do you have, browse, see products, available, product, products, catalog, list, show me`

**detectCatalogIntent keywords** (broader): also includes `shop, shopping, stock, in stock, mokakda, ganna, rate, rates, kiyada` + Sinhala script equivs.

### 4B. Active Cart — Global Escape Check

```
handleCartMessage → cart found
    ↓
isGlobalEscapeIntent(msg)?
  YES → DB: cart.state = "abandoned" → send "Cart cleared" + buttons → return true
  NO  → continue
```

**Escape keywords:** `exit, quit, cancel, stop, nevermind, clear cart, start over, main menu, restart, stop order`

### 4C. Active Cart — Two-Tier Smart Bypass

Only applies to `browsing` and `add_more` states (loose states):

```
cart.State == browsing || add_more?
  YES → ClassifyMessageIntent(msg) → result?
    "general" → return false (FAQ+Gemini handles it, cart stays alive in DB)
    "shopping"|"browse"|"escape" → continue to advanceCart()
  NO (pinned state: address/notes/confirm) → always continue to advanceCart()
```

**ClassifyMessageIntent — Two Tiers:**
- **Tier 1 (≤5 words):** keyword matching, zero cost
  - Escape → `"escape"`
  - Greeting prefix (`hello `, `hi `, `hey !`, `good morning`) → `"general"`
  - Browse/catalog signal → `"browse"`
  - Order intent → `"shopping"`
  - Default → `"shopping"`
- **Tier 2 (>5 words):** embed + cosine vs cached centroids
  - Cost: ~$0.000001 per call
  - Threshold ≥ 0.70 → confident; < 0.70 → keyword fallback
  - Categories: shopping / browse / general

### 4D. Active Cart — State Machine (`advanceCart`)

| Cart State | Handler | What It Does |
|---|---|---|
| `browsing` | `handleBrowsing` | `item:ID` button → product card; text → product name search; else → show list |
| `item_selected` | `handleItemSelected` | "Add to Cart" → qty; shows size/color pickers if product has variants |
| `pending_size` | `handlePendingSize` | Validates size against product options; advances to color or qty |
| `pending_qty` | `handlePendingQty` | Parses number 1–99; adds item to cart JSON; → `add_more` state |
| `add_more` | `handleAddMore` | "checkout"→address flow; "browse_more"→back to browse; browse signal → browse; else → checkout reminder |
| `pending_address` | `handlePendingAddress` | addr:new / addr:{id} button → prompt/select; text → validate → commitAddress |
| `pending_notes` | `handlePendingNotes` | Any text → save notes; "skip" button → no notes; → `pending_confirm` |
| `pending_confirm` | `handlePendingConfirm` | "confirm_order" → create Order record, notify business, → `placed`; "cancel_order" → `abandoned` |

### 4D.1 Address Validation Pipeline (new)

```
handlePendingAddress receives text input:
  1. isInabilityPhrase()?         → "No worries 😊" + Cancel button
  2. IsLikelyAddress()?           → embedding check vs valid/invalid centroids
     - addrValidatorReady = true  → embed + cosine (cost ~$0.000001)
       - confidence < -0.02       → "That doesn't look like an address" 
       - else                     → accept
     - addrValidatorReady = false → looksLikeAddress() heuristic fallback
       - has digit OR comma/slash OR known city → accept
       - len < 2 distinct words + < 5 unique chars → reject
  3. len(address) < 5?            → "Please type full address"
  4. commitAddress()              → save to saved_addresses + advance state
```

---

## 5. Layer 4 — FAQ Keyword Match (`matchFAQ`)

> Only runs if order bot returns **false**

```
NormalizeMessage(text) → normalized

Stage 1A: AND-combination keywords (highest specificity)
  e.g. keyword = "keda+price" → BOTH "keda" AND "price" must appear
  → most parts wins if multiple match
  → gateConf(): short msg (≤5w) OR kw/msg ratio ≥ 40% → "high"; else "medium"

Stage 1B: Single keyword exact word-boundary match
  → wbMatch() using regex word boundaries
  → gateConf() same as above

Stage 1C: Fuzzy match (Jaro-Winkler ≥ 0.85)
  → always "medium" confidence (never direct reply)
```

### FAQ Confidence Routing

| Confidence | Rule Type | Action |
|---|---|---|
| `high` | IsDropRule | **Silent drop** (no reply) |
| `high` | IsContextBridge | Re-prompt last bot question |
| `high` | Normal | `enrichAndSend()` → reply + hooks |
| `medium` | IsDropRule | Silent drop |
| `medium` | IsContextBridge | Re-prompt |
| `medium` | Normal | `faqHint` stored → injected into Gemini later |

### Language Selection (`selectReply`)

1. Message is Sinhala/Singlish AND `SinhalaResponse` exists → Sinhala
2. Business prefers `english_first` AND message is English → English
3. Default: Sinhala if available, else English

---

## 6. Layer 5 — Semantic Embedding Match (`semanticMatch`)

> Only runs if keywords returned no match (no rule at all)

```
EmbedText(msg) → vector
CosineSimilarity vs all cached rule embeddings
→ best_score

≥ 0.87 → "high"   → enrichAndSend() (direct reply)
≥ 0.68 → "medium" → faqHint (Gemini hint only)
< 0.68 → no match
```

**Cost:** 1 embedding API call (~$0.000001)

---

## 7. Layer 6 — AI Usage Check

```
Plan check:
  planIsActive = Plan != Free AND (PlanExpiresAt nil OR not expired)
  hasAIAccess  = planIsActive OR IsInActiveTrial()

No AI access:
  faqHint exists → send faqHint as plain text
  else → "Thank you for your message! Contact us directly."
  → return

AI access:
  business.AIMessageCount++
  maxAI = business.AIMessageLimit (plan constant, not DB value)
  Plan Pro → maxAI = -1 (unlimited)
  Count > maxAI → "too many questions" error → return
```

---

## 8. Layer 6.5 — Native Meta Catalog (optional)

```
business.MetaCatalogID != "" AND detectCatalogIntent(text)?
  YES:
    Load products with retailer_id set
    Name match in normalized text → SendProductCard() (PDP)
    No match → SendCatalogMessage() (full catalog)
    → log message to DB → return
  NO → continue to Gemini
```

> [!NOTE]
> Only fires if the business has set up a Meta Commerce Catalog AND the customer is asking about products. Falls through to Gemini if the catalog API call fails.

---

## 9. Layer 7 — Gemini AI (`callGemini`)

```
Fetch last 10 messages from DB (descending → reversed → chronological)
Build system_instruction:
  - botName (business.BotName or "the AI Sales Assistant")
  - Language rule (Sinhala / Singlish / English policy)
  - business.GreetingMessage → injected as CONTEXT hint (not sent directly)
  - business.OperatingHours → context
  - business.DeliveryPolicy → context
  - Live inventory (all active products with price, stock, description, image URL)
  - faqHint (if medium keyword match earlier)

POST to gemini-2.5-flash API

Extract reply text
enrichAndSend(business, phone, fromRaw, reply, originalText)
```

> [!WARNING]
> **`business.GreetingMessage` is NEVER sent directly to the customer.** It is only injected as Gemini context. The custom /settings greeting is not used as the actual greeting reply — the global FAQ Rule #1 handles greetings instead.

---

## 10. Hook Engine — `enrichAndSend` / `enrichReply`

Runs after every FAQ direct reply or Gemini reply.

```
enrichReply():
  hasActiveCart(phone, businessID)?
    YES → return plain text (no hooks — don't interrupt checkout)
    NO  → continue

  detectProductMention(businessID, originalMsg + replyText)?
    YES → buildProductHook()
    NO  → buildGenericHook()
```

### Product Hooks (priority order)

| Priority | Condition | Hook Added | Plan |
|---|---|---|---|
| 1 | `stock ≤ 10` OR `stock/maxStock ≤ 15%` | `⚠️ Only N left!` + Order Now button | Pro |
| 2 | Product is top-3 ordered in last 30 days | `🔥 Most popular!` + Order Now | Pro |
| 3 | Customer previously bought this product | `😊 You've ordered this before!` + Reorder | Pro |
| 4 | Generic (all plans) | `🚚 We deliver island-wide!` + Order Now | All |

### Generic Hooks

| Trigger keywords | Buttons added |
|---|---|
| `order status, my order, track, where is, dispatch, delivered` | My Orders + Browse |
| `hello, hi, hey, help, menu, what can, start` | Browse + Place Order + My Orders |
| (nothing) | plain text, no buttons |

---

## 11. Startup Initialization (Background Goroutines)

At server start, these run asynchronously:

| Task | Function | What it does | Cost |
|---|---|---|---|
| FAQ embedding | `EmbedAllMissingRules()` | Embeds all rules without embeddings | ~$0.000001 × N rules |
| Intent classifier | `InitIntentClassifier()` | Embeds 30 anchor phrases (3 categories × 10) → centroids | ~$0.000001 × 30 |
| Address validator | `initAddressValidator()` | Embeds 20 anchor phrases (10 valid + 10 garbage) → centroids | ~$0.000001 × 20 |

> Ready in ~10–15 seconds. Falls back to keyword heuristics until ready.

---

## 12. Complete Scenario Walkthroughs

### Scenario A: Customer Greets ("hello byteshift")

```
webhook → pipeline
→ L1: not blacklisted
→ L2: rate limit OK (≤8/3min)
→ L3: not paused
→ L3.4: no delivery keywords
→ L3.5: handleCartMessage
  → no active cart
  → msg = "hello byteshift" → not in button IDs
  → isBrowseSignal? NO
  → detectOrderIntent? NO (no "order","buy"... → false)
  → return false
→ L4: matchFAQ
  → NormalizeMessage("hello byteshift") → "hello byteshift"
  → Stage 1B: keyword "hello" → WORD BOUNDARY MATCH → Rule #1 Greeting
  → gateConf: 2 words ≤ 5 → "high"
  → Rule is not DROP, not ContextBridge
  → selectReply(): English reply
  → enrichAndSend():
      → no active cart → run hooks
      → no product mention → buildGenericHook
      → "hello" in lower → 3 buttons: Browse + Order + My Orders
  → REPLY: "Hello! 👋 Welcome!" + 3 buttons
  → return
```

> [!WARNING]
> **`business.GreetingMessage` is IGNORED here.** The generic global FAQ Rule #1 fires. This is the known gap between /settings custom greeting and actual behavior.

---

### Scenario B: Customer Orders ("i want to order a key")

```
→ L3.5: handleCartMessage
  → no active cart
  → detectOrderIntent("i want to order a key") → "order" match → true
  → startOrderFlow() → create cart (browsing, 24hr TTL) → showProductList()
  → REPLY: WhatsApp list message with all products
  → return true
```

---

### Scenario C: Customer Asks FAQ Mid-Cart ("what is your return policy?")

```
→ L3.5: handleCartMessage
  → active cart found (state = browsing)
  → isGlobalEscapeIntent? NO
  → cart.State == browsing → ClassifyMessageIntent("what is your return policy?")
    → Tier 2 (6 words): embedding → cosine → closest to "general" centroid
    → intent = "general"
  → return false (bypass)
→ L4: matchFAQ
  → keyword "refund,return..." → Rule #7 match → "high"
  → enrichAndSend(): "Returns accepted within 7 days..."
  → Cart is STILL ALIVE IN DB (not cancelled)
```

---

### Scenario D: Customer Asks about Products Mid-Cart ("can i see what else you have?")

```
→ L3.5: handleCartMessage
  → active cart (state = browsing)
  → isGlobalEscapeIntent? NO
  → ClassifyMessageIntent("can i see what else you have?")
    → Tier 2: embedding → closest to "browse" centroid
    → intent = "browse"
  → NOT bypassed → advanceCart() → handleBrowsing()
  → handleBrowsing: msg not "item:", no product name LIKE match
  → Default: showProductList() → REPLY: product list
  → return true
```

---

### Scenario E: Customer Enters Garbage Address ("dawdawdawd")

```
→ L3.5: handleCartMessage
  → active cart (state = pending_address)
  → NOT loose state → no ClassifyMessageIntent bypass
  → advanceCart → handlePendingAddress
  → isInabilityPhrase("dawdawdawd")? NO (no inability patterns)
  → IsLikelyAddress("dawdawdawd"):
    → addrValidatorReady? 
      YES: embed → valid score 0.XX, invalid score 0.YY
           "dawdawdawd" is closer to garbage → confidence < -0.02
           → return false
      NO: looksLikeAddress() → 1 word, 3 unique chars < 4 → false
  → REPLY: "📍 That doesn't look like a delivery address..."
```

---

### Scenario F: Customer Types "continue" During Notes (Rate Limit Scenario)

```
→ L2: checkBurstLimit(phone) → TRUE (>8 msgs/3min from rapid testing)
  → inCheckoutFlow()?
    → DB query: cart WHERE state IN (pending_address, pending_notes, pending_confirm)
    → FOUND → return true
  → inCheckoutFlow() = true → skip rate limit → continue
→ L3.5 → advanceCart → handlePendingNotes
  → "continue" treated as notes text → saves "continue" as notes
  → advances to pending_confirm
```

> [!TIP]
> The rate limit exemption only covers `pending_*` pinned states. `browsing` and `add_more` states are NOT exempt — a customer rapidly clicking "Browse" buttons in those states can still get rate-limited.

---

### Scenario G: Customer Escapes Cart ("exit")

```
→ L3.5: handleCartMessage
  → active cart found (any state)
  → isGlobalEscapeIntent("exit") → TRUE
  → DB: cart.state = "abandoned", expires_at = now
  → REPLY: "No problem! 😊 Your cart has been cleared." + Browse + My Orders buttons
  → return true
```

---

### Scenario H: Gemini answers a General Question (no FAQ match)

```
→ L3.5: return false (no cart, no order intent)
→ L4: matchFAQ → no keyword match
→ L5: semanticMatch → embed → best cosine < 0.68 → no match
→ isLikelyGibberish? NO
→ Log to UnmatchedMessages table
→ L6: hasAIAccess? YES (trial/paid plan)
→ L6.5: MetaCatalogID? empty → skip
→ callGemini():
  → Fetch last 10 messages
  → Build system prompt with botName, language, inventory, GreetingMessage (context)
  → POST to gemini-2.5-flash
  → extractGeminiText()
  → enrichAndSend() → hooks → reply
```

---

## 13. Known Issues & Gaps

| # | Issue | Severity | Root Cause |
|---|---|---|---|
| 1 | Duplicate replies (Meta webhook retry ~60s) | 🔴 High | No message-ID deduplication |
| 2 | Custom GreetingMessage never sent directly | 🟡 Medium | FAQ Rule #1 fires before it's used |
| 3 | "continue" saved as order notes | 🟡 Medium | Notes step accepts any text |
| 4 | Intent classifier not ready for first ~15s | 🟢 Low | Background init; keywords used as fallback |
| 5 | `add_more` state not exempt from rate limit | 🟢 Low | inCheckoutFlow only checks pinned states |
| 6 | Gibberish check uses vowel-only test | 🟢 Low | Consonant-only English words pass (rare) |
| 7 | Gemini history includes model messages with "[List]" prefix | 🟢 Low | Bot-sent lists logged as "[List] ..." |

---

## 14. Data Written Per Message (DB Writes)

| When | Table | What |
|---|---|---|
| Every message | `messages` (role=user) | Customer text, businessID, phone |
| Every reply | `messages` (role=model) | Bot reply text |
| FAQ match | `rules.usage_count++` | +1 |
| FAQ/Gemini reply | `businesses.faq_reply_count++` | +1 |
| Any message | `businesses.system_message_count++` | +1 |
| Gemini used | `businesses.ai_message_count++` | +1 |
| No FAQ match | `unmatched_messages` | Raw message + normalized |
| Order confirmed | `orders` | Full order record |
| Address saved | `saved_addresses` | "📍 Last Used" entry |
| Rate limit exceeded | `blacklisted_numbers` + `audit_logs` | Auto-blacklist |
| Cart state change | `carts` | State + relevant fields |

---

## 15. Cost Per Message (API calls)

| Scenario | Embedding calls | Gemini calls | Approx cost |
|---|---|---|---|
| FAQ exact match | 0 | 0 | $0.00 |
| FAQ + intent classify (long msg) | 1 (classifier) | 0 | ~$0.000001 |
| Semantic FAQ match | 1 (msg embed) | 0 | ~$0.000001 |
| Gemini fallback | 1 (semantic) + 1 (intent, if long) | 1 | ~$0.000002 + Gemini cost |
| Address validation | 1 (addr embed) | 0 | ~$0.000001 |
| Order flow (browsing, button taps) | 0 | 0 | $0.00 |
