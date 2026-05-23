export interface CartItem {
  product_id: number;
  name: string;
  qty: number;
  size?: string;
  color?: string;
  price: number;
  subtotal: number;
}

export interface Order {
  id: number;
  order_num: number;
  business_order_num: number;
  business_id: number;
  customer_phone: string;
  customer_name: string;
  items: string;
  total_price: number;
  status: string;
  address: string;
  notes: string;
  payment_method: string;
  payment_status: string;
  tracking_number: string;
  cancel_reason: string;
  late_alert_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderPaymentProof {
  id: number;
  order_id: number;
  customer_phone: string;
  amount: number;
  description: string;
  screenshot_url: string;
  status: 'pending' | 'approved' | 'rejected';
  merchant_note: string;
  reviewed_at: string | null;
  created_at: string;
}
