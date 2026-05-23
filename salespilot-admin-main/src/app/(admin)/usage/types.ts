export type UsageBusiness = {
  id: number;
  name: string;
  plan: string;
  ai_message_count: number;
  ai_message_limit: number;
  system_message_count: number;
  system_message_limit: number;
  simulation_count: number;
  simulation_limit: number;
  rule_generation_count: number;
  rule_generation_limit: number;
  total_storage_used?: number;
};

export type UsageMetrics = {
  usage: {
    ai_messages: number;
    system_messages: number;
  };
  risk: {
    near_ai_limit_count: number;
    near_simulation_limit_count: number;
  };
};
