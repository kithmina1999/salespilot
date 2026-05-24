/**
 * hooks/useRulesPage.ts
 * SWR hook for the Rules page.
 *
 * Fetches three endpoints in parallel (rules + dashboard stats + business settings)
 * to match the original Promise.all pattern — but now cached and deduplicated.
 *
 * Provides:
 *  - `customRules`, `commonRules`, `stats`, `botLangs`, `botReplyLang`, `responseLang`
 *  - `toggleRuleStatus` — optimistic is_active toggle with auto-rollback
 *  - `deleteRule` — optimistic delete; returns false when upgrade_required
 *  - `revalidate` — force-refresh all three endpoints
 */

import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import { API_URL, getToken } from './_shared';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RuleEntry {
  ID: number;
  category: string;
  keywords: string;
  response: string;
  sinhala_response: string;
  responses: string;
  is_active: boolean;
  usage_count: number;
  business_id: number | null;
  knowledge_type?: string;
  source_type?: string;
  source_id?: number | null;
  system_managed?: boolean;
}

export interface RulesStats {
  system_quota_used: number;
  ai_quota_used: number;
  plan: string;
  rule_generation_count: number;
  rule_generation_limit: number;
  no_sinhala_coverage: number;
  top_unmatched: {
    id: number;
    message: string;
    normalized_message?: string;
    count: number;
    router_intent?: string;
    suggested_knowledge_type?: string;
    suggested_action?: string;
    selected_product_id?: number | null;
    ai_reply_text?: string;
    last_seen_at?: string;
  }[];
}

interface RulesPageData {
  customRules: RuleEntry[];
  commonRules: RuleEntry[];
  stats: RulesStats;
  botLangs: string[];
  botReplyLang: string;
  responseLang: string;
}

// ── Composite fetcher (three endpoints in parallel) ───────────────────────────

async function fetchRulesPageData(): Promise<RulesPageData> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') ?? '' : '';
  const headers = { Authorization: `Bearer ${token}` };

  const [rulesRes, statsRes, settingsRes] = await Promise.all([
    fetch(`${API_URL}/api/v1/rules`,             { headers }),
    fetch(`${API_URL}/api/v1/dashboard/stats`,   { headers }),
    fetch(`${API_URL}/api/v1/settings/business`, { headers }),
  ]);

  const rulesData    = rulesRes.ok    ? await rulesRes.json()    : {};
  const statsData    = statsRes.ok    ? await statsRes.json()    : {};
  const settingsData = settingsRes.ok ? await settingsRes.json() : {};

  const rawLangs = settingsData.bot_supported_langs ?? 'en,si';
  const botLangs = rawLangs.split(',').map((s: string) => s.trim()).filter(Boolean);

  return {
    customRules: rulesData.custom_rules ?? [],
    commonRules: rulesData.common_rules ?? [],
    stats: {
      system_quota_used:     statsData.system_quota_used     ?? 0,
      ai_quota_used:         statsData.ai_quota_used         ?? 0,
      plan:                  statsData.plan                  ?? 'free',
      rule_generation_count: statsData.rule_generation_count ?? 0,
      rule_generation_limit: statsData.rule_generation_limit ?? 3,
      no_sinhala_coverage:   statsData.no_sinhala_coverage   ?? 0,
      top_unmatched:         statsData.top_unmatched          ?? [],
    },
    botLangs,
    botReplyLang: settingsData.bot_reply_language ?? 'si',
    responseLang: settingsData.response_language  ?? 'sinhala_first',
  };
}

// ── Cache key ─────────────────────────────────────────────────────────────────

export const RULES_PAGE_KEY = `${API_URL}/rules-page-composite`;

const EMPTY_STATS: RulesStats = {
  system_quota_used: 0,
  ai_quota_used: 0,
  plan: 'free',
  rule_generation_count: 0,
  rule_generation_limit: 3,
  no_sinhala_coverage: 0,
  top_unmatched: [],
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRulesPage() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<RulesPageData>(
    RULES_PAGE_KEY,
    fetchRulesPageData,
    { revalidateOnFocus: false }
  );

  /** Optimistic is_active toggle. Common rules (business_id === null) are skipped. */
  async function toggleRuleStatus(rule: RuleEntry) {
    if (rule.business_id === null) return;
    if (rule.system_managed) {
      toast.error('System-managed rules cannot be modified directly');
      return;
    }
    const newStatus = !rule.is_active;

    await mutate(
      RULES_PAGE_KEY,
      (cur: RulesPageData | undefined) => cur ? {
        ...cur,
        customRules: cur.customRules.map(r =>
          r.ID === rule.ID ? { ...r, is_active: newStatus } : r
        ),
      } : cur,
      false
    );

    try {
      const res = await fetch(`${API_URL}/api/v1/rules/${rule.ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ is_active: newStatus }),
      });
      if (!res.ok) throw new Error('Server error');
      revalidate();
    } catch {
      toast.error('Failed to update rule status — change reverted');
      revalidate();
    }
  }

  /**
   * Optimistic delete. Returns false when the server responds with upgrade_required
   * so the caller can show the upgrade banner instead of a toast.
   */
  async function deleteRule(id: number): Promise<boolean> {
    const rule = data?.customRules.find(r => r.ID === id);
    if (rule?.system_managed) {
      toast.error('System-managed rules cannot be deleted');
      return false;
    }
    if (!confirm('Are you sure you want to delete this custom rule?')) return false;

    await mutate(
      RULES_PAGE_KEY,
      (cur: RulesPageData | undefined) => cur ? {
        ...cur,
        customRules: cur.customRules.filter(r => r.ID !== id),
      } : cur,
      false
    );

    const res  = await fetch(`${API_URL}/api/v1/rules/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const json = await res.json().catch(() => ({}));

    if (res.status === 403 && json.upgrade_required) {
      revalidate(); // rollback the optimistic delete
      return false;
    }

    toast.success('Rule deleted');
    revalidate();
    return true;
  }

  async function resolveGap(id: number, action: string, resolvedRuleId?: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/api/v1/knowledge-gaps/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ resolved_action: action, resolved_rule_id: resolvedRuleId }),
      });
      if (!res.ok) throw new Error('Failed to resolve gap');
      toast.success('Knowledge gap resolved');
      revalidate();
      return true;
    } catch (err) {
      toast.error('Failed to resolve knowledge gap');
      return false;
    }
  }

  async function markGapNotNeeded(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/api/v1/knowledge-gaps/${id}/mark-not-needed`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to mark gap not needed');
      toast.success('Knowledge gap marked as not needed');
      revalidate();
      return true;
    } catch (err) {
      toast.error('Failed to mark knowledge gap as not needed');
      return false;
    }
  }

  return {
    customRules:  data?.customRules  ?? [],
    commonRules:  data?.commonRules  ?? [],
    stats:        data?.stats        ?? EMPTY_STATS,
    botLangs:     data?.botLangs     ?? ['en', 'si'],
    botReplyLang: data?.botReplyLang ?? 'si',
    responseLang: data?.responseLang ?? 'sinhala_first',
    isLoading,
    error,
    toggleRuleStatus,
    deleteRule,
    resolveGap,
    markGapNotNeeded,
    revalidate,
  };
}
