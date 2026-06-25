import { NextRequest, NextResponse } from 'next/server';

/**
 * SalesPilot Edge Proxy (Next.js 16 "Proxy" = what was previously Middleware)
 *
 * File must be named proxy.ts at project root — confirmed correct per Next.js 16 docs.
 * Export must be named `proxy` or be a default export.
 *
 * Cookie strategy (set by Zustand store on client after API calls):
 *   token              — JWT token (presence = authenticated)
 *   onboarding_passed  — "1" means onboarding is complete
 *
 * Route logic:
 *
 *  ┌────────────────────────────────────────────────────────────────┐
 *  │  Unauthenticated (no token cookie)                             │
 *  │  → /dashboard/* → redirect /auth/login?redirect=...            │
 *  │  → /onboarding  → redirect /auth/login                         │
 *  └────────────────────────────────────────────────────────────────┘
 *
 *  ┌────────────────────────────────────────────────────────────────┐
 *  │  Authenticated, NOT onboarded (no onboarding_passed cookie)    │
 *  │  → /dashboard/* → redirect /onboarding                        │
 *  │  → /onboarding  → allow through ✓ (no redirect!)              │
 *  │  → /auth/login /auth/register → redirect /onboarding          │
 *  └────────────────────────────────────────────────────────────────┘
 *
 *  ┌────────────────────────────────────────────────────────────────┐
 *  │  Authenticated + onboarded (both cookies present)             │
 *  │  → /dashboard/* → allow through ✓                             │
 *  │  → /onboarding  → redirect /dashboard (already done)          │
 *  │  → /auth/login /auth/register → redirect /dashboard           │
 *  └────────────────────────────────────────────────────────────────┘
 *
 * Why no infinite loop this time:
 *   Old bug: /onboarding was "guarded" by a client-side useEffect that fetched
 *   the API, which hung. Now /onboarding has NO server-side redirect for
 *   unauthenticated-but-has-token users. The client-side DashboardGuard is only
 *   on /dashboard pages. /onboarding renders freely once token is present.
 */

const AUTH_ROUTES = ['/auth/login', '/auth/register'];
const LEGACY_AUTH_ROUTES: Record<string, string> = {
  '/login': '/auth/login',
  '/register': '/auth/register',
};

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('token')?.value;
  const onboardingPassed = req.cookies.get('onboarding_passed')?.value === '1';

  const legacyAuthTarget = LEGACY_AUTH_ROUTES[pathname];
  if (legacyAuthTarget) {
    const redirectUrl = new URL(legacyAuthTarget, req.url);
    redirectUrl.search = req.nextUrl.search;
    return NextResponse.redirect(redirectUrl);
  }

  // ── 1. Auth routes (login / register) ─────────────────────────────────────
  // If the user already has a token, don't let them see auth pages
  if (AUTH_ROUTES.includes(pathname)) {
    if (token) {
      if (onboardingPassed) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      } else {
        return NextResponse.redirect(new URL('/onboarding', req.url));
      }
    }
    // No token → allow through
    return NextResponse.next();
  }

  // ── 2. Dashboard routes (/dashboard and all sub-paths) ────────────────────
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      // Not authenticated → go to login, preserving redirect target
      const loginUrl = new URL('/auth/login', req.url);
      loginUrl.searchParams.set('redirect', `${pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
    if (!onboardingPassed) {
      // Authenticated but hasn't finished onboarding → send to onboarding
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
    // Authenticated + onboarded → allow through ✓
    return NextResponse.next();
  }

  // ── 3. Onboarding route ────────────────────────────────────────────────────
  if (pathname.startsWith('/onboarding')) {
    if (!token) {
      // Not authenticated at all → must log in first
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }
    if (onboardingPassed) {
      // Already completed onboarding → go to dashboard
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    // Has token but not yet onboarded → allow through ✓ (NO infinite loop!)
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/auth/login',
    '/auth/register',
    '/login',
    '/register',
  ],
};
