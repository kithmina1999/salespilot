import { useState } from 'react';
import useSWR from 'swr';
import { Loader2, Eye, CheckCircle2, XCircle, BanknoteIcon, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Order, OrderPaymentProof } from './types';
import { API, fetcher, headers } from './constants';

export function ProofReviewSection({ order, onActionComplete }: { order: Order; onActionComplete: () => void }) {
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
    await fetch(`${API}/order-proofs/${pendingProof!.id}/approve`, { method: 'POST', headers: headers() });
    await mutate();
    onActionComplete();
    setActing(null);
  };

  const handleReject = async () => {
    setActing('reject');
    await fetch(`${API}/order-proofs/${pendingProof!.id}/reject`, {
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
