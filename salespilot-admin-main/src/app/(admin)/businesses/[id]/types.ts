export type BusinessDetail = {
  id: number;
  name: string;
  phone: string;
  plan: string;
  billing_cycle?: string;
  plan_expires_at?: string | null;
  suspended_at?: string | null;
  suspended_reason?: string | null;
  trial_expires_at?: string | null;
  created_at: string;
  bot_supported_langs?: string;
  bot_name?: string;
  bot_personality?: string;
  bot_reply_language?: string;
  allow_cod?: boolean;
  allow_transfer?: boolean;
  onboarding_complete?: boolean;
  monthly_report_enabled?: boolean;
  current_usage_month?: string;
  ai_message_count: number;
  ai_message_limit: number;
  system_message_count: number;
  system_message_limit: number;
  rule_generation_count: number;
  rule_generation_limit: number;
  simulation_count: number;
  simulation_limit: number;
  total_storage_used: number;
  wa_status?: string;
  wa_phone_number_id?: string;
  waba_id?: string;
  wa_access_token?: string;
  has_wa_access_token?: boolean;
  has_api_key?: boolean;
  meta_catalog_id?: string;
  connected_at?: string | null;
};

export type BusinessCounts = {
  products_total: number;
  products_active: number;
  rules_total: number;
  rules_active: number;
  customers: number;
  orders: number;
  total_revenue?: number;
  dashboard_users: number;
};

export type PaymentHistoryItem = {
  id: number;
  created_at: string;
  status: string;
  amount?: number;
  billing_cycle?: string;
};

export type ActivationHistoryItem = {
  id: number;
  used_at: string | null;
  code: string;
  plan: string;
  duration_days: number;
};

export type PipelineLog = {
  id: number;
  created_at: string;
  route_taken: string;
  clean_message?: string;
  ai_used?: boolean;
  action_taken?: string;
};

export type AuditLog = {
  id: number;
  created_at: string;
  risk: string;
  action: string;
  actor_type: string;
  category: string;
};
