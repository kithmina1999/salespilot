import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { DashboardStats, MobileBootstrap, OrdersResponse } from "@/api/types";
import { useAuthStore } from "@/store/authStore";

function countsFromStats(stats?: DashboardStats): MobileBootstrap["action_counts"] {
  return {
    new_orders: stats?.pending_orders ?? 0,
    unread_chats: 0,
    proof_reviews: 0,
    late_deliveries: 0,
    missing_knowledge: stats?.top_unmatched?.length ?? 0
  };
}

async function fallbackBootstrap(): Promise<MobileBootstrap> {
  const [stats, pendingOrders] = await Promise.all([
    apiFetch<DashboardStats>("/api/v1/dashboard/stats"),
    apiFetch<OrdersResponse>("/api/v1/orders?status=new")
  ]);

  return {
    user: useAuthStore.getState().user ?? undefined,
    business: useAuthStore.getState().business ?? undefined,
    stats,
    action_counts: countsFromStats(stats),
    latest_pending_order: pendingOrders.orders[0] ?? null,
    latest_unread_thread: null,
    feature_flags: {
      mobile_bootstrap_endpoint: false
    }
  };
}

async function getBootstrap(): Promise<MobileBootstrap> {
  try {
    const data = await apiFetch<MobileBootstrap>("/api/v1/mobile/bootstrap");
    return {
      ...data,
      action_counts: data.action_counts ?? countsFromStats(data.stats)
    };
  } catch (error) {
    return fallbackBootstrap();
  }
}

export function useHome() {
  return useQuery({
    queryKey: queryKeys.bootstrap,
    queryFn: getBootstrap
  });
}
