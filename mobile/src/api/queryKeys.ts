export const queryKeys = {
  bootstrap: ["mobile", "bootstrap"] as const,
  dashboardStats: ["dashboard", "stats"] as const,
  orders: (status?: string) => ["orders", status ?? "all"] as const,
  order: (id: number) => ["orders", id] as const
};
