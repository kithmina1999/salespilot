/**
 * useAppStore — Global Zustand store for SalesPilot
 * 
 * Centralizes:
 *  - Auth session (token, user)
 *  - Business profile (plan, WA status, onboarding state)
 *  - Usage stats (quotas, counters)
 *  - Billing details (trial, expiry, pricing)
 * 
 * This removes the need for each component to independently
 * call /api/v1/settings/business, /api/v1/settings/usage, etc.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  plan_limits: {
    free:    PlanLimits;
    starter: PlanLimits;
    pro:     PlanLimits;
  };
}

export interface AppPricing {
  starter: { monthly: number; annual: number };
  pro: { monthly: number; annual: number };
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
}

interface AppState {
  // Auth
  token: string | null;
  user: AppUser | null;

  // Data
  business: AppBusiness | null;
  usage: AppUsage | null;
  pricing: AppPricing | null;

  // Load state
  businessLoaded: boolean;
  usageLoaded: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────
  
  /** Call after successful login or verify-email */
  setSession: (token: string, user: AppUser, business: AppBusiness) => void;

  /** Call on logout or 401 */
  clearSession: () => void;

  /** Fetch business profile + WA status from backend */
  fetchBusiness: () => Promise<void>;

  /** Fetch full usage stats + billing + pricing from backend */
  fetchUsage: () => Promise<void>;

  /** Fetch both in parallel — call this on dashboard mount */
  fetchAll: () => Promise<void>;

  /** Update onboarding complete flag after finishing wizard */
  markOnboardingComplete: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      token: null,
      user: null,
      business: null,
      usage: null,
      pricing: null,
      businessLoaded: false,
      usageLoaded: false,

      setSession: (token, user, business) => {
        // Sync to cookie for edge middleware
        document.cookie = `token=${token}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`;
        if (business.onboarding_complete) {
          document.cookie = `onboarding_passed=1; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`;
        }
        set({ token, user, business, businessLoaded: true });
      },

      clearSession: () => {
        // Nuke cookies
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
        document.cookie = 'onboarding_passed=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
        set({
          token: null, user: null, business: null,
          usage: null, pricing: null,
          businessLoaded: false, usageLoaded: false,
        });
      },

      fetchBusiness: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const res = await fetch('/api/v1/settings/business', {
            headers: { Authorization: `Bearer ${token}` },
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
        const { token } = get();
        if (!token) return;
        try {
          // Fetch usage + billing in parallel
          const [usageRes, billingRes] = await Promise.all([
            fetch('/api/v1/settings/usage', {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch('/api/v1/billing/status', {
              headers: { Authorization: `Bearer ${token}` },
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
                plan_limits: u.plan_limits ?? {
                  free:    { products: 10,  rules: 10, ai_messages: 0,    system_messages: 300, rule_gens: 3,   storage_bytes: 0 },
                  starter: { products: 100, rules: -1, ai_messages: 1500, system_messages: -1,  rule_gens: 30,  storage_bytes: 524288000 },
                  pro:     { products: -1,  rules: -1, ai_messages: 5000, system_messages: -1,  rule_gens: 100, storage_bytes: 1073741824 },
                },
              },
              usageLoaded: true,
            });
          }

          if (billingRes.ok) {
            const b = await billingRes.json();
            set({
              pricing: {
                starter: b.pricing?.starter ?? { monthly: 1490, annual: 14900 },
                pro: b.pricing?.pro ?? { monthly: 3490, annual: 34900 },
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
              },
              // Also update business plan from billing (most authoritative source)
              business: get().business
                ? { ...get().business!, plan: (b.effective_plan ?? b.plan) }
                : get().business,
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
    }),

    {
      name: 'salespilot-app',           // localStorage key
      partialize: (state) => ({         // Only persist auth — data re-fetched on mount
        token: state.token,
        user: state.user,
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
