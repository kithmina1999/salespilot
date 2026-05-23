import useSWR from 'swr';
import { apiFetch } from '@/lib/api';

export interface PaymentStatus {
  has_proof: boolean;
  status: string;
  checkout_type?: 'subscription' | 'addon_only' | 'mixed';
  billing_cycle: string;
  plan?: string;
  amount: number;
  activation_code: string;
  admin_note: string;
  scan_reason?: string;
  scan_status?: string;
  submitted_at: string;
  reviewed_at: string | null;
}

export function useBillingStatus() {
  const { data, error, isLoading, mutate } = useSWR<PaymentStatus>(
    '/api/v1/billing/payment-status',
    (path: string) => apiFetch<PaymentStatus>(path),
    { revalidateOnFocus: false }
  );

  return {
    paymentStatus: data,
    isLoading,
    isError: error,
    refreshStatus: mutate,
  };
}
