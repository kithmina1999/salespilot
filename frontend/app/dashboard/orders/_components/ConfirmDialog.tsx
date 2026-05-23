import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Order } from './types';
import { COLUMNS } from './constants';

interface ConfirmDialogProps {
  order: Order;
  targetStatus: string;
  onConfirm: (tracking: string, cancelReason: string) => void;
  onCancel: () => void;
  loading: boolean;
}

export function ConfirmDialog({ order, targetStatus, onConfirm, onCancel, loading }: ConfirmDialogProps) {
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
