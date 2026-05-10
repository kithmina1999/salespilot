import { CreditCard, ArrowRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";

export function PaymentHistoryList({ payments, activationCodes, businessId }: { payments: any[], activationCodes: any[], businessId: string }) {
  // Combine and sort events
  const events = [
    ...(payments || []).map(p => ({ ...p, _type: 'payment', _date: new Date(p.created_at) })),
    ...(activationCodes || []).map(a => ({ ...a, _type: 'activation', _date: new Date(a.used_at) }))
  ].sort((a, b) => b._date.getTime() - a._date.getTime()).slice(0, 5);

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Payment History</h2>
        </div>
      </div>

      <div className="flex flex-col">
        {events.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm font-semibold">
            No payment history found.
          </div>
        ) : (
          events.map((event, i) => (
            <div key={`${event._type}-${event.id}`} className={`p-4 flex items-start gap-3 ${i < events.length - 1 ? 'border-b border-border/50' : ''}`}>
              {event._type === 'payment' ? (
                <>
                  <div className="mt-0.5">{getPaymentStatusIcon(event.status)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">Rs. {event.amount?.toLocaleString()}</span>
                      <span className="text-[0.65rem] text-muted-foreground font-mono">{event._date.toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Bank Transfer · {event.billing_cycle}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-0.5"><CheckCircle2 className="w-4 h-4 text-blue-500" /></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">Code Activation</span>
                      <span className="text-[0.65rem] text-muted-foreground font-mono">{event._date.toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono bg-secondary px-1.5 rounded text-[0.65rem]">{event.code}</span>
                      <span>· {event.plan} ({event.duration_days}d)</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border bg-secondary/30">
        <Link 
          href={`/payments?business_id=${businessId}`}
          className="flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:opacity-80 transition-opacity"
        >
          View all payments <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
