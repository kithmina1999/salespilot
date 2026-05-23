export interface ChatSummary {
  phone: string;
  latest_message: string;
  message_time: string;
  status: string;
  customer_name: string;
  unmatched_count: number;
  unread_count: number;
}

export interface Message {
  ID: number;
  role: string;       // 'user' | 'model' | 'merchant' | 'system'
  content: string;
  is_unmatched: boolean;
  CreatedAt: string;
}

export interface Customer {
  id: number;
  phone: string;
  name: string;
  address: string;
  notes: string;
  tags: string;
  bot_paused: boolean;
  bot_paused_until: string | null;
}

export interface Order {
  id: number;
  order_num?: number;
  status: string;
  total_price: number;
  items: string;
  created_at: string;
}

export type MobileView = 'inbox' | 'chat' | 'crm';
