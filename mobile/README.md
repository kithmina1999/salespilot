# SalesPilot Mobile

Native Expo merchant app for SalesPilot.

## V1 Scope

- Merchant owner/admin only.
- Android-first release.
- Native Expo app, not a web wrapper.
- WhatsApp setup remains web-first; mobile shows status and guidance.
- No offline writes in v1. Reads can cache and refresh, destructive actions require network.

## Local Setup

```sh
cd mobile
npm install
npm run install:fix
npm run android
```

For Android emulator development, the default API URL is:

```sh
EXPO_PUBLIC_API_URL=http://10.0.2.2:8080
```

Use a LAN IP instead when testing on a physical Android device.

## First Slice

- SecureStore-backed login/register/verify email.
- Home action queue with dashboard fallback while `/api/v1/mobile/bootstrap`
  is not implemented.
- Orders tab with status filters.
- Order detail and confirmed status transitions through
  `PATCH /api/v1/orders/:id/status`.
- Push token registration hook that calls `/api/v1/devices/register` once the
  backend endpoint exists.
