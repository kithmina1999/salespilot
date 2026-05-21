# SalesPilot Mobile App Architecture Plan

Date: 2026-05-11

## Recommendation

Build a native merchant app with Expo React Native, not a desktop-first companion.
The first mobile version should be a focused operator app for shop owners and
staff: orders, inbox, product updates, payment proof review, plan status, and
push alerts.

Keep WhatsApp connection and bot execution on the Go backend through the current
Meta Cloud API flow. The mobile app is the control panel, not the WhatsApp
client.

## Current Application Map

The web tenant dashboard already exposes the core workflows a mobile app needs:

- Auth and account setup: login, register, email verification, password reset,
  onboarding, language setup, WhatsApp connection.
- Dashboard: sales KPIs, pending orders, automation metrics, missing FAQ
  knowledge, quota usage, WhatsApp connection banners.
- Orders: order list, status updates, bank-transfer proof approval/rejection,
  late delivery alert toggles.
- Chats: inbox, conversation detail, manual reply, CRM notes/tags, bot pause.
- Products: catalog list, create/update/delete, image upload, active toggle.
- Rules: custom FAQ rules, templates, AI generation, translation, simulator.
- Usage and billing: plan status, payment proof upload, activation code redeem.
- Settings: business profile, payment settings, language, reports, blacklist,
  audit logs, security/session management.

The Go backend already has most mobile-ready routes under `/api/v1`:

- `/api/v1/auth/*`
- `/api/v1/billing/*`
- `/api/v1/onboarding/*`
- `/api/v1/whatsapp/*`
- `/api/v1/products`
- `/api/v1/rules`
- `/api/v1/chats`
- `/api/v1/orders`
- `/api/v1/finance/*`
- `/api/v1/dashboard/*`
- `/api/v1/settings/*`

## Mobile Product Positioning

The mobile app should answer one question:

> "What needs my attention right now?"

This means the mobile app should not copy the whole web dashboard page-for-page.
It should prioritize operational actions:

1. New orders to confirm.
2. Customer messages needing a human reply.
3. Bank transfer proofs to approve or reject.
4. Products that need stock/photo updates.
5. Bot knowledge gaps that can be turned into FAQ rules.
6. WhatsApp/account/billing issues blocking the bot.

## Tech Stack

Use:

- Expo React Native
- TypeScript
- Expo Router
- TanStack Query
- Zustand for small UI/session state
- Expo SecureStore for auth tokens
- Expo Notifications for push tokens and notification handling
- Expo ImagePicker for camera/gallery product and receipt uploads
- NativeWind or Tamagui for styling
- EAS Build for Android/iOS builds

Why:

- The existing web app is already React and TypeScript.
- Expo Router gives file-based routing similar to Next.js.
- Expo has first-party support for push notifications, SecureStore, camera and
  image picker flows.
- TanStack Query has React Native integration patterns for app focus and network
  state, which fits mobile better than browser-focused SWR patterns.

## Repository Structure

Add a new app at repo root:

```text
mobile/
  app/
    _layout.tsx
    index.tsx
    (auth)/
      _layout.tsx
      login.tsx
      register.tsx
      verify-email.tsx
      forgot-password.tsx
    onboarding/
      _layout.tsx
      language.tsx
      connect-whatsapp.tsx
      business-type.tsx
      starter-rules.tsx
      done.tsx
    (tabs)/
      _layout.tsx
      home.tsx
      orders.tsx
      inbox.tsx
      products.tsx
      more.tsx
    orders/
      [id].tsx
      proof-review.tsx
    inbox/
      [phone].tsx
      customer.tsx
    products/
      new.tsx
      [id].tsx
    rules/
      index.tsx
      new.tsx
      [id].tsx
      gaps.tsx
    billing/
      usage.tsx
      subscribe.tsx
      activate.tsx
    settings/
      profile.tsx
      whatsapp.tsx
      payments.tsx
      language.tsx
      security.tsx
  src/
    api/
      client.ts
      queryClient.ts
      queryKeys.ts
      types.ts
    features/
      auth/
      home/
      orders/
      inbox/
      products/
      rules/
      billing/
      settings/
      notifications/
    components/
      ui/
      empty-states/
      forms/
      media/
    store/
      authStore.ts
      appStore.ts
    theme/
      colors.ts
      spacing.ts
      typography.ts
    utils/
      format.ts
      phone.ts
      upload.ts
```

Do not reuse web components directly. Reuse API knowledge, types, validation,
copy, and product logic. Native screens need native layouts and touch behavior.

## Navigation Model

Use five bottom tabs:

1. Home
2. Orders
3. Inbox
4. Products
5. More

The More tab links to Rules, Billing, Finance, Settings, Reports, Audit Logs,
and Help.

Reasoning:

- Orders, Inbox, and Products are the daily mobile workflows.
- Rules and Settings matter, but they are not checked every hour.
- Finance is useful as a summary, but mobile should not make it the main tab
  until merchants prove they use it daily.

## Screen Plan

### Auth

Screens:

- Login with email/phone and password.
- Register with business name, email, phone, password.
- Verify email OTP.
- Forgot password and reset password.

Mobile additions:

- Store token in SecureStore, not AsyncStorage.
- Add optional biometric unlock after first login.
- Add push permission prompt after login, not before account value is clear.

### Onboarding

Keep the same concept as web, but shorten the steps:

1. Dashboard language and bot reply language.
2. Business category.
3. Starter FAQ rules.
4. WhatsApp connection status.

Recommendation:

- Let WhatsApp connection be skipped on mobile.
- Move detailed Meta credential setup to web or an assisted mobile guide.
- Mobile should show connection status and deep link to help docs.

### Home

Home is not a chart dashboard. It is an action queue.

Top sections:

- Bot status: connected, disconnected, trial expired, quota near limit.
- Today's work: new orders, unread chats, proof reviews, late deliveries.
- Fast actions: add product, reply to inbox, add FAQ, upload payment proof.
- Today summary: revenue, orders, customers, AI handled percentage.
- Missing knowledge: top unanswered question with "create FAQ" action.

Backend suggestion:

- Add `/api/v1/mobile/bootstrap` or `/api/v1/mobile/home` to avoid 5-7 startup
  requests on mobile.

### Orders

Mobile should not use desktop Kanban as the primary UI.

Use:

- Status filter chips: New, Confirmed, Shipped, Delivered, Cancelled.
- Search by customer/name/phone/order number.
- Order cards with amount, customer, status, payment status, age.
- Order detail screen with full items, address, notes, status actions.
- One-tap actions: confirm, ship, mark delivered, cancel.
- Proof review sheet for bank transfer receipts.

Important mobile behavior:

- Use confirm sheets for irreversible actions.
- Keep status updates optimistic but rollback on failure.
- Show "needs review" and "late delivery" badges prominently.

### Inbox

Use a native chat pattern:

- Thread list with unread count and unmatched count.
- Chat detail with message bubbles.
- Reply composer.
- Quick reply snippets from FAQ rules.
- Customer profile bottom sheet: name, address, notes, tags.
- Bot pause toggle with duration.
- Related orders list.

Push notification opens:

- `/inbox/[phone]` when a message arrives.

Backend gap:

- Current web polls `/dashboard/notifications` every 30 seconds.
- Mobile needs push tokens and notification dispatch from backend events.

### Products

This is a high-value mobile workflow because phones have cameras.

Screens:

- Product list with active/draft filter.
- Add product.
- Edit product.
- Image capture/gallery picker.
- Stock update sheet.
- Active/draft toggle.

Mobile-specific features:

- Camera-first image upload.
- Compress/resize before upload.
- Detect missing image/price/stock as setup tasks.

### Rules

Avoid building the full desktop rules table first.

Mobile v1 should include:

- Knowledge gaps list.
- Create FAQ from missed customer question.
- Add/edit simple FAQ.
- Toggle active/inactive.
- Translate/generate later.

Post-MVP:

- Full rule table.
- Bulk translate.
- Sandbox simulator.
- Advanced multilingual editing.

### Billing And Usage

Screens:

- Current plan and trial/expiry.
- Usage meters.
- Subscribe with bank transfer proof upload.
- Activation code redeem.
- Payment status history.

Important:

- Fix backend billing proof plan handling before mobile billing ships.
- Mobile can use ImagePicker for receipt upload.
- Push notification should alert when payment proof is approved or rejected.

### Settings

Mobile v1:

- Business profile.
- WhatsApp connection status.
- Payment methods and bank details.
- Language.
- Notifications preferences.
- Security: change password, active sessions.

Post-MVP:

- Audit log export.
- Blacklist management.
- Monthly reports.
- Advanced appearance controls.

## Backend Additions Needed

### Device Tokens

Add model:

```go
type DeviceToken struct {
    ID        uint
    BusinessID uint
    UserID    uint
    Platform  string // ios | android
    Token     string // Expo push token or native token
    AppVersion string
    LastSeenAt time.Time
    CreatedAt time.Time
    UpdatedAt time.Time
}
```

Routes:

```text
POST   /api/v1/devices/register
DELETE /api/v1/devices/:id
POST   /api/v1/devices/heartbeat
```

Notification events:

- New order created.
- New unread customer thread.
- Order payment proof submitted.
- Payment proof approved/rejected.
- Quota near limit.
- Plan/trial expiring.
- WhatsApp disconnected.

### Mobile Bootstrap

Add:

```text
GET /api/v1/mobile/bootstrap
```

Response should include:

- User and business profile.
- WhatsApp status.
- Plan and usage summary.
- Action counts.
- Latest unread thread.
- Latest pending order.
- Feature flags.

This avoids slow mobile cold starts.

### API Contract

Current web code repeats types inside pages/hooks. For mobile, create a single
contract source:

- Option A: Add OpenAPI generation from Go handlers.
- Option B: Maintain `mobile/src/api/types.ts` manually at first.
- Option C: Move shared TypeScript types into `packages/api-types`.

Recommendation:

- Start with manual `mobile/src/api/types.ts`.
- Add OpenAPI later when routes stabilize.

## Data And State Architecture

Use TanStack Query for server state:

- Dashboard/bootstrap
- Orders
- Order detail
- Inbox
- Chat detail
- Products
- Rules
- Usage/billing
- Settings

Use Zustand only for local app state:

- Auth session metadata
- Selected business/user snapshot
- Theme/language preference
- Draft UI state that is not server-owned

Use SecureStore for:

- Access token
- Refresh token if added later
- Biometric unlock flag

Do not store sensitive Meta access tokens in mobile local storage.

## Offline Strategy

Mobile should work gently with weak network, but do not promise full offline
mode in MVP.

MVP offline behavior:

- Cache last successful lists.
- Show stale data banner.
- Retry failed reads.
- Block destructive writes while offline.
- Allow draft reply/product/rule text to remain locally until network returns.

Post-MVP:

- Persist query cache.
- Persist selected offline mutations.
- Background sync for safe actions like notes/product drafts.

## Push Notification Architecture

Mobile client:

1. Ask permission after the user reaches the dashboard.
2. Get Expo push token.
3. Register token with backend.
4. Listen for foreground notifications.
5. Navigate from notification payload to the right screen.

Backend:

1. Store device tokens by user and business.
2. Send push from event points in handlers/services.
3. Include route payload:

```json
{
  "type": "new_order",
  "business_id": 12,
  "order_id": 99,
  "route": "/orders/99"
}
```

Do not send customer-sensitive message bodies in push unless the user enables
preview text.

## Security Notes

- Use SecureStore for tokens.
- Add refresh tokens before serious native rollout; current long-lived browser
  token flow is not ideal for mobile.
- Device registration must be scoped by authenticated user and business.
- Add logout that revokes device token and server session.
- Add app lock/biometric unlock after MVP.
- Never expose WhatsApp access token values in mobile UI.
- Avoid logging full customer phone/message bodies in client diagnostics.

## Design Principles

The mobile app should feel quieter and faster than the web dashboard:

- Big tap targets.
- Bottom sheets for actions.
- No dense tables.
- No desktop Kanban as the default order experience.
- Short cards with one clear next action.
- Minimal charts; use summaries and deltas instead.
- Camera-first upload flows.
- Strong empty states that say what to do next.

## Build Milestones

### Milestone 0 - Prep

- Fix billing proof plan mismatch in backend.
- Normalize API base URL usage in web code so mobile can copy patterns cleanly.
- Add device token model and endpoints.
- Add mobile bootstrap endpoint.
- Decide Android-first release target.

### Milestone 1 - App Shell

- Create Expo app in `mobile/`.
- Add Expo Router.
- Add theme, icons, splash screen.
- Add auth API client.
- Add SecureStore token handling.
- Add login/register/verify screens.

### Milestone 2 - Home Action Queue

- Build bootstrap query.
- Build Home tab.
- Show bot/account status.
- Show action counts and quick actions.
- Add pull-to-refresh.

### Milestone 3 - Orders

- Orders tab.
- Status filters.
- Order detail.
- Status update actions.
- Proof review flow.
- Push deep link target for new orders.

### Milestone 4 - Inbox

- Inbox tab.
- Chat detail.
- Manual reply.
- Customer notes/tags.
- Bot pause toggle.
- Push deep link target for unread chats.

### Milestone 5 - Products

- Product list.
- Add/edit product.
- Camera/gallery upload.
- Stock and active toggles.

### Milestone 6 - Billing And Settings

- Usage meters.
- Payment proof upload.
- Activation code redeem.
- Business profile.
- Payment settings.
- Language settings.
- Notification preferences.

### Milestone 7 - Polish

- Android internal test build.
- Crash/error reporting.
- Analytics for core actions.
- Performance pass.
- App store assets.
- iOS build after Android flow proves useful.

## Suggested First Build Slice

Build the smallest mobile app that creates real daily value:

1. Login.
2. Home action queue.
3. Orders list and status updates.
4. Push notification for new order.

That slice validates whether merchants will open the native app every day.

Then add Inbox, because the second strongest reason to install a mobile app is
replying to customer messages quickly.

## Grill-Me Decisions

Decision 1: Is v1 merchant-only, or merchant plus super-admin?

Recommended answer: Merchant-only. Super-admin can stay web-only until the
merchant app has proven daily usage.

Decision 2: Android-first or Android and iOS together?

Recommended answer: Android-first. Your likely early merchants are more likely
to use Android, and Play Store/testing friction is lower.

Decision 3: Native app or Capacitor wrapper?

Recommended answer: Native Expo app. Capacitor is faster, but your mobile UX
should be action-first, camera-first, and notification-first, not a wrapped
desktop dashboard.

Decision 4: Should WhatsApp connection setup be native in v1?

Recommended answer: No. Show status and guidance in mobile, but keep complex
Meta credential setup on web until you can make it truly guided.

Decision 5: Should the app support offline writes in v1?

Recommended answer: No for critical writes. Cache reads and preserve drafts,
but require network for order status, payment proof approval, and messages.

## What Not To Build First

- Super-admin mobile app.
- Full rules table with bulk editing.
- Full finance analytics suite.
- Native WhatsApp Web connector.
- Complex offline mutation queue.
- Multi-business switching.
- Full report/audit export flows.

These are useful later, but they slow down the first proof of value.

## Open Questions

Ask these one at a time as development starts:

1. Should staff users have different mobile permissions than owners?
2. What is the one push notification merchants must never miss?
3. Should message preview text appear on the lock screen?
4. Should the app support Sinhala/Tamil UI in v1 or shortly after?
5. Should order status updates notify customers automatically from mobile?

Recommended default for now:

- Owner/admin only.
- New order is the must-not-miss push.
- Hide sensitive message previews by default.
- Keep English UI first but keep the i18n architecture ready.
- Yes, order status updates should reuse existing backend WhatsApp notification
  behavior where it already exists.

