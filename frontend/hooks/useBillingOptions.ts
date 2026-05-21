import useSWR from 'swr';
import { apiFetch } from '@/lib/api';

export interface BankDetails {
  configured: boolean;
  bank_name: string;
  branch: string;
  account_no: string;
  account_name: string;
  support_phone: string;
}

export interface BillingAddon {
  id: number;
  key: string;
  name: string;
  description: string;
  amount: number;
  billing_type: 'one_time' | 'monthly';
  purchase_policy: 'once_per_business' | 'once_per_connection' | 'repeatable';
  is_active: boolean;
  sort_order: number;
}

export interface BillingOptions {
  bank_details: BankDetails;
  pricing?: {
    starter?: { monthly: number; annual: number };
    pro?: { monthly: number; annual: number };
  };
  addons?: BillingAddon[];
  purchased_addons?: string[];
  business_connection_status?: {
    wa_status: string;
    connected_at?: string;
  };
}

export function useBillingOptions() {
  const { data, error, isLoading, mutate } = useSWR<BillingOptions>(
    '/api/v1/billing/options',
    (path: string) => apiFetch<BillingOptions>(path),
    { revalidateOnFocus: false }
  );

  return {
    billingOptions: data,
    isLoading,
    isError: error,
    refreshOptions: mutate,
  };
}
