import { useState } from 'react';
import { X, User, Phone, MapPin, CreditCard, BanknoteIcon, Truck, Loader2, StickyNote, AlertTriangle } from 'lucide-react';
import { Order } from './types';
import { COLUMNS, COL_STYLE, fmt, fmtMoney, parseItems, API, headers } from './constants';
import { ProofReviewSection } from './ProofReviewSection';

export function OrderModal({ order, onClose, onProofAction }: { order: Order; onClose: () => void; onProofAction: () => void }) {
  const items = parseItems(order.items);
  const col = COLUMNS.find(c => c.key === order.status);
  const style = COL_STYLE[order.status] || COL_STYLE['new'];

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
        credentials: 'include',
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
