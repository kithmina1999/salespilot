/**
 * lib/useDashboard.ts — Legacy re-export shim.
 *
 * All hooks have been moved to the /hooks folder.
 * This file re-exports everything so existing imports still compile.
 * New code should import directly from '@/hooks/<hookName>' or '@/hooks'.
 */
export * from '@/hooks/useProducts';
export * from '@/hooks/useRulesPage';
export * from '@/hooks/useOrders';
export * from '@/hooks/useSettings';
export * from '@/hooks/useDashboardStats';
