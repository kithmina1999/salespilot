export type UserRole = "admin" | "owner" | "staff" | string;

export type User = {
  id: number;
  email: string;
  role: UserRole;
  business_id: number;
};

export type Business = {
  id: number;
  name: string;
  plan: "free" | "starter" | "pro" | string;
  wa_status: "connected" | "disconnected" | "not_connected" | string;
  onboarding_complete: boolean;
};

export type LoginResponse = {
  token: string;
  user: User;
  business: Business;
};

export type RegisterResponse = {
  message: string;
  requires_verification: boolean;
  email: string;
};

export type DashboardStats = {
  total_customers: number;
  total_products: number;
  total_rules: number;
  no_sinhala_coverage: number;
  system_quota_used: number;
  ai_quota_used: number;
  plan: string;
  active_trial: boolean;
  revenue_this_month: number;
  avg_order_value: number;
  orders_today: number;
  orders_yesterday: number;
  orders_this_month: number;
  pending_orders: number;
  ai_resolution_rate: number;
  bot_automation_pct: number;
  top_unmatched?: Array<{ message: string; count: number }>;
};

export type OrderStatus =
  | "new"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "proof_received" | "rejected" | string;

export type Order = {
  id: number;
  order_num: number;
  business_id: number;
  customer_phone: string;
  customer_name: string;
  items: string;
  total_price: number;
  status: OrderStatus;
  address: string;
  notes: string;
  payment_method: string;
  payment_status: PaymentStatus;
  tracking_number: string;
  est_delivery_date: string | null;
  cancel_reason: string;
  late_alert_sent: boolean;
  created_at: string;
  updated_at: string;
};

export type OrdersResponse = {
  orders: Order[];
  count: number;
};

export type ActionCounts = {
  new_orders: number;
  unread_chats: number;
  proof_reviews: number;
  late_deliveries: number;
  missing_knowledge: number;
};

export type MobileBootstrap = {
  user?: User;
  business?: Business;
  stats?: DashboardStats;
  action_counts: ActionCounts;
  latest_pending_order?: Order | null;
  latest_unread_thread?: {
    phone: string;
    customer_name?: string;
    unread_count: number;
  } | null;
  feature_flags?: Record<string, boolean>;
};
