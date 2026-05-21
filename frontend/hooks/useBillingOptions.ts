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

export interface BillingOptions {
  bank_details: BankDetails;
  pricing?: {
    starter?: { monthly: number; annual: number };
    pro?: { monthly: number; annual: number };
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
