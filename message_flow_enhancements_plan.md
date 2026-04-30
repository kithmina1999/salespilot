# SalesPilot v2 — Message Flow Enhancement Plan

> **Date**: 2026-04-30
> **Target**: `backend/whatsapp/` (Pipeline, Order Bot, Webhook)

This document outlines the architectural decisions and implementation steps to harden the SalesPilot message flow, as agreed upon during the grill-me session.

---

## 1. Custom Business Greetings

**Problem**: The custom `business.GreetingMessage` is currently only injected as background context for Gemini, while a global FAQ Rule #1 ("hello", "hi") often preempts it and fires first, causing the bot to ignore the merchant's custom greeting.

**Decision**:
- We will deterministically pre-pend the `business.GreetingMessage` (if set) to the *first* AI or FAQ reply of the day.
- We will also pre-pend it to the first Order Bot message of the day if the customer initiates an order flow.
- We will conditionally ignore the global FAQ Rule #1 if the business has a custom greeting defined, preventing collisions.

**Implementation Steps**:
1. **First Message Check**: Create a helper `isFirstMessageToday(businessID, phone)` that queries the `messages` table (`role = 'user' AND created_at >= start_of_day`) with a `LIMIT 2`. If count == 1, it's their first message today.
2. **Order Flow Greeting**: In `handleCartMessage` (specifically `startOrderFlow`), call `isFirstMessageToday`. If true, pre-pend a bilingual greeting: `"Welcome! Let's get your order started. / ආයුබෝවන්! අපි ඔබගේ ඇණවුම ආරම්භ කරමු.\n\n"` to the product list message.
3. **FAQ/AI Greeting**: Modify `enrichAndSend` to accept an optional `prefix` argument. In `HandleIncomingMessage`, if `isFirstMessageToday` is true, pass `business.GreetingMessage + "\n\n"` as the prefix to `enrichAndSend`.
4. **Rule #1 Override**: In `matchFAQ`, after finding a rule, if `rule.ID == 1` AND `business.GreetingMessage != ""`, treat it as a "no match" and fall through to Gemini (which will now get the prepended greeting).

---

## 2. Order Notes Validation

**Problem**: The `pending_notes` state accepts any text input. Customers typing filler words like "ok", "continue", or "next" (intending to skip) have those words saved as actual order notes.

**Decision**:
- We will use a strict, exact-match filter for common filler words. If the customer types *exactly* one of these words, we treat it as a "skip" and save an empty note.

**Implementation Steps**:
1. In `order_bot.go` -> `handlePendingNotes`, define a static slice:
   `fillerWords := []string{"ok", "okay", "continue", "next", "skip", "no", "none"}`
2. Trim space and lowercase the `msg`.
3. If `msg` exactly matches any word in the slice (or the explicit `skip_notes` button), set `notes = ""`. Otherwise, save the full string as the note.

---

## 3. Rate Limit Enhancements

**Problem**: The 'add_more' state (where customers decide to add another product or checkout) is currently subject to burst rate limiting. Rapidly clicking buttons here triggers false-positive spam blocks.

**Decision**:
- Exempt the `add_more` state from the burst rate limit, alongside the pinned checkout states.

**Implementation Steps**:
1. In `pipeline.go` -> `inCheckoutFlow()`, add `"add_more"` to the `state IN ?` clause array.

---

## 4. Visual Media Integration

**Problem**: `HandleImageWebhook` currently queues images for Vision analysis but doesn't integrate the findings back into the active cart flow.

**Decision**:
- If Gemini Vision identifies a specific product from the catalog, we should send a Product Card prompting them to buy, keeping them in the `browsing` state.
- If it fails to match or identifies a non-product image, send a standard apology to keep the user engaged.

**Implementation Steps**:
1. Modify `HandleImageWebhook` (or the worker processing it) to query the active catalog based on Vision's output.
2. If a match is found, call `SendProductCard` (similar to native Meta catalog flow).
3. If no match, send: `"I couldn't find a matching product for this image. Can you describe what you're looking for?"`

---

## 5. Delivery Confirmation Acknowledgment

**Problem**: Layer 3.4 passively detects delivery confirmations ("received") and marks the order delivered silently.

**Decision**:
- Acknowledge the confirmation to close the loop with the customer.

**Implementation Steps**:
1. In `delivery_detect.go` (or where `HandleDeliveryDetection` is defined), after successfully updating the order status, add a `botSendText` call: `"Thanks! Your order has been marked as delivered."`

---

## 6. Robust Webhook Deduplication

**Problem**: Deduplication relies on an in-memory map (`processedMsgs`), which resets on server restarts, leading to duplicate processing of Meta retries.

**Decision**:
- Implement DB-backed deduplication using a lightweight table.

**Implementation Steps**:
1. Create a `ProcessedWebhook` model (Fields: `ID` string primary key, `CreatedAt` time).
2. Update `isAlreadyProcessed` in `webhook.go` to use `database.DB.FirstOrCreate` or an atomic `INSERT ON CONFLICT DO NOTHING`.
3. (Optional but recommended) Add a cron job to clean up rows older than 24 hours.

---

## 7. Improved Gibberish Detection

**Problem**: The current vowel-only test for gibberish allows random consonant strings (like "dfgh") to pass if they happen to contain a vowel, or blocks valid consonant-heavy abbreviations.

**Decision**:
- Use length and vowel absence combined.

**Implementation Steps**:
1. Update `isLikelyGibberish` in `pipeline.go`:
   - If length > 3 AND contains no vowels AND contains no Sinhala characters -> return true (gibberish).

---

## 8. Gemini Context Cleaning

**Problem**: Prefix strings like `[List]` and `[Buttons]` are saved in the DB and passed to Gemini.

**Decision**:
- Keep them. We agreed they provide valuable UI context to the AI. No code changes required here.

---

## Execution Order
1. Implement Rate Limit fix (1 line change).
2. Implement Order Notes filter.
3. Implement Gibberish filter update.
4. Implement DB Deduplication.
5. Implement Delivery Acknowledgment.
6. Implement Custom Greeting logic (most complex).
7. Implement Vision Cart Integration.