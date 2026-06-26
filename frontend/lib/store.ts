/**
 * useAppStore — Global Zustand store for SalesPilot
 * 
 * Centralizes:
 *  - Auth session (user; JWT lives in a backend-set HttpOnly cookie)
 *  - Business profile (plan, WA status, onboarding state)
 *  - Usage stats (quotas, counters)
 *  - Billing details (trial, expiry, pricing)
 * 
 * This removes the need for each component to independently
 * call /api/v1/settings/business, /api/v1/settings/usage, etc.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_URL } from '@/hooks/_shared';
import { apiFetch, clearLegacyAuthStorage } from '@/lib/api';

const apiUrl = (path: string) => `${API_URL}${path}`;

if (typeof window !== 'undefined') {
  clearLegacyAuthStorage();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppUser {
  id: number;
  email: string;
  role: string;
  business_id: number;
}

export interface AppBusiness {
  id: number;
  name: string;
  plan: 'free' | 'starter' | 'pro';
  wa_status: 'connected' | 'disconnected' | 'not_connected';
  onboarding_complete: boolean;
  response_language: string;
  bot_name: string;
}

export interface PlanLimits {
  products:        number; // -1 = unlimited
  rules:           number;
  ai_messages:     number;
  system_messages: number;
  rule_gens:       number;
  storage_bytes:   number;
}

export interface AppUsage {
  // Plan info
  active_trial: boolean;
  trial_expires_at: string | null;
  plan_expires_at: string | null;

  // Counters
  ai_messages_used: number;
  ai_messages_limit: number;
  system_messages_used: number;
  system_messages_limit: number;
  faq_replies_used: number;
  rule_generation_count: number;
  rule_generation_limit: number;
  products_used: number;
  products_limit: number;
  rules_used: number;
  rules_limit: number;
  storage_used_bytes: number;
  storage_limit_bytes: number;

  // Feature flags
  features: {
    cloudinary: boolean;
    whatsapp_images: boolean;
    gemini_vision: boolean;
  };

  // Full plan comparison data — driven from backend constants, never hardcode in frontend
  plan_limits?: {
    free:    PlanLimits;
    starter: PlanLimits;
    pro:     PlanLimits;
    trial?:  PlanLimits;
  };
}

export interface AppPricing {
  starter?: { monthly: number; annual: number };
  pro?: { monthly: number; annual: number };
  status: 'free' | 'trial_active' | 'trial_expired_to_free' | 'paid_active' | 'expired_to_free' | 'paid_grace';
  active_trial: boolean;
  expires_at: string | null;
  seconds_remaining: number;
  hours_remaining: number;
  minutes_remaining: number;
  promo_active: boolean;
  promo_ends_at: string;
  trial_days_remaining: number | null;
  days_remaining: number | null;
  grace_period: boolean;
  grace_ends_at: string | null;
}

export interface PlatformNotice {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical';
  expires_at: string | null;
}

interface AppState {
  // Auth
  user: AppUser | null;

  // Data
  business: AppBusiness | null;
  usage: AppUsage | null;
  pricing: AppPricing | null;
  platformNotice: PlatformNotice | null;

  // Appearance
  appearance: { fontScale: 'sm' | 'md' | 'lg' | 'xl' };

  // Load state
  businessLoaded: boolean;
  usageLoaded: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────
  
  /** Call after successful login, verify-email, or session hydration */
  setSession: (user: AppUser, business: AppBusiness) => void;

  /** Call on logout or 401 */
  clearSession: () => void;

  /** Hydrate user/business from the backend-set HttpOnly cookie */
  hydrateSession: () => Promise<boolean>;

  /** Fetch business profile + WA status from backend */
  fetchBusiness: () => Promise<void>;

  /** Fetch full usage stats + billing + pricing from backend */
  fetchUsage: () => Promise<void>;

  /** Fetch both in parallel — call this on dashboard mount */
  fetchAll: () => Promise<void>;

  /** Update onboarding complete flag after finishing wizard */
  markOnboardingComplete: () => void;

  setFontScale: (scale: 'sm' | 'md' | 'lg' | 'xl') => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      business: null,
      usage: null,
      pricing: null,
      platformNotice: null,
      appearance: { fontScale: 'md' },
      businessLoaded: false,
      usageLoaded: false,

      setSession: (user, business) => {
        clearLegacyAuthStorage();
        if (business.onboarding_complete) {
          document.cookie = `onboarding_passed=1; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`;
        }
        set({ user, business, businessLoaded: true });
      },

      clearSession: () => {
        clearLegacyAuthStorage();
        document.cookie = 'onboarding_passed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
        set({
          user: null, business: null,
          usage: null, pricing: null,
          businessLoaded: false, usageLoaded: false,
        });
      },

      hydrateSession: async () => {
        try {
          const data = await apiFetch<{ user: AppUser; business: AppBusiness }>('/api/v1/auth/session');
          get().setSession(data.user, data.business);
          return true;
        } catch {
          get().clearSession();
          return false;
        }
      },

      fetchBusiness: async () => {
        try {
          const res = await fetch(apiUrl('/api/v1/settings/business'), {
            credentials: 'include',
          });
          if (res.status === 401) { get().clearSession(); return; }
          if (!res.ok) return;
          const data = await res.json();
          set({
            business: {
              id: data.id,
              name: data.name,
              plan: data.plan,
              wa_status: data.wa_status ?? 'not_connected',
              onboarding_complete: data.onboarding_complete,
              response_language: data.response_language,
              bot_name: data.bot_name,
            },
            businessLoaded: true,
          });
          // Sync onboarding cookie
          if (data.onboarding_complete) {
            document.cookie = `onboarding_passed=1; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`;
          }
        } catch {
          // Network error — keep existing data, don't crash
        }
      },

      fetchUsage: async () => {
        try {
          // Fetch usage + billing in parallel
          const [usageRes, billingRes] = await Promise.all([
            fetch(apiUrl('/api/v1/settings/usage'), {
              credentials: 'include',
            }),
            fetch(apiUrl('/api/v1/billing/status'), {
              credentials: 'include',
            }),
          ]);

          if (usageRes.ok) {
            const u = await usageRes.json();
            set({
              usage: {
                active_trial: u.active_trial,
                trial_expires_at: u.trial_expires_at,
                plan_expires_at: u.plan_expires_at,
                ai_messages_used: u.ai_messages_used,
                ai_messages_limit: u.ai_messages_limit,
                system_messages_used: u.system_messages_used,
                system_messages_limit: u.system_messages_limit,
                faq_replies_used: u.faq_replies_used,
                rule_generation_count: u.rule_generation_count,
                rule_generation_limit: u.rule_generation_limit,
                products_used: u.products_used,
                products_limit: u.products_limit,
                rules_used: u.rules_used,
                rules_limit: u.rules_limit,
                storage_used_bytes: u.storage_used_bytes,
                storage_limit_bytes: u.storage_limit_bytes,
                features: u.features ?? {
                  cloudinary: false,
                  whatsapp_images: false,
                  gemini_vision: false,
                },
                // Plan limits from backend — single source of truth
                plan_limits: u.plan_limits,
              },
              usageLoaded: true,
            });
          }

          if (billingRes.ok) {
            const b = await billingRes.json();
            set({
              pricing: {
                starter: b.pricing?.starter,
                pro: b.pricing?.pro,
                status: b.status ?? 'free',
                active_trial: b.active_trial ?? false,
                expires_at: b.expires_at ?? null,
                seconds_remaining: b.seconds_remaining ?? 0,
                hours_remaining: b.hours_remaining ?? 0,
                minutes_remaining: b.minutes_remaining ?? 0,
                promo_active: b.promo_active ?? false,
                promo_ends_at: b.promo_ends_at ?? '',
                trial_days_remaining: b.trial_days_remaining ?? null,
                days_remaining: b.days_remaining ?? null,
                grace_period: b.grace_period ?? false,
                grace_ends_at: b.grace_ends_at ?? null,
              },
              // Also update business plan from billing (most authoritative source)
              business: get().business
                ? { ...get().business!, plan: (b.effective_plan ?? b.plan) }
                : get().business,
              platformNotice: b.platform_notice ?? null,
            });
          }
        } catch {
          // Network error — keep existing data
        }
      },

      fetchAll: async () => {
        await Promise.all([get().fetchBusiness(), get().fetchUsage()]);
      },

      markOnboardingComplete: () => {
        document.cookie = `onboarding_passed=1; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`;
        set((state) => ({
          business: state.business
            ? { ...state.business, onboarding_complete: true }
            : state.business,
        }));
      },

      setFontScale: (scale) => set({ appearance: { fontScale: scale } }),
    }),

    {
      name: 'salespilot-app',           // localStorage key
      partialize: (state) => ({         // Persist non-sensitive session shell and appearance
        user: state.user,
        business: state.business,
        appearance: state.appearance,
      }),
    }
  )
);

// ── Convenience selectors ─────────────────────────────────────────────────────

/** true if user is on an active trial */
export const selectIsOnTrial = (s: AppState) =>
  s.usage?.active_trial ?? false;

/** true if user needs to upgrade (free plan, no trial) */  
export const selectNeedsUpgrade = (s: AppState) =>
  s.business?.plan === 'free' && !(s.usage?.active_trial);

/** true if WA is not connected */
export const selectWANotConnected = (s: AppState) =>
  s.business?.wa_status !== 'connected';

/** AI usage as 0–100 percentage */
export const selectAIUsagePct = (s: AppState) => {
  const u = s.usage;
  if (!u || u.ai_messages_limit <= 0) return 0;
  return Math.min(100, Math.round((u.ai_messages_used / u.ai_messages_limit) * 100));
};
