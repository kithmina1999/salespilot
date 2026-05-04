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
  ID: number;
  status: string;
  total_price: number;
  items: string;
  CreatedAt: string;
}

export type MobileView = 'inbox' | 'chat' | 'crm';
