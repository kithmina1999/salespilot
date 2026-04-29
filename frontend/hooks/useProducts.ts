/**
 * hooks/useProducts.ts
 * SWR hook for the Products page.
 *
 * Provides:
 *  - `products` list with automatic revalidation
 *  - `toggleProductActive` — optimistic active/draft toggle with auto-rollback
 *  - `deleteProduct` — optimistic delete with auto-rollback
 *  - `revalidate` — force-refresh from server
 */

import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import { API_URL, getToken, apiFetcher } from './_shared';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  active: boolean;
  description: string;
  image_url: string;
  retailer_id: string;
}

// ── Cache key ─────────────────────────────────────────────────────────────────

export const PRODUCTS_KEY = `${API_URL}/api/v1/products`;

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useProducts() {
  const { data, error, isLoading, mutate: revalidate } = useSWR<{ products: Product[] }>(
    PRODUCTS_KEY,
    apiFetcher,
    { revalidateOnFocus: false }
  );

  const products = data?.products ?? [];

  /** Optimistic active/draft toggle — flips instantly, rolls back on failure. */
  async function toggleProductActive(product: Product) {
    const newActive = !product.active;

    await mutate(
      PRODUCTS_KEY,
      (cur: { products: Product[] } | undefined) => ({
        products: (cur?.products ?? []).map(p =>
          p.id === product.id ? { ...p, active: newActive } : p
        ),
      }),
      false
    );

    try {
      const res = await fetch(`${API_URL}/api/v1/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) throw new Error('Server error');
      revalidate();
    } catch {
      toast.error('Failed to update product status — change reverted');
      revalidate();
    }
  }

  /** Optimistic delete — removes from cache immediately, revalidates on outcome. */
  async function deleteProduct(id: number) {
    if (!confirm('Delete this product?')) return;

    await mutate(
      PRODUCTS_KEY,
      (cur: { products: Product[] } | undefined) => ({
        products: (cur?.products ?? []).filter(p => p.id !== id),
      }),
      false
    );

    try {
      const res = await fetch(`${API_URL}/api/v1/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Server error');
      toast.success('Product deleted');
    } catch {
      toast.error('Failed to delete product — change reverted');
    } finally {
      revalidate();
    }
  }

  return { products, isLoading, error, toggleProductActive, deleteProduct, revalidate };
}
