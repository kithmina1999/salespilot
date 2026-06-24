import { useState } from "react";
import {
  AlertTriangle,
  BanknoteIcon,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  StickyNote,
  Truck,
  User,
  X,
  XCircle,
} from "lucide-react";
import { Order } from "./types";
import { API, COLUMNS, fmt, fmtMoney, headers, parseItems } from "./constants";
import { ProofReviewSection } from "./ProofReviewSection";

interface SingleOrderViewProps {
  order: Order;
  onClose: () => void;
  onRequestStatus: (order: Order, targetStatus: string) => void;
  onSafeStatus: (order: Order, targetStatus: string) => void;
  onProofAction: () => void;
}

function statusLabel(status: string) {
  return COLUMNS.find((column) => column.key === status)?.label ?? status;
}

function paymentStatusClass(status: string) {
  if (status === "approved") return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
  if (status === "awaiting_verification") return "bg-orange-500/15 text-orange-500 border-orange-500/30";
  if (status === "rejected") return "bg-red-500/15 text-red-500 border-red-500/30";
  return "bg-amber-500/15 text-amber-500 border-amber-500/30";
}

function statusClass(status: string) {
  if (status === "delivered") return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
  if (status === "cancelled") return "bg-red-500/15 text-red-500 border-red-500/30";
  if (status === "shipped") return "bg-violet-500/15 text-violet-500 border-violet-500/30";
  if (status === "confirmed") return "bg-blue-500/15 text-blue-500 border-blue-500/30";
  return "bg-amber-500/15 text-amber-500 border-amber-500/30";
}

export function SingleOrderView({
  order,
  onClose,
  onRequestStatus,
  onSafeStatus,
  onProofAction,
}: SingleOrderViewProps) {
  const items = parseItems(order.items);
  const [alertEnabled, setAlertEnabled] = useState(!order.late_alert_sent);
  const [alertSaving, setAlertSaving] = useState(false);

  const handleAlertToggle = async () => {
    const next = !alertEnabled;
    setAlertEnabled(next);
    setAlertSaving(true);
    try {
      await fetch(`${API}/orders/${order.id}/late-alert`, {
        method: "PATCH",
        headers: headers(),
        credentials: "include",
        body: JSON.stringify({ enabled: next }),
      });
    } catch {
      setAlertEnabled(!next);
    }
    setAlertSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <section className="relative z-10 h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-background shadow-2xl">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${statusClass(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
                <span className="text-sm font-black text-foreground">Order #{order.order_num || order.id}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Created {fmt(order.created_at)} by {order.customer_name || order.customer_phone}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close order details"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {order.status === "new" && (
              <button
                type="button"
                onClick={() => onSafeStatus(order, "confirmed")}
                className="dash-primary-action py-2"
              >
                <CheckCircle2 size={15} />
                Confirm
              </button>
            )}
            {order.status === "confirmed" && (
              <button
                type="button"
                onClick={() => onRequestStatus(order, "shipped")}
                className="dash-secondary-action py-2"
              >
                <Truck size={15} />
                Ship
              </button>
            )}
            {order.status === "shipped" && (
              <button
                type="button"
                onClick={() => onSafeStatus(order, "delivered")}
                className="dash-primary-action py-2"
              >
                <PackageCheck size={15} />
                Mark delivered
              </button>
            )}
            {!["cancelled", "delivered"].includes(order.status) && (
              <button
                type="button"
                onClick={() => onRequestStatus(order, "cancelled")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-500 transition-colors hover:bg-red-500/15"
              >
                <XCircle size={15} />
                Cancel
              </button>
            )}
          </div>
        </header>

        <div className="space-y-4 p-5">
          <section className="rounded-xl border border-border bg-card p-4">
            <p className="dash-label mb-3">Customer</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-foreground">
                <User size={14} className="text-muted-foreground" />
                <span className="font-semibold">{order.customer_name || "Anonymous"}</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-muted-foreground">
                <Phone size={14} />
                {order.customer_phone}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <p className="dash-label mb-3">Items Ordered</p>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={`${item.product_id}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 text-muted-foreground">
                    <span className="font-bold text-foreground">{item.qty}x </span>
                    {item.name}
                    {item.size ? <span className="ml-1">({item.size})</span> : null}
                    {item.color ? <span className="ml-1">- {item.color}</span> : null}
                  </span>
                  <span className="shrink-0 font-mono text-muted-foreground">{fmtMoney(item.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-3 text-sm font-bold">
                <span>Total</span>
                <span className="text-emerald-500">{fmtMoney(order.total_price)}</span>
              </div>
            </div>
          </section>

          {order.address && (
            <section className="rounded-xl border border-border bg-card p-4">
              <p className="dash-label mb-2 flex items-center gap-1.5">
                <MapPin size={12} />
                Delivery Address
              </p>
              <p className="text-sm leading-6 text-muted-foreground">{order.address}</p>
            </section>
          )}

          <section className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
            <div>
              <p className="dash-label mb-2">Payment Method</p>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CreditCard size={14} className="text-muted-foreground" />
                {order.payment_method === "bank_transfer" ? "Bank transfer" : "Cash on delivery"}
              </p>
            </div>
            <div>
              <p className="dash-label mb-2">Payment Status</p>
              <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${paymentStatusClass(order.payment_status)}`}>
                {order.payment_status === "awaiting_verification"
                  ? "Awaiting review"
                  : order.payment_status === "approved"
                    ? "Paid"
                    : order.payment_status === "rejected"
                      ? "Rejected"
                      : order.payment_method === "cod"
                        ? "COD"
                        : "Pending"}
              </span>
            </div>
          </section>

          {order.payment_method === "bank_transfer" && (
            <section className="rounded-xl border border-border bg-card p-4">
              <p className="dash-label mb-3 flex items-center gap-1.5">
                <BanknoteIcon size={12} />
                Payment Proof
              </p>
              <ProofReviewSection order={order} onActionComplete={onProofAction} />
            </section>
          )}

          {order.tracking_number && (
            <section className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
              <p className="dash-label mb-1 flex items-center gap-1.5 text-violet-500">
                <Truck size={12} />
                Tracking Number
              </p>
              <p className="font-mono text-sm text-foreground">{order.tracking_number}</p>
            </section>
          )}

          {order.status === "shipped" && (
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="dash-label mb-1 flex items-center gap-1.5">
                    <Truck size={12} />
                    Late Delivery Alert
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {alertEnabled
                      ? "You will be alerted if this order is not delivered within 5 days of shipping."
                      : "Late delivery alerts are suppressed for this order."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAlertToggle}
                  disabled={alertSaving}
                  className="relative shrink-0"
                  aria-label="Toggle late delivery alert"
                >
                  {alertSaving ? (
                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  ) : (
                    <span
                      className={`block h-6 w-11 rounded-full border-2 transition-all ${
                        alertEnabled ? "border-violet-500/60 bg-violet-500/25" : "border-border bg-secondary"
                      }`}
                    >
                      <span
                        className={`mt-0.5 block h-4 w-4 rounded-full transition-all ${
                          alertEnabled ? "ml-5 bg-violet-500" : "ml-0.5 bg-muted-foreground"
                        }`}
                      />
                    </span>
                  )}
                </button>
              </div>
            </section>
          )}

          {order.notes && (
            <section className="rounded-xl border border-border bg-card p-4">
              <p className="dash-label mb-2 flex items-center gap-1.5">
                <StickyNote size={12} />
                Notes
              </p>
              <p className="text-sm leading-6 text-muted-foreground">{order.notes}</p>
            </section>
          )}

          {order.cancel_reason && (
            <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="dash-label mb-2 flex items-center gap-1.5 text-red-500">
                <AlertTriangle size={12} />
                Cancellation Reason
              </p>
              <p className="text-sm text-muted-foreground">{order.cancel_reason}</p>
            </section>
          )}

          <section className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div>
              <span className="block font-bold text-foreground">Created</span>
              {fmt(order.created_at)}
            </div>
            <div>
              <span className="block font-bold text-foreground">Updated</span>
              {fmt(order.updated_at)}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
