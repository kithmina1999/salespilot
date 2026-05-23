"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ShoppingBag,
  TrendingUp,
  Package,
  Clock,
  XCircle,
  Eye,
  Loader2,
} from "lucide-react";
import { useLocale } from "@/lib/locale";
import {
  DashboardEmptyInsight,
  SegmentedControl,
  ToolbarSearch,
} from "@/components/dashboard";

import { Order } from "./_components/types";
import { API, COLUMNS, fmtMoney, headers } from "./_components/constants";
import { KanbanColumn } from "./_components/KanbanColumn";
import { ConfirmDialog } from "./_components/ConfirmDialog";
import { OrderModal } from "./_components/OrderModal";

type DateRange = "today" | "week" | "month" | "all";

function buildDateParams(range: DateRange): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = fmtDate(new Date());

  if (range === "today") return `?from=${today}&to=${today}`;
  if (range === "week") {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return `?from=${fmtDate(from)}&to=${today}`;
  }
  if (range === "month") {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return `?from=${fmtDate(from)}&to=${today}`;
  }
  return ""; // all time — no filter
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("week");
  const { t } = useLocale();

  // Count orders needing proof review (derived, no extra fetch)
  const pendingReviewCount = orders.filter(
    (o) =>
      o.payment_method === "bank_transfer" &&
      o.payment_status === "awaiting_verification",
  ).length;

  // Translated column labels (inside component so they re-render on locale change)
  const COL_LABELS: Record<string, string> = {
    new: t("orders.pending"),
    confirmed: t("orders.confirmed"),
    shipped: t("orders.shipped"),
    delivered: t("orders.delivered"),
    cancelled: t("orders.cancelled"),
  };

  const DATE_RANGES_T = [
    { key: "today" as DateRange, label: t("dashboard.today") },
    { key: "week" as DateRange, label: t("orders.this_week") },
    { key: "month" as DateRange, label: t("dashboard.this_month") },
    { key: "all" as DateRange, label: t("orders.all_time") },
  ];

  // After proof approve/reject: refresh orders list so card badges update
  const handleProofAction = useCallback(() => {
    fetchOrders();
  }, []);

  // Drag state
  const dragging = useRef<Order | null>(null);

  // Confirm dialog
  const [confirm, setConfirm] = useState<{
    order: Order;
    target: string;
  } | null>(null);
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
    } catch {
      /* silent */
    }
    setLoading(false);
  }, [dateRange]);

  // Re-fetch when date range changes
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Derived stats (from current window) ──────────────────────────────────────
  const totalOrders = orders.length;
  const activeOrders = orders.filter((o) =>
    ["new", "confirmed", "shipped"].includes(o.status),
  ).length;
  const revenue = orders
    .filter((o) => o.status === "delivered")
    .reduce((s, o) => s + o.total_price, 0);
  const cancelled = orders.filter((o) => o.status === "cancelled").length;

  // ── Client-side search (within fetched window) ───────────────────────────────
  const q = search.toLowerCase();
  const filtered = orders.filter(
    (o) =>
      !q ||
      (o.customer_name || "").toLowerCase().includes(q) ||
      o.customer_phone.includes(q) ||
      (o.order_num?.toString() || o.id.toString()).includes(q),
  );
  const grouped: Record<string, Order[]> = {};
  COLUMNS.forEach((c) => {
    grouped[c.key] = filtered.filter((o) => o.status === c.key);
  });

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
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          status: confirm.target,
          tracking_number: tracking,
          cancel_reason: cancelReason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders((prev) =>
          prev.map((o) => (o.id === confirm.order.id ? data.order : o)),
        );
      }
    } catch {
      /* silent */
    }
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
            {t("orders.title")}
            {pendingReviewCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse">
                <Eye size={11} /> {pendingReviewCount} Awaiting Review
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("orders.drag_hint")}
          </p>
        </div>
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-secondary border border-border text-muted-foreground hover:bg-border transition-colors disabled:opacity-60 shrink-0"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Package size={13} />
          )}
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: t("orders.total"),
            value: totalOrders,
            icon: Package,
          },
          {
            label: t("common.active"),
            value: activeOrders,
            icon: Clock,
          },
          {
            label: t("dashboard.revenue"),
            value: fmtMoney(revenue),
            icon: TrendingUp,
          },
          {
            label: t("orders.cancelled"),
            value: cancelled,
            icon: XCircle,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-200 "
          >
            <div className="w-9 h-9 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0">
              <Icon size={16} className="dark:text-emerald-200" />
            </div>
            <div>
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                {label}
              </p>
              <p className="text-lg font-black dark:text-emerald-200">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar: date range + search */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <SegmentedControl
          label="Show orders"
          options={DATE_RANGES_T.map(({ key, label }) => ({
            value: key,
            label,
          }))}
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
          <span className="text-sm font-medium">{t("common.loading")}…</span>
        </div>
      ) : totalOrders === 0 ? (
        <DashboardEmptyInsight
          className="py-16"
          icon={<ShoppingBag size={40} className="text-emerald-400" />}
          title={t("orders.no_orders")}
          description="Orders appear here when customers buy through your WhatsApp bot. Connect WhatsApp and add products to start receiving real orders."
          primaryHref="/dashboard/connect"
          primaryLabel="Connect WhatsApp"
          secondaryHref="/dashboard/products"
          secondaryLabel="Add Products"
        />
      ) : (
        <div className="overflow-x-auto pb-4">
          <div
            className="flex gap-4 w-fit mx-auto"
            style={{ minHeight: "62vh" }}
          >
            {COLUMNS.map((col) => (
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
          onProofAction={() => {
            handleProofAction();
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}
