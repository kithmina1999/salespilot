import { CheckCircle2, XCircle, BanknoteIcon, Eye } from 'lucide-react';
import { CartItem } from './types';
import { API_URL } from '@/hooks/_shared';

export const COLUMNS = [
  { key: 'new',       label: 'New',       emoji: '🆕', color: 'amber'  },
  { key: 'confirmed', label: 'Confirmed', emoji: '✅', color: 'blue'   },
  { key: 'shipped',   label: 'Shipped',   emoji: '🚚', color: 'violet' },
  { key: 'delivered', label: 'Delivered', emoji: '📦', color: 'green'  },
  { key: 'cancelled', label: 'Cancelled', emoji: '❌', color: 'red'    },
] as const;

export const COL_STYLE: Record<string, { header: string; card: string; badge: string; drop: string }> = {
  new:       { header: 'border-amber-500/40  bg-amber-500/5',   card: 'hover:border-amber-500/30',  badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   drop: 'border-amber-400/60 bg-amber-500/10' },
  confirmed: { header: 'border-blue-500/40   bg-blue-500/5',    card: 'hover:border-blue-500/30',   badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',      drop: 'border-blue-400/60 bg-blue-500/10' },
  shipped:   { header: 'border-violet-500/40 bg-violet-500/5',  card: 'hover:border-violet-500/30', badge: 'bg-violet-500/15 text-violet-400 border-violet-500/30', drop: 'border-violet-400/60 bg-violet-500/10' },
  delivered: { header: 'border-emerald-500/40 bg-emerald-500/5',card: 'hover:border-emerald-500/30',badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',drop: 'border-emerald-400/60 bg-emerald-500/10' },
  cancelled: { header: 'border-red-500/40    bg-red-500/5',     card: 'hover:border-red-500/30',    badge: 'bg-red-500/15 text-red-400 border-red-500/30',          drop: 'border-red-400/60 bg-red-500/10' },
};

export const API = `${API_URL}/api/v1`;
export const headers = () => ({ 'Content-Type': 'application/json' });

export const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());
export const apiAssetURL = (url: string) => (url.startsWith('/') ? `${API_URL}${url}` : url);

export function paymentBadgeConfig(method: string, status: string) {
  if (method !== 'bank_transfer') return null; // COD has no badge
  if (status === 'awaiting_verification') return { label: 'Review', icon: Eye, cls: 'bg-orange-500/20 text-orange-400 border-orange-500/40 animate-pulse' };
  if (status === 'approved')              return { label: 'Paid',   icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (status === 'rejected')              return { label: 'Rejected', icon: XCircle,   cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
  return { label: 'Transfer', icon: BanknoteIcon, cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
}

export const fmt = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export const parseItems = (json: string): CartItem[] => { try { return JSON.parse(json) || []; } catch { return []; } };
export const fmtMoney = (n: number) => `Rs.${Number(n).toLocaleString()}`;
