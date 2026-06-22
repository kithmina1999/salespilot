"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BanknoteIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  Package,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useLocale } from "@/lib/locale";
import {
  DashboardEmptyInsight,
  SegmentedControl,
  ToolbarSearch,
} from "@/components/dashboard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Order } from "./_components/types";
import { API, fmtMoney, headers, parseItems, paymentBadgeConfig } from "./_components/constants";
import { ConfirmDialog } from "./_components/ConfirmDialog";
import { SingleOrderView } from "./_components/SingleOrderView";

type DateRange = "today" | "week" | "month" | "all";
type QueueFilter = "needs_attention" | "active" | "completed" | "cancelled" | "all";
type StatusFilter = "all" | "new" | "confirmed" | "shipped" | "delivered" | "cancelled";
type PaymentStatusFilter = "all" | "pending" | "awaiting_verification" | "approved" | "rejected";
type PaymentMethodFilter = "all" | "cod" | "bank_transfer";
type SortOption = "newest" | "oldest" | "updated_desc" | "updated_asc" | "total_desc" | "total_asc";

interface OrderPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

interface OrderSummary {
  needs_attention: number;
  active: number;
  completed: number;
  cancelled: number;
  all: number;
}

const DEFAULT_PAGINATION: OrderPagination = {
  page: 1,
  limit: 25,
  total: 0,
  total_pages: 0,
};

const DEFAULT_SUMMARY: OrderSummary = {
  needs_attention: 0,
  active: 0,
  completed: 0,
  cancelled: 0,
  all: 0,
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const QUEUE_LABELS: Record<QueueFilter, string> = {
  needs_attention: "Needs attention",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  all: "All",
};

function addDateParams(params: URLSearchParams, range: DateRange) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = fmtDate(new Date());

  if (range === "today") {
    params.set("from", today);
    params.set("to", today);
  }
  if (range === "week") {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    params.set("from", fmtDate(from));
    params.set("to", today);
  }
  if (range === "month") {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    params.set("from", fmtDate(from));
    params.set("to", today);
  }
}

function formatAge(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function orderItemsPreview(order: Order) {
  const items = parseItems(order.items);
  if (items.length === 0) return "No item details";
  const preview = items
    .slice(0, 2)
    .map((item) => `${item.qty}x ${item.name}`)
    .join(", ");
  return items.length > 2 ? `${preview} +${items.length - 2} more` : preview;
}

function statusClass(status: string) {
  if (status === "delivered") return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
  if (status === "cancelled") return "bg-red-500/15 text-red-500 border-red-500/30";
  if (status === "shipped") return "bg-violet-500/15 text-violet-500 border-violet-500/30";
  if (status === "confirmed") return "bg-blue-500/15 text-blue-500 border-blue-500/30";
  return "bg-amber-500/15 text-amber-500 border-amber-500/30";
}

function paymentStatusText(order: Order) {
  if (order.payment_status === "awaiting_verification") return "Awaiting review";
  if (order.payment_status === "approved") return "Paid";
  if (order.payment_status === "rejected") return "Rejected";
  if (order.payment_method === "cod") return "COD";
  return "Pending";
}

function visiblePageNumbers(current: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const start = Math.max(1, Math.min(current - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

interface ActionIconButtonProps {
  label: string;
  children: ReactNode;
  className: string;
  onClick: () => void;
}

function ActionIconButton({ label, children, className, onClick }: ActionIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={className}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent align="end">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("week");
  const [queue, setQueue] = useState<QueueFilter>("needs_attention");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>("all");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodFilter>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState<OrderPagination>(DEFAULT_PAGINATION);
  const [summary, setSummary] = useState<OrderSummary>(DEFAULT_SUMMARY);
  const [confirm, setConfirm] = useState<{ order: Order; target: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);
  const { t } = useLocale();

  const dateRangeOptions = useMemo(
    () => [
      { value: "today" as DateRange, label: t("dashboard.today") },
      { value: "week" as DateRange, label: t("orders.this_week") },
      { value: "month" as DateRange, label: t("dashboard.this_month") },
      { value: "all" as DateRange, label: t("orders.all_time") },
    ],
    [t],
  );

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort,
    });

    if (queue !== "all") params.set("queue", queue);
    if (status !== "all") params.set("status", status);
    if (paymentStatus !== "all") params.set("payment_status", paymentStatus);
    if (paymentMethod !== "all") params.set("payment_method", paymentMethod);
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    addDateParams(params, dateRange);

    try {
      const res = await fetch(`${API}/orders?${params.toString()}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        const nextOrders = data.orders || [];
        setOrders(nextOrders);
        setPagination(data.pagination || DEFAULT_PAGINATION);
        setSummary(data.summary || DEFAULT_SUMMARY);
        setDetail((current) =>
          current ? nextOrders.find((order: Order) => order.id === current.id) || current : null,
        );
      }
    } catch {
      /* keep the current table visible */
    } finally {
      setLoading(false);
    }
  }, [dateRange, debouncedSearch, limit, page, paymentMethod, paymentStatus, queue, sort, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [dateRange, debouncedSearch, paymentMethod, paymentStatus, queue, sort, status]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateOrderInState = useCallback((nextOrder: Order) => {
    setOrders((prev) => prev.map((order) => (order.id === nextOrder.id ? nextOrder : order)));
    setDetail((current) => (current?.id === nextOrder.id ? nextOrder : current));
  }, []);

  const handleSafeStatus = useCallback(
    async (order: Order, targetStatus: string) => {
      const optimistic = { ...order, status: targetStatus, updated_at: new Date().toISOString() };
      updateOrderInState(optimistic);
      try {
        const res = await fetch(`${API}/orders/${order.id}/status`, {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({ status: targetStatus }),
        });
        if (!res.ok) throw new Error("Failed to update order");
        const data = await res.json();
        updateOrderInState(data.order);
      } catch {
        updateOrderInState(order);
        fetchOrders();
      }
    },
    [fetchOrders, updateOrderInState],
  );

  const handleConfirmStatus = async (tracking: string, cancelReason: string) => {
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
        updateOrderInState(data.order);
      }
    } catch {
      /* keep previous state */
    } finally {
      setConfirming(false);
      setConfirm(null);
    }
  };

  const queueOptions = [
    { key: "needs_attention" as QueueFilter, count: summary.needs_attention, icon: AlertTriangle },
    { key: "active" as QueueFilter, count: summary.active, icon: Clock },
    { key: "completed" as QueueFilter, count: summary.completed, icon: PackageCheck },
    { key: "cancelled" as QueueFilter, count: summary.cancelled, icon: XCircle },
    { key: "all" as QueueFilter, count: summary.all, icon: Package },
  ];

  const totalPages = pagination.total_pages || 0;
  const pageStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const pageEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <TooltipProvider delay={150} closeDelay={0}>
    <div className="mx-auto w-full max-w-[1500px] space-y-5 pb-12">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-black tracking-tight text-foreground">
            <ShoppingBag size={24} className="text-emerald-500" />
            {t("orders.title")}
            {summary.needs_attention > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-500/15 px-2.5 py-1 text-xs font-bold text-orange-500">
                <AlertTriangle size={12} />
                {summary.needs_attention} needs attention
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Prioritize review, fulfillment, and customer updates from one working list.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchOrders}
          disabled={loading}
          className="dash-secondary-action shrink-0"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Needs attention", value: summary.needs_attention, icon: AlertTriangle },
          { label: "Active", value: summary.active, icon: Clock },
          { label: "Completed", value: summary.completed, icon: TrendingUp },
          { label: "All orders", value: summary.all, icon: Package },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
              <Icon size={16} className="text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="dash-label truncate">{label}</p>
              <p className="text-lg font-black text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="flex flex-wrap gap-2">
            {queueOptions.map(({ key, count, icon: Icon }) => {
              const active = queue === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setQueue(key)}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                    active
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon size={15} />
                  <span>{QUEUE_LABELS[key]}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <SegmentedControl
              label="Date"
              options={dateRangeOptions}
              value={dateRange}
              onChange={setDateRange}
            />

            <div className="flex flex-wrap items-center gap-2">
              <ToolbarSearch
                label="Search orders"
                placeholder="Search name, phone, or order"
                value={search}
                onChange={setSearch}
                className="w-full sm:w-72"
              />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
                className="dash-input min-h-10"
                aria-label="Filter by order status"
              >
                <option value="all">Any status</option>
                <option value="new">New</option>
                <option value="confirmed">Confirmed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={paymentStatus}
                onChange={(event) => setPaymentStatus(event.target.value as PaymentStatusFilter)}
                className="dash-input min-h-10"
                aria-label="Filter by payment status"
              >
                <option value="all">Any payment</option>
                <option value="pending">Pending</option>
                <option value="awaiting_verification">Awaiting review</option>
                <option value="approved">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as PaymentMethodFilter)}
                className="dash-input min-h-10"
                aria-label="Filter by payment method"
              >
                <option value="all">Any method</option>
                <option value="cod">COD</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortOption)}
                className="dash-input min-h-10"
                aria-label="Sort orders"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="updated_desc">Recently updated</option>
                <option value="updated_asc">Least recently updated</option>
                <option value="total_desc">Highest total</option>
                <option value="total_asc">Lowest total</option>
              </select>
            </div>
          </div>
        </div>

        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center py-28 text-muted-foreground">
            <Loader2 size={26} className="mr-3 animate-spin" />
            <span className="text-sm font-medium">{t("common.loading")}...</span>
          </div>
        ) : summary.all === 0 && !debouncedSearch && queue === "all" ? (
          <DashboardEmptyInsight
            className="py-16"
            icon={<ShoppingBag size={40} className="text-emerald-500" />}
            title={t("orders.no_orders")}
            description="Orders appear here when customers buy through your WhatsApp bot."
            primaryHref="/dashboard/connect"
            primaryLabel="Connect WhatsApp"
            secondaryHref="/dashboard/products"
            secondaryLabel="Add Products"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-black tracking-widest">Order</th>
                    <th className="px-4 py-3 font-black tracking-widest">Customer</th>
                    <th className="px-4 py-3 font-black tracking-widest">Payment</th>
                    <th className="px-4 py-3 font-black tracking-widest">Status</th>
                    <th className="px-4 py-3 font-black tracking-widest">Age</th>
                    <th className="px-4 py-3 text-right font-black tracking-widest">Total</th>
                    <th className="px-4 py-3 text-right font-black tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">
                        No orders match the current filters.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const isOverdue =
                        order.status === "shipped" &&
                        Date.now() - new Date(order.updated_at).getTime() >= 5 * 24 * 60 * 60 * 1000;
                      const needsProofReview =
                        order.payment_method === "bank_transfer" &&
                        order.payment_status === "awaiting_verification";
                      const paymentBadge = paymentBadgeConfig(order.payment_method, order.payment_status);
                      const PaymentIcon = paymentBadge?.icon ?? BanknoteIcon;

                      return (
                        <tr key={order.id} className="bg-card align-top transition-colors hover:bg-muted/35">
                          <td className="max-w-[390px] px-4 py-4">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-black text-foreground">#{order.order_num || order.id}</span>
                                {needsProofReview && (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-bold text-orange-500">
                                    <Eye size={12} />
                                    Review proof
                                  </span>
                                )}
                                {isOverdue && (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-500">
                                    <AlertTriangle size={12} />
                                    Late
                                  </span>
                                )}
                              </div>
                              <p className="line-clamp-2 text-sm text-muted-foreground">
                                {orderItemsPreview(order)}
                              </p>
                              <p className="text-xs text-muted-foreground">Created {formatDateTime(order.created_at)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-foreground">{order.customer_name || "Anonymous"}</p>
                              <p className="font-mono text-xs text-muted-foreground">{order.customer_phone}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-foreground">
                                {order.payment_method === "bank_transfer" ? "Bank transfer" : "COD"}
                              </p>
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-bold ${
                                  paymentBadge?.cls || "border-border bg-muted text-muted-foreground"
                                }`}
                              >
                                <PaymentIcon size={12} />
                                {paymentBadge?.label || paymentStatusText(order)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${statusClass(order.status)}`}>
                              {STATUS_LABELS[order.status] || order.status}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-semibold text-foreground">{formatAge(order.updated_at)}</p>
                            <p className="text-xs text-muted-foreground">Updated {formatDateTime(order.updated_at)}</p>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <p className="text-sm font-black text-foreground">{fmtMoney(order.total_price)}</p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <ActionIconButton
                                label={`View order ${order.order_num || order.id}`}
                                onClick={() => setDetail(order)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <Eye size={15} />
                              </ActionIconButton>
                              {order.status === "new" && (
                                <ActionIconButton
                                  label={`Confirm order ${order.order_num || order.id}`}
                                  onClick={() => handleSafeStatus(order, "confirmed")}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 transition-colors hover:bg-emerald-500/15"
                                >
                                  <CheckCircle2 size={15} />
                                </ActionIconButton>
                              )}
                              {order.status === "shipped" && (
                                <ActionIconButton
                                  label={`Mark order ${order.order_num || order.id} delivered`}
                                  onClick={() => handleSafeStatus(order, "delivered")}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 transition-colors hover:bg-emerald-500/15"
                                >
                                  <PackageCheck size={15} />
                                </ActionIconButton>
                              )}
                              {needsProofReview && (
                                <ActionIconButton
                                  label={`Review payment proof for order ${order.order_num || order.id}`}
                                  onClick={() => setDetail(order)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-500 transition-colors hover:bg-orange-500/15"
                                >
                                  <BanknoteIcon size={15} />
                                </ActionIconButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-bold text-foreground">{pageStart}</span>-
                <span className="font-bold text-foreground">{pageEnd}</span> of{" "}
                <span className="font-bold text-foreground">{pagination.total}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={limit}
                  onChange={(event) => {
                    setLimit(Number(event.target.value));
                    setPage(1);
                  }}
                  className="dash-input min-h-9 py-1.5"
                  aria-label="Orders per page"
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={pagination.page <= 1 || loading}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                {visiblePageNumbers(pagination.page, totalPages).map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    disabled={loading}
                    className={`h-9 min-w-9 rounded-lg border px-3 text-sm font-bold ${
                      pagination.page === pageNumber
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-500"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages || current, current + 1))}
                  disabled={pagination.page >= totalPages || loading}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          order={confirm.order}
          targetStatus={confirm.target}
          onConfirm={handleConfirmStatus}
          onCancel={() => setConfirm(null)}
          loading={confirming}
        />
      )}

      {detail && (
        <SingleOrderView
          order={detail}
          onClose={() => setDetail(null)}
          onRequestStatus={(order, targetStatus) => setConfirm({ order, target: targetStatus })}
          onSafeStatus={handleSafeStatus}
          onProofAction={() => {
            fetchOrders();
            setDetail(null);
          }}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
