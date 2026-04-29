/**
 * hooks/useOrders.ts
 * SWR hook for the Orders page.
 *
 * Provides:
 *  - `orders` list with automatic revalidation
 *  - `updateOrderStatus` — optimistic status change (confirm/ship/deliver/cancel)
 *  - `updatePaymentStatus` — optimistic payment status change
 *  - `revalidate` — force-refresh from server
 */

import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import { API_URL, getToken, apiFetcher } from './_shared';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Order {
  id: number;
  order_num: number;
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
  est_delivery_date: string | null;
  cancel_reason: string;
  created_at: string;
}

// ── Cache key ─────────────────────────────────────────────────────────────────

export const ORDERS_KEY = `${API_URL}/api/v1/orders`;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOrders() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<Order[]>(
    ORDERS_KEY,
    apiFetcher,
    { revalidateOnFocus: false }
  );

  const orders = data ?? [];

  /**
   * Optimistic order status update.
   * Moves the Kanban card instantly — rolls back if the server rejects.
   */
  async function updateOrderStatus(
    orderId: number,
    newStatus: string,
    extra?: { tracking_number?: string; est_delivery_date?: string; cancel_reason?: string }
  ) {
    await mutate(
      ORDERS_KEY,
      (cur: Order[] | undefined) =>
        (cur ?? []).map(o =>
          o.id === orderId ? { ...o, status: newStatus, ...extra } : o
        ),
      false
    );

    try {
      const res = await fetch(`${API_URL}/api/v1/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status: newStatus, ...extra }),
      });
      if (!res.ok) throw new Error('Server error');
      revalidate();
    } catch {
      toast.error('Failed to update order status — change reverted');
      revalidate();
    }
  }

  /** Optimistic payment status update (pending → paid / proof_received / rejected). */
  async function updatePaymentStatus(orderId: number, paymentStatus: string) {
    await mutate(
      ORDERS_KEY,
      (cur: Order[] | undefined) =>
        (cur ?? []).map(o =>
          o.id === orderId ? { ...o, payment_status: paymentStatus } : o
        ),
      false
    );

    try {
      const res = await fetch(`${API_URL}/api/v1/orders/${orderId}/payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ payment_status: paymentStatus }),
      });
      if (!res.ok) throw new Error('Server error');
      revalidate();
    } catch {
      toast.error('Failed to update payment status — change reverted');
      revalidate();
    }
  }

  return { orders, isLoading, error, updateOrderStatus, updatePaymentStatus, revalidate };
}
