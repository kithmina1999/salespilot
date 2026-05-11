'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import {
  ShoppingBag, TrendingUp, Package, Clock,
  XCircle, Truck, MapPin, StickyNote, Phone, User, Hash,
  CreditCard, AlertTriangle, ChevronRight, X, Loader2,
  CheckCircle2, BanknoteIcon, Eye, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { useLocale } from '@/lib/locale';
import { DashboardEmptyInsight, SegmentedControl, ToolbarSearch } from '@/components/dashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  product_id: number;
  name: string;
  qty: number;
  size?: string;
  color?: string;
  price: number;
  subtotal: number;
}

interface Order {
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

interface OrderPaymentProof {
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

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'new',       label: 'New',       emoji: '🆕', color: 'amber'  },
  { key: 'confirmed', label: 'Confirmed', emoji: '✅', color: 'blue'   },
  { key: 'shipped',   label: 'Shipped',   emoji: '🚚', color: 'violet' },
  { key: 'delivered', label: 'Delivered', emoji: '📦', color: 'green'  },
  { key: 'cancelled', label: 'Cancelled', emoji: '❌', color: 'red'    },
] as const;

const COL_STYLE: Record<string, { header: string; card: string; badge: string; drop: string }> = {
  new:       { header: 'border-amber-500/40  bg-amber-500/5',   card: 'hover:border-amber-500/30',  badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   drop: 'border-amber-400/60 bg-amber-500/10' },
  confirmed: { header: 'border-blue-500/40   bg-blue-500/5',    card: 'hover:border-blue-500/30',   badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',      drop: 'border-blue-400/60 bg-blue-500/10' },
  shipped:   { header: 'border-violet-500/40 bg-violet-500/5',  card: 'hover:border-violet-500/30', badge: 'bg-violet-500/15 text-violet-400 border-violet-500/30', drop: 'border-violet-400/60 bg-violet-500/10' },
  delivered: { header: 'border-emerald-500/40 bg-emerald-500/5',card: 'hover:border-emerald-500/30',badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',drop: 'border-emerald-400/60 bg-emerald-500/10' },
  cancelled: { header: 'border-red-500/40    bg-red-500/5',     card: 'hover:border-red-500/30',    badge: 'bg-red-500/15 text-red-400 border-red-500/30',          drop: 'border-red-400/60 bg-red-500/10' },
};

const API = 'http://localhost:8080/api/v1';
const token = () => localStorage.getItem('token') || '';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

// SWR fetcher
const fetcher = (url: string) => fetch(url, { headers: headers() }).then(r => r.json());

// Payment status badge config
function paymentBadgeConfig(method: string, status: string) {
  if (method !== 'bank_transfer') return null; // COD has no badge
  if (status === 'awaiting_verification') return { label: 'Review', icon: Eye, cls: 'bg-orange-500/20 text-orange-400 border-orange-500/40 animate-pulse' };
  if (status === 'approved')              return { label: 'Paid',   icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (status === 'rejected')              return { label: 'Rejected', icon: XCircle,   cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
  return { label: 'Transfer', icon: BanknoteIcon, cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
}
const fmt = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const parseItems = (json: string): CartItem[] => { try { return JSON.parse(json) || []; } catch { return []; } };
const fmtMoney = (n: number) => `Rs.${Number(n).toLocaleString()}`;

// ─── Confirmation Dialog ───────────────────────────────────────────────────────

interface ConfirmDialogProps {
  order: Order;
  targetStatus: string;
  onConfirm: (tracking: string, cancelReason: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmDialog({ order, targetStatus, onConfirm, onCancel, loading }: ConfirmDialogProps) {
  const [tracking, setTracking] = useState('');
  const [reason, setReason] = useState('');

  const col = COLUMNS.find(c => c.key === targetStatus);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl border border-border bg-muted shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-lg">
            {col?.emoji}
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Move to {col?.label}?</h3>
            <p className="text-xs text-muted-foreground">Order #{order.order_num || order.id} · {order.customer_name || order.customer_phone}</p>
          </div>
        </div>

        {targetStatus === 'shipped' && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Tracking Number (optional)</label>
            <input
              value={tracking}
              onChange={e => setTracking(e.target.value)}
              placeholder="e.g. PRIOMAIL123456"
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-secondary border border-border text-foreground placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>
        )}

        {targetStatus === 'cancelled' && (
          <div className="mb-4">
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Cancel Reason (optional)</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Customer requested, out of stock..."
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-secondary border border-border text-foreground placeholder-zinc-600 outline-none focus:border-red-500/50 transition-colors"
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-4">
          A WhatsApp notification will be sent to {order.customer_phone}.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground bg-secondary border border-border hover:bg-zinc-750 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(tracking, reason)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-foreground bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Order Detail Modal ────────────────────────────────────────────────────────

// ─── Proof Review Section (SWR-powered) ──────────────────────────────────────

function ProofReviewSection({ order, onActionComplete }: { order: Order; onActionComplete: () => void }) {
  const { data, isLoading, mutate } = useSWR<{ proofs: OrderPaymentProof[] }>(
    `${API}/orders/${order.id}/proofs`,
    fetcher,
    { refreshInterval: 0, revalidateOnFocus: true }
  );
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [acting, setActing] = useState<'approve' | 'reject' | null>(null);

  const proofs = data?.proofs ?? [];
  const pendingProof = proofs.find(p => p.status === 'pending');
  const latestProof = proofs[0];

  if (isLoading) return (
    <div className="flex items-center gap-2 py-3 text-zinc-600 text-xs">
      <Loader2 size={13} className="animate-spin" /> Loading payment proof…
    </div>
  );

  if (proofs.length === 0) return (
    <div className="rounded-xl border border-dashed border-border p-4 text-center">
      <BanknoteIcon size={18} className="text-zinc-700 mx-auto mb-2" />
      <p className="text-xs text-zinc-600">No payment proof submitted yet.</p>
      <p className="text-[10px] text-zinc-700 mt-0.5">Customer will send a bank transfer screenshot via WhatsApp.</p>
    </div>
  );

  const handleApprove = async () => {
    setActing('approve');
    await fetch(`${API}/orders/proofs/${pendingProof!.id}/approve`, { method: 'POST', headers: headers() });
    await mutate();
    onActionComplete();
    setActing(null);
  };

  const handleReject = async () => {
    setActing('reject');
    await fetch(`${API}/orders/proofs/${pendingProof!.id}/reject`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ note: rejectNote }),
    });
    await mutate();
    onActionComplete();
    setActing(null);
    setShowRejectInput(false);
    setRejectNote('');
  };

  return (
    <div className="space-y-3">
      {proofs.map(proof => (
        <div key={proof.id} className={`rounded-xl border p-4 space-y-3 ${
          proof.status === 'pending'  ? 'border-orange-500/30 bg-orange-500/5' :
          proof.status === 'approved' ? 'border-emerald-500/30 bg-emerald-500/5' :
          'border-red-500/30 bg-red-500/5'
        }`}>
          {/* Status header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {proof.status === 'pending'  && <Eye size={13} className="text-orange-400" />}
              {proof.status === 'approved' && <CheckCircle2 size={13} className="text-emerald-400" />}
              {proof.status === 'rejected' && <XCircle size={13} className="text-red-400" />}
              <span className={`text-xs font-bold ${
                proof.status === 'pending' ? 'text-orange-400' :
                proof.status === 'approved' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {proof.status === 'pending' ? 'Awaiting Review' :
                 proof.status === 'approved' ? 'Payment Approved' : 'Payment Rejected'}
              </span>
            </div>
            <span className="text-[10px] text-zinc-600">
              {new Date(proof.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Gemini description */}
          {proof.description && (
            <div className="rounded-lg bg-black/20 border border-border p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">AI Analysis</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{proof.description}</p>
            </div>
          )}

          {/* Screenshot if available */}
          {proof.screenshot_url && (
            <a href={proof.screenshot_url} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
              <Eye size={12} /> View Screenshot
            </a>
          )}

          {/* Amount */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Expected Amount</span>
            <span className="font-bold text-foreground">Rs. {Number(proof.amount).toLocaleString()}</span>
          </div>

          {/* Rejection note */}
          {proof.status === 'rejected' && proof.merchant_note && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2">
              <p className="text-[10px] font-bold text-red-400 mb-0.5">Rejection Reason</p>
              <p className="text-xs text-muted-foreground">{proof.merchant_note}</p>
            </div>
          )}

          {/* Approve / Reject buttons — only for pending */}
          {proof.status === 'pending' && (
            <div className="space-y-2 pt-1">
              {!showRejectInput ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    disabled={acting !== null}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-50 transition-all"
                  >
                    {acting === 'approve' ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
                    Approve Payment
                  </button>
                  <button
                    onClick={() => setShowRejectInput(true)}
                    disabled={acting !== null}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 transition-all"
                  >
                    <ThumbsDown size={12} /> Reject
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    placeholder="Rejection reason (shown to customer)…"
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-muted border border-red-500/30 text-foreground placeholder-zinc-600 outline-none focus:border-red-500/60 resize-none transition-colors"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={acting !== null}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 disabled:opacity-50 transition-all"
                    >
                      {acting === 'reject' ? <Loader2 size={12} className="animate-spin" /> : <ThumbsDown size={12} />}
                      Confirm Reject
                    </button>
                    <button
                      onClick={() => { setShowRejectInput(false); setRejectNote(''); }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground bg-secondary border border-border hover:bg-border transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Order Detail Modal ────────────────────────────────────────────────────────

function OrderModal({ order, onClose, onProofAction }: { order: Order; onClose: () => void; onProofAction: () => void }) {
  const items = parseItems(order.items);
  const col = COLUMNS.find(c => c.key === order.status);
  const style = COL_STYLE[order.status];

  // Late delivery alert toggle state
  // alert is "enabled" when late_alert_sent = false (cron will fire)
  const [alertEnabled, setAlertEnabled] = useState(!order.late_alert_sent);
  const [alertSaving, setAlertSaving] = useState(false);

  const handleAlertToggle = async () => {
    const next = !alertEnabled;
    setAlertEnabled(next); // optimistic
    setAlertSaving(true);
    try {
      await fetch(`${API}/orders/${order.id}/late-alert`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ enabled: next }),
      });
    } catch {
      setAlertEnabled(!next); // revert on error
    }
    setAlertSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-muted shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-5 border-b border-border bg-muted rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${style.badge}`}>
              {col?.emoji} {col?.label}
            </div>
            <span className="text-sm font-bold text-foreground">Order #{order.order_num || order.id}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-secondary hover:bg-border flex items-center justify-center transition-colors">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Customer */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Customer</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User size={13} className="text-muted-foreground" />
              <span className="font-semibold">{order.customer_name || 'Anonymous'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
              <Phone size={13} className="text-muted-foreground" />
              {order.customer_phone}
            </div>
          </div>

          {/* Items */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Items Ordered</p>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    <span className="text-muted-foreground font-bold mr-1">{item.qty}×</span>
                    {item.name}
                    {item.size && <span className="text-muted-foreground ml-1">({item.size})</span>}
                  </span>
                  <span className="text-muted-foreground font-mono">{fmtMoney(item.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-border text-sm font-bold">
                <span className="text-muted-foreground">Total</span>
                <span className="text-emerald-400 font-black">{fmtMoney(order.total_price)}</span>
              </div>
            </div>
          </div>

          {/* Address */}
          {order.address && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                <MapPin size={10} /> Delivery Address
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{order.address}</p>
            </div>
          )}

          {/* Payment */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Payment Method</p>
              <p className="text-sm text-muted-foreground font-semibold flex items-center gap-1.5">
                <CreditCard size={13} className="text-muted-foreground" />
                {order.payment_method === 'bank_transfer' ? '🏦 Bank Transfer' : '💵 Cash on Delivery'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Payment Status</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                order.payment_status === 'approved'             ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                order.payment_status === 'awaiting_verification'? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
                order.payment_status === 'rejected'             ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                                                                  'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}>
                {order.payment_status === 'awaiting_verification' ? '🔍 Awaiting Review' :
                 order.payment_status === 'approved'              ? '✅ Paid' :
                 order.payment_status === 'rejected'              ? '❌ Rejected' :
                 order.payment_method === 'cod'                   ? 'COD' : 'Pending'}
              </span>
            </div>
          </div>

          {/* Bank Transfer Proof Review — only for bank_transfer orders */}
          {order.payment_method === 'bank_transfer' && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <BanknoteIcon size={10} /> Payment Proof
              </p>
              <ProofReviewSection order={order} onActionComplete={onProofAction} />
            </div>
          )}

          {/* Tracking */}
          {order.tracking_number && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-400 mb-1">
                <Truck size={10} className="inline mr-1" />Tracking Number
              </p>
              <p className="text-sm font-mono text-foreground">{order.tracking_number}</p>
            </div>
          )}

          {/* ── Late Delivery Alert Toggle (shipped orders only) ─────────────── */}
          {order.status === 'shipped' && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
                    <Truck size={10} className="text-zinc-600" />
                    Late Delivery Alert
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {alertEnabled
                      ? 'Cron will alert you if this order isn\'t delivered within 5 days of shipping.'
                      : 'Alerts suppressed — you won\'t be notified if this order is late.'}
                  </p>
                </div>
                {/* Pill toggle */}
                <button
                  onClick={handleAlertToggle}
                  disabled={alertSaving}
                  className="relative shrink-0 ml-4"
                  aria-label="Toggle late delivery alert"
                >
                  {alertSaving
                    ? <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    : (
                      <div className={`w-11 h-6 rounded-full border-2 transition-all duration-200 ${
                        alertEnabled
                          ? 'bg-violet-500/30 border-violet-500/60'
                          : 'bg-secondary border-border'
                      }`}>
                        <div className={`w-4 h-4 rounded-full mt-0.5 transition-all duration-200 ${
                          alertEnabled
                            ? 'bg-violet-400 translate-x-5 ml-0.5'
                            : 'bg-zinc-500 translate-x-0.5'
                        }`} />
                      </div>
                    )
                  }
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                <StickyNote size={10} className="inline mr-1" />Notes
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{order.notes}</p>
            </div>
          )}

          {/* Cancel reason */}
          {order.cancel_reason && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-1">
                <AlertTriangle size={10} className="inline mr-1" />Cancellation Reason
              </p>
              <p className="text-sm text-muted-foreground">{order.cancel_reason}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-3 text-[11px] text-zinc-600">
            <div>
              <span className="block text-zinc-700 font-bold mb-0.5">Created</span>
              {fmt(order.created_at)}
            </div>
            <div>
              <span className="block text-zinc-700 font-bold mb-0.5">Updated</span>
              {fmt(order.updated_at)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Order Card ────────────────────────────────────────────────────────────────

interface CardProps {
  order: Order;
  onDragStart: (e: React.DragEvent, order: Order) => void;
  onClick: (order: Order) => void;
}

function OrderCard({ order, onDragStart, onClick }: CardProps) {
  const items = parseItems(order.items);
  const style = COL_STYLE[order.status];

  // Overdue logic (shipped for >= 5 days)
  const daysLate = Math.floor((Date.now() - new Date(order.updated_at).getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = order.status === 'shipped' && daysLate >= 5;

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, order)}
      onClick={() => onClick(order)}
      className={`group rounded-2xl border cursor-grab active:cursor-grabbing transition-all hover:shadow-lg select-none ${
        isOverdue ? 'border-red-500/50 bg-red-950/20 hover:bg-red-950/40' : 'border-border bg-muted/60 hover:bg-muted'
      } ${style.card}`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Hash size={10} className="text-zinc-600" />
            <span className="text-[10px] font-black text-muted-foreground tracking-wider">
              {order.order_num ? `#${order.order_num}` : `ID:${order.id}`}
            </span>
          </div>
          <p className="font-bold text-sm text-foreground leading-tight">
            {order.customer_name || 'Anonymous'}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{order.customer_phone}</p>
        </div>
        {isOverdue ? (
          <AlertTriangle size={14} className="text-red-500 mt-1 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-zinc-700 group-hover:text-muted-foreground transition-colors mt-1 shrink-0" />
        )}
      </div>

      {/* Items summary */}
      <div className="px-4 pb-3 space-y-1">
        {items.slice(0, 2).map((item, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{item.qty}× {item.name}{item.size ? ` (${item.size})` : ''}</span>
            <span className="text-muted-foreground font-mono">{fmtMoney(item.price)}</span>
          </div>
        ))}
        {items.length > 2 && (
          <p className="text-[10px] text-zinc-600">+{items.length - 2} more items</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
        <span className="text-sm font-black text-emerald-400">{fmtMoney(order.total_price)}</span>
        <div className="flex items-center gap-2">
          {/* Payment badge — only for bank transfers */}
          {(() => {
            const badge = paymentBadgeConfig(order.payment_method, order.payment_status);
            if (!badge) return <span className="text-[10px] text-zinc-600">{fmt(order.created_at)}</span>;
            const BadgeIcon = badge.icon;
            return (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.cls}`}>
                <BadgeIcon size={9} />{badge.label}
              </span>
            );
          })()}
          <span className="text-[10px] text-zinc-600">{fmt(order.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

interface ColumnProps {
  colKey: string;
  label: string;
  emoji: string;
  orders: Order[];
  onDragStart: (e: React.DragEvent, order: Order) => void;
  onDrop: (colKey: string) => void;
  onCardClick: (order: Order) => void;
}

function KanbanColumn({ colKey, label, emoji, orders, onDragStart, onDrop, onCardClick }: ColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const style = COL_STYLE[colKey];

  const revenue = orders.filter(o => colKey === 'delivered').reduce((s, o) => s + o.total_price, 0);
  const overdueCount = orders.filter(o => {
    const days = Math.floor((Date.now() - new Date(o.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    return colKey === 'shipped' && days >= 5;
  }).length;

  return (
    <div
      className={`flex flex-col min-w-[280px] w-[280px] rounded-2xl border transition-all duration-150 ${
        isOver ? style.drop + ' scale-[1.01]' : 'border-border bg-muted'
      }`}
      onDragOver={e => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={() => { setIsOver(false); onDrop(colKey); }}
    >
      {/* Column header */}
      <div className={`flex items-center justify-between p-4 rounded-t-2xl border-b ${style.header}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <span className="font-black text-sm text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {colKey === 'shipped' && overdueCount > 0 && (
            <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 flex items-center gap-1">
              <AlertTriangle size={10} /> {overdueCount} Overdue
            </span>
          )}
          {colKey === 'delivered' && revenue > 0 && (
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              {fmtMoney(revenue)}
            </span>
          )}
          <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${style.badge}`}>
            {orders.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3 p-3 overflow-y-auto max-h-[calc(100vh-280px)] flex-1">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-2xl mb-2 opacity-30">{emoji}</div>
            <p className="text-xs text-muted-foreground font-medium">No {label.toLowerCase()} orders</p>
            {isOver && <p className="text-xs text-muted-foreground mt-1">Drop to move here</p>}
          </div>
        ) : (
          orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onDragStart={onDragStart}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

// ─── Date range helper ────────────────────────────────────────────────────────

type DateRange = 'today' | 'week' | 'month' | 'all';

const DATE_RANGES: { key: DateRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all',   label: 'All Time' },
];

function buildDateParams(range: DateRange): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = fmtDate(new Date());

  if (range === 'today') return `?from=${today}&to=${today}`;
  if (range === 'week') {
    const from = new Date(); from.setDate(from.getDate() - 7);
    return `?from=${fmtDate(from)}&to=${today}`;
  }
  if (range === 'month') {
    const from = new Date(); from.setDate(from.getDate() - 30);
    return `?from=${fmtDate(from)}&to=${today}`;
  }
  return ''; // all time — no filter
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('week');
  const { t } = useLocale();

  // Count orders needing proof review (derived, no extra fetch)
  const pendingReviewCount = orders.filter(
    o => o.payment_method === 'bank_transfer' && o.payment_status === 'awaiting_verification'
  ).length;

  // Translated column labels (inside component so they re-render on locale change)
  const COL_LABELS: Record<string, string> = {
    new:       t('orders.pending'),
    confirmed: t('orders.confirmed'),
    shipped:   t('orders.shipped'),
    delivered: t('orders.delivered'),
    cancelled: t('orders.cancelled'),
  };

  const DATE_RANGES_T = [
    { key: 'today' as DateRange, label: t('dashboard.today') },
    { key: 'week'  as DateRange, label: t('orders.this_week') },
    { key: 'month' as DateRange, label: t('dashboard.this_month') },
    { key: 'all'   as DateRange, label: t('orders.all_time') },
  ];

  // After proof approve/reject: refresh orders list so card badges update
  const handleProofAction = useCallback(() => { fetchOrders(); }, []);

  // Drag state
  const dragging = useRef<Order | null>(null);

  // Confirm dialog
  const [confirm, setConfirm] = useState<{ order: Order; target: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Detail modal
  const [detail, setDetail] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildDateParams(dateRange);
      const res = await fetch(`${API}/orders${params}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [dateRange]);

  // Re-fetch when date range changes
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── Derived stats (from current window) ──────────────────────────────────────
  const totalOrders  = orders.length;
  const activeOrders = orders.filter(o => ['new', 'confirmed', 'shipped'].includes(o.status)).length;
  const revenue      = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.total_price, 0);
  const cancelled    = orders.filter(o => o.status === 'cancelled').length;

  // ── Client-side search (within fetched window) ───────────────────────────────
  const q = search.toLowerCase();
  const filtered = orders.filter(o =>
    !q ||
    (o.customer_name || '').toLowerCase().includes(q) ||
    o.customer_phone.includes(q) ||
    (o.order_num?.toString() || o.id.toString()).includes(q)
  );
  const grouped: Record<string, Order[]> = {};
  COLUMNS.forEach(c => { grouped[c.key] = filtered.filter(o => o.status === c.key); });

  // ── Drag handlers ────────────────────────────────────────────────────────────
  const handleDragStart = (_e: React.DragEvent, order: Order) => {
    dragging.current = order;
  };

  const handleDrop = (targetCol: string) => {
    const order = dragging.current;
    dragging.current = null;
    if (!order || order.status === targetCol) return;
    setConfirm({ order, target: targetCol });
  };

  // ── Status update ────────────────────────────────────────────────────────────
  const handleConfirm = async (tracking: string, cancelReason: string) => {
    if (!confirm) return;
    setConfirming(true);
    try {
      const res = await fetch(`${API}/orders/${confirm.order.id}/status`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({
          status: confirm.target,
          tracking_number: tracking,
          cancel_reason: cancelReason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(prev => prev.map(o => o.id === confirm.order.id ? data.order : o));
      }
    } catch { /* silent */ }
    setConfirming(false);
    setConfirm(null);
  };

  return (
    <div className="max-w-7xl mx-auto w-full space-y-5 pb-12">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
            <ShoppingBag size={24} className="text-emerald-400" />
            {t('orders.title')}
            {pendingReviewCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse">
                <Eye size={11} /> {pendingReviewCount} Awaiting Review
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('orders.drag_hint')}
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-secondary border border-border text-muted-foreground hover:bg-border transition-colors disabled:opacity-60 shrink-0"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Package size={13} />}
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('orders.total'),    value: totalOrders,       icon: Package,    color: 'text-muted-foreground',    bg: 'bg-accent'    },
          { label: t('common.active'),   value: activeOrders,      icon: Clock,      color: 'text-amber-400',   bg: 'bg-amber-500/10'   },
          { label: t('dashboard.revenue'),value: fmtMoney(revenue), icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: t('orders.cancelled'),value: cancelled,         icon: XCircle,    color: 'text-red-400',     bg: 'bg-red-500/10'     },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`flex items-center gap-3 p-4 rounded-2xl border border-border ${bg}`}>
            <div className="w-9 h-9 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0">
              <Icon size={16} className={color} />
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{label}</p>
              <p className={`text-lg font-black ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar: date range + search */}
      <div className="flex flex-wrap items-center gap-3 justify-between">

        <SegmentedControl
          label="Show orders"
          options={DATE_RANGES_T.map(({ key, label }) => ({ value: key, label }))}
          value={dateRange}
          onChange={setDateRange}
        />

        <div className="flex items-center gap-3">
          {search && (
            <span className="text-xs font-medium text-muted-foreground">
              Showing {filtered.length} of {totalOrders}
            </span>
          )}
          <ToolbarSearch
            label="Search orders"
            placeholder="Search orders by name, phone, or number"
            value={search}
            onChange={setSearch}
            className="w-72 max-w-full"
          />
        </div>
      </div>

      {/* Kanban board — horizontally scrollable, centered when space allows */}
      {loading ? (
        <div className="flex items-center justify-center py-28 text-zinc-600">
          <Loader2 size={26} className="animate-spin mr-3" />
          <span className="text-sm font-medium">{t('common.loading')}…</span>
        </div>
      ) : totalOrders === 0 ? (
        <DashboardEmptyInsight
          className="py-16"
          icon={<ShoppingBag size={40} className="text-emerald-400" />}
          title={t('orders.no_orders')}
          description="Orders appear here when customers buy through your WhatsApp bot. Connect WhatsApp and add products to start receiving real orders."
          primaryHref="/dashboard/connect"
          primaryLabel="Connect WhatsApp"
          secondaryHref="/dashboard/products"
          secondaryLabel="Add Products"
        />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 w-fit mx-auto" style={{ minHeight: '62vh' }}>
            {COLUMNS.map(col => (
              <KanbanColumn
                key={col.key}
                colKey={col.key}
                label={COL_LABELS[col.key] ?? col.label}
                emoji={col.emoji}
                orders={grouped[col.key] || []}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onCardClick={setDetail}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirm && (
        <ConfirmDialog
          order={confirm.order}
          targetStatus={confirm.target}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          loading={confirming}
        />
      )}

      {/* Order detail modal */}
      {detail && (
        <OrderModal
          order={detail}
          onClose={() => setDetail(null)}
          onProofAction={() => { handleProofAction(); setDetail(null); }}
        />
      )}
    </div>
  );
}
