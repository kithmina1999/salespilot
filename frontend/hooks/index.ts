/**
 * hooks/index.ts — barrel export for all SWR dashboard hooks.
 * Import from '@/hooks' instead of individual files for cleaner imports.
 *
 * Usage:
 *   import { useProducts } from '@/hooks';
 *   import { useRulesPage } from '@/hooks';
 *   import { useOrders }    from '@/hooks';
 *   import { useSettings }  from '@/hooks';
 *   import { useDashboardStats } from '@/hooks';
 */

export * from './useProducts';
export * from './useRulesPage';
export * from './useOrders';
export * from './useSettings';
export * from './useDashboardStats';
