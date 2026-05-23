"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  RefreshCw,
  Box,
  Activity,
  Network,
  MessageSquare,
  ChevronRight,
  Cpu,
  Zap,
  Bug,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* ── helpers ─────────────────────────────────────────────── */

type PipelineSignalLog = {
  id: number;
  rule_id: number;
  matched_entry: string;
  keyword_strength: string;
  raw_confidence: number;
  final_confidence: number;
  after_weight: number;
  after_modifiers: number;
  rank: number;
};

type PipelineLog = {
  id: number;
  created_at: string;
  phone: string;
  raw_message: string;
  clean_message: string;
  reduced_message: string;
  route_taken: string;
  action_taken: string;
  ai_used: boolean;
  bot_reply_text?: string;
  bot_reply_payload?: string;
  error_message?: string;
  state_before?: string;
  state_after?: string;
  execution_time_ms?: number;
  intent_classified?: string;
  legacy_intent?: string;
  router_intent?: string;
  router_route?: string;
  router_confidence?: number;
  router_cart_policy?: string;
  router_usage_class?: string;
  router_reasons?: string;
  model_used?: string;
  signal_logs?: PipelineSignalLog[];
};

type RouterShadowDecision = {
  intent: string;
  route: string;
  confidence: number;
  cartPolicy: string;
  usageClass: string;
  reasons: string[];
  legacyIntent: string;
};

type BusinessDebugState = {
  id: number;
  name: string;
  debug_active: boolean;
  debug_expires_at: string | null;
  debug_remaining_seconds: number;
};

const DEBUG_DURATIONS = [1, 6, 24, 72];

function getApiErrorMessage(err: unknown) {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response;
    if (response?.data?.error) return response.data.error;
  }
  return err instanceof Error ? err.message : "Request failed";
}

function formatDebugRemaining(seconds: number, expiresAt: string | null) {
  if (seconds > 0) {
    if (seconds < 3600) return `${Math.max(1, Math.ceil(seconds / 60))}m left`;
    return `${Math.ceil(seconds / 3600)}h left`;
  }
  if (!expiresAt) return "";
  return `until ${new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatTime(dateString: string) {
  const d = new Date(dateString);
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );
}

function normalizeConfidence(value?: number) {
  if (!value || Number.isNaN(value)) return 0;
  return value <= 1 ? value * 100 : value;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getRouterShadow(log?: PipelineLog | null): RouterShadowDecision | null {
  if (!log) return null;

  if (log.router_intent || log.router_route) {
    return {
      intent: log.router_intent || log.intent_classified || "",
      route: log.router_route || "",
      confidence: normalizeConfidence(log.router_confidence),
      cartPolicy: log.router_cart_policy || "",
      usageClass: log.router_usage_class || "",
      reasons: (log.router_reasons || "").split("\n").map((reason) => reason.trim()).filter(Boolean),
      legacyIntent: log.legacy_intent || "",
    };
  }

  if (!log.bot_reply_payload) return null;

  try {
    const parsed = JSON.parse(log.bot_reply_payload) as Record<string, unknown>;
    if (parsed.shadow !== true) return null;
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.map((reason) => String(reason)).filter(Boolean)
      : [];

    return {
      intent: asString(parsed.intent),
      route: asString(parsed.route),
      confidence: normalizeConfidence(asNumber(parsed.confidence)),
      cartPolicy: asString(parsed.cart_policy),
      usageClass: asString(parsed.usage_class),
      reasons,
      legacyIntent: asString(parsed.legacy),
    };
  } catch {
    return null;
  }
}

function RouteTag({ route }: { route: string }) {
  const map: Record<string, { bg: string; text: string; border: string; label: string }> = {
    faq_high: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/20", label: "FAQ High" },
    faq_medium: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/20", label: "FAQ Medium" },
    semantic_direct: { bg: "bg-green-500/10", text: "text-green-500", border: "border-green-500/20", label: "Semantic Direct" },
    semantic_hint: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", label: "Semantic Hint" },
    gemini_raw: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20", label: "Gemini Raw" },
    catalog: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", label: "Catalog" },
    faq_or_gemini: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20", label: "FAQ/Gemini" },
    order_bot: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", label: "Order Bot" },
    native_catalog: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", label: "Native Catalog" },
    native_product: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", label: "Native Product" },
    clarify: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "Clarify" },
    context_bridge: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20", label: "Context Bridge" },
    system_limit: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "System Limit" },
    gibberish: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", label: "Gibberish" },
    drop: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", label: "Dropped" },
  };
  
  if (!route) return <span className="text-muted-foreground">—</span>;
  
  const s = route.startsWith("bot_state_")
    ? { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20", label: "State Machine" }
    : (map[route] ?? { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20", label: route });
    
  return (
    <Badge variant="outline" className={cn(s.bg, s.text, s.border, "font-bold tracking-wider uppercase text-[0.65rem] px-2 py-0.5 rounded-full")}>
      {s.label}
    </Badge>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const colorClass = value >= 80 ? "bg-green-400" : value >= 60 ? "bg-amber-400" : "bg-red-400";
  const textColorClass = value >= 80 ? "text-green-400" : value >= 60 ? "text-amber-400" : "text-red-400";
  
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-[60px] h-1 bg-border rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", colorClass)} 
          style={{ width: `${Math.min(value, 100)}%` }} 
        />
      </div>
      <span className={cn("font-mono text-[0.8125rem] font-bold min-w-[42px] text-right", textColorClass)}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */

export default function PipelineLogsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [debugDuration, setDebugDuration] = useState(24);
  const [debugReason, setDebugReason] = useState("");
  const [debugBusy, setDebugBusy] = useState(false);
  const [debugMessage, setDebugMessage] = useState("");

  const { data: businessData, mutate: mutateBusiness } = useSWR(
    id ? `/system/businesses/${id}` : null,
    (url: string) => api.get(url).then((r) => r.data as { business: BusinessDebugState })
  );

  const { data, isLoading, mutate, isValidating } = useSWR(
    id ? `/system/businesses/${id}/pipeline-logs?page=${page}&limit=50` : null,
    (url: string) => api.get(url).then((r) => r.data as { data: PipelineLog[]; meta: { total: number; page: number; limit: number } }),
    { refreshInterval: 10000 }
  );

  const { data: detailData, isLoading: detailLoading } = useSWR(
    selectedLogId ? `/system/pipeline-logs/${selectedLogId}` : null,
    (url: string) => api.get(url).then((r) => r.data as { log: PipelineLog })
  );

  const logs: PipelineLog[] = data?.data || [];
  const meta = data?.meta || { total: 0 };
  const detail = detailData?.log;
  const detailSignals = detail?.signal_logs || [];
  const routerShadow = getRouterShadow(detail);
  const business = businessData?.business;

  const startDebug = async () => {
    setDebugBusy(true);
    setDebugMessage("");
    try {
      await api.post(`/system/businesses/${id}/debug-mode`, {
        enable: true,
        duration_hours: debugDuration,
        reason: debugReason.trim() || undefined,
      });
      setDebugMessage(`Pipeline debugging enabled for ${debugDuration}h.`);
      setDebugReason("");
      mutateBusiness();
      mutate();
    } catch (err: unknown) {
      setDebugMessage(`Error: ${getApiErrorMessage(err)}`);
    } finally {
      setDebugBusy(false);
    }
  };

  const stopDebug = async () => {
    setDebugBusy(true);
    setDebugMessage("");
    try {
      await api.post(`/system/businesses/${id}/debug-mode`, {
        enable: false,
        reason: debugReason.trim() || undefined,
      });
      setDebugMessage("Pipeline debugging stopped.");
      setDebugReason("");
      mutateBusiness();
      mutate();
    } catch (err: unknown) {
      setDebugMessage(`Error: ${getApiErrorMessage(err)}`);
    } finally {
      setDebugBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-7 animate-fade-up">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/businesses/${id}`)}
            className="size-9 shrink-0 rounded-lg"
          >
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-foreground">
              <Network className="size-6 text-primary" />
              Pipeline Telemetry
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Real-time bot routing decisions, AI invocations & signal density.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => mutate()}
          disabled={isValidating}
          className="rounded-xl font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className={cn("mr-2 size-4", isValidating && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* ── Table card ─────────────────────────────────────── */}
     <Card
  className={cn(
    "overflow-hidden rounded-2xl border-border/70 bg-card/80 shadow-sm backdrop-blur-sm transition-all duration-300",
    business?.debug_active && "border-amber-400/30 ring-1 ring-amber-400/25"
  )}
>
  <CardHeader className="border-b border-border/60 px-6 py-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-300 shadow-sm">
          <Bug className="size-5" />
        </div>

        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-bold tracking-tight">
              Pipeline Debug Capture
            </CardTitle>

            {business?.debug_active && (
              <Badge
                className="rounded-full border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300"
                variant="outline"
              >
                Active
              </Badge>
            )}
          </div>

          <CardDescription className="max-w-2xl text-sm leading-relaxed">
            {business?.debug_active
              ? `Capturing until ${
                  business.debug_expires_at
                    ? new Date(business.debug_expires_at).toLocaleString()
                    : "expiry"
                } (${formatDebugRemaining(
                  business.debug_remaining_seconds,
                  business.debug_expires_at
                )}).`
              : "Enable capture before reproducing a customer message."}
          </CardDescription>
        </div>
      </div>

      <CardAction className="self-start">
        <Button
          className={cn(
            "h-10 rounded-xl px-4 font-semibold transition-all duration-200",
            business?.debug_active
              ? "border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              : "border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
          )}
          disabled={debugBusy}
          onClick={business?.debug_active ? stopDebug : startDebug}
          variant="outline"
        >
          {business?.debug_active ? (
            <X className="mr-2 size-4" />
          ) : (
            <Bug className="mr-2 size-4" />
          )}

          {debugBusy
            ? "Applying..."
            : business?.debug_active
              ? "Stop Debug"
              : "Start Debug"}
        </Button>
      </CardAction>
    </div>
  </CardHeader>

  <CardContent className="px-6 py-5">
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <div className="grid grid-cols-4 gap-2 rounded-xl border border-border/60 bg-background/40 p-1.5">
        {DEBUG_DURATIONS.map((hours) => (
          <Button
            className={cn(
              "h-10 rounded-lg border-transparent font-semibold transition-all",
              debugDuration === hours
                ? "border-amber-400/40 bg-amber-400/10 text-amber-300 shadow-sm"
                : "bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            disabled={business?.debug_active}
            key={hours}
            onClick={() => setDebugDuration(hours)}
            type="button"
            variant="outline"
          >
            {hours}h
          </Button>
        ))}
      </div>

      <Input
        className="h-[52px] min-w-0 rounded-xl border-border/70 bg-background/40 px-4 text-sm shadow-sm placeholder:text-muted-foreground/70 focus-visible:ring-amber-400/25"
        onChange={(e) => setDebugReason(e.target.value)}
        placeholder={
          business?.debug_active ? "Stop reason (optional)" : "Reason (optional)"
        }
        value={debugReason}
      />
    </div>

    {debugMessage && (
      <div
        className={cn(
          "mt-4 rounded-xl border px-4 py-3 text-sm font-semibold",
          debugMessage.includes("Error")
            ? "border-destructive/25 bg-destructive/10 text-destructive"
            : "border-green-400/20 bg-green-400/10 text-green-400"
        )}
      >
        {debugMessage}
      </div>
    )}
  </CardContent>
</Card>

     <Card className="overflow-hidden rounded-2xl border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
  <CardHeader className="border-b border-border/60 px-6 py-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight">
          <Activity className="size-4 text-primary" />
          Pipeline Logs
        </CardTitle>
        <CardDescription className="mt-1 text-sm">
          Captured customer messages, routing decisions, actions, and execution time.
        </CardDescription>
      </div>

      <Badge
        variant="outline"
        className="w-fit rounded-full border-border/70 bg-background/40 px-3 py-1 font-mono text-xs text-muted-foreground"
      >
        {logs.length} / {meta.total}
      </Badge>
    </div>
  </CardHeader>

  <CardContent className="p-0">
    <div className="overflow-x-auto">
      <Table className="min-w-[900px] text-sm">
        <TableHeader>
          <TableRow className="border-border/60 bg-muted/30 hover:bg-muted/30">
            <TableHead className="h-12 w-[190px] px-6 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
              Timestamp
            </TableHead>
            <TableHead className="h-12 w-[170px] px-6 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
              Customer
            </TableHead>
            <TableHead className="h-12 w-[110px] px-6 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
              Length
            </TableHead>
            <TableHead className="h-12 w-[180px] px-6 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
              Route
            </TableHead>
            <TableHead className="h-12 px-6 text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
              Action
            </TableHead>
            <TableHead className="h-12 w-[130px] px-6 text-right text-[0.7rem] font-bold uppercase tracking-wider text-muted-foreground">
              Time
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading && !logs.length ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-32 text-center text-muted-foreground"
              >
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-muted/30">
                    <RefreshCw className="size-5 animate-spin" />
                  </div>
                  <span className="text-sm font-medium">Loading logs...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-40 border-b-0 text-center">
                <div className="mx-auto flex max-w-sm flex-col items-center justify-center">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-muted/30">
                    <Activity className="size-6 text-muted-foreground/60" />
                  </div>

                  <p className="text-sm font-semibold text-foreground">
                    No pipeline logs found.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enable Debug Mode on this business to start capturing.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <TableRow
                key={log.id}
                onClick={() => setSelectedLogId(log.id)}
                className="group cursor-pointer border-border/50 transition-colors hover:bg-muted/35"
              >
                <TableCell className="px-6 py-4">
                  <div className="font-mono text-xs font-medium text-muted-foreground">
                    {formatTime(log.created_at)}
                  </div>
                </TableCell>

                <TableCell className="px-6 py-4">
                  <div className="font-mono text-sm font-bold text-foreground">
                    {log.phone}
                  </div>
                </TableCell>

                <TableCell className="px-6 py-4">
                  <Badge
                    variant="secondary"
                    className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 font-mono text-xs text-muted-foreground hover:bg-muted/50"
                  >
                    {(log.raw_message || "").length}c
                  </Badge>
                </TableCell>

                <TableCell className="px-6 py-4">
                  <div className="flex flex-col items-start gap-1.5">
                    <RouteTag route={log.route_taken} />
                    {getRouterShadow(log) && (
                      <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-cyan-300">
                        <span className="text-muted-foreground">Router</span>
                        <RouteTag route={getRouterShadow(log)?.route || ""} />
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell className="px-6 py-4">
                  <span className="text-sm font-semibold text-muted-foreground group-hover:text-foreground">
                    {log.action_taken || "—"}
                  </span>
                </TableCell>

                <TableCell className="px-6 py-4 text-right">
                  <span className="font-mono text-xs font-medium text-muted-foreground">
                    {log.execution_time_ms ? `${log.execution_time_ms}ms` : "—"}
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  </CardContent>
</Card>

      {/* ── Pagination ─────────────────────────────────────── */}
   <div className="flex flex-col gap-4 px-1 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
  <span>
    Showing{" "}
    <strong className="font-bold text-foreground">{logs.length}</strong> of{" "}
    <strong className="font-bold text-foreground">{meta.total}</strong> logs
  </span>

  <div className="flex gap-2">
    <Button
      variant="outline"
      size="sm"
      disabled={page === 1}
      onClick={() => setPage((p) => Math.max(1, p - 1))}
      className="h-9 rounded-xl px-4 font-semibold"
    >
      &larr; Prev
    </Button>

    <Button
      variant="outline"
      size="sm"
      disabled={logs.length < 50}
      onClick={() => setPage((p) => p + 1)}
      className="h-9 rounded-xl px-4 font-semibold"
    >
      Next &rarr;
    </Button>
  </div>
</div>

      {/* ── Detail Sheet ───────────────────────────────────── */}
      <Sheet open={selectedLogId !== null} onOpenChange={(open) => !open && setSelectedLogId(null)}>
        <SheetContent
          className="w-full overflow-y-auto border-l border-border bg-background p-0 sm:max-w-none sm:w-[min(860px,92vw)]"
        >
          <div className="p-8">
            <SheetHeader className="mb-6 border-b border-border pb-5 text-left">
              <div className="flex items-center gap-3.5">
                <div className="flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Activity className="size-5" />
                </div>
                <div>
                  <SheetTitle className="text-xl font-black tracking-tight text-foreground">
                    Execution Trace
                  </SheetTitle>
                  <SheetDescription className="mt-1 font-mono text-xs text-muted-foreground">
                    TRACE #{selectedLogId}{detail ? ` · ${formatTime(detail.created_at)}` : ""}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {/* loading skeleton */}
            {detailLoading || !detail ? (
              <div className="flex flex-col gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className={cn("animate-pulse rounded-xl bg-muted/50", i === 2 ? "h-[180px]" : "h-[80px]")} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-6">

                {/* ── Raw Message ─────────────────────────────── */}
                <Card className="overflow-hidden border-l-4 border-l-primary bg-card shadow-sm">
                  <CardContent className="p-5">
                    <div className="mb-2.5 flex items-center gap-1.5 text-[0.7rem] font-bold tracking-widest text-muted-foreground uppercase">
                      <MessageSquare className="size-3.5" /> Ingested Message
                    </div>
                    <p className="font-medium leading-relaxed text-[0.9375rem] text-foreground">
                      {detail.raw_message || <em className="not-italic text-muted-foreground">Media payload — no text content</em>}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      {[
                        { label: "Pipeline Cleaned", value: detail.clean_message },
                        { label: "Stemmed & Reduced", value: detail.reduced_message },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div className="mb-1.5 text-[0.65rem] font-bold tracking-widest text-muted-foreground/70 uppercase">{label}</div>
                          <div className="overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border border-border/50 bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                            {value || "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* ── Bot Reply ─────────────────────────────── */}
                <Card className="overflow-hidden border-l-4 border-l-emerald-500 bg-card shadow-sm">
                  <CardContent className="p-5">
                    <div className="mb-2.5 flex items-center gap-1.5 text-[0.7rem] font-bold tracking-widest text-muted-foreground uppercase">
                      <MessageSquare className="size-3.5" /> Bot Response
                    </div>
                    <p className="whitespace-pre-wrap font-medium leading-relaxed text-[0.9375rem] text-foreground">
                      {detail.bot_reply_text || <em className="not-italic text-muted-foreground">No text reply captured</em>}
                    </p>
                    {detail.error_message && (
                      <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                        <div className="mb-1 text-[0.65rem] font-bold tracking-widest text-red-400 uppercase">Error Message</div>
                        <div className="text-sm font-medium text-red-300">{detail.error_message}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {routerShadow && (
                  <Card className="overflow-hidden border-l-4 border-l-cyan-500 bg-card shadow-sm">
                    <CardContent className="p-5">
                      <div className="mb-3.5 flex items-center gap-1.5 text-[0.7rem] font-bold tracking-widest text-muted-foreground uppercase">
                        <Network className="size-3.5" /> Router Shadow Decision
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          {[
                            {
                              label: "Intent",
                              value: routerShadow.intent ? (
                                <Badge variant="outline" className="px-1.5 py-0 font-mono text-[0.65rem]">
                                  {routerShadow.intent}
                                </Badge>
                              ) : "N/A",
                            },
                            { label: "Route", value: <RouteTag route={routerShadow.route} /> },
                            {
                              label: "Confidence",
                              value: <ConfidenceBar value={routerShadow.confidence} />,
                            },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between gap-3">
                              <span className="text-sm text-muted-foreground">{label}</span>
                              {value}
                            </div>
                          ))}
                        </div>

                        <div className="space-y-3">
                          {[
                            { label: "Legacy Intent", value: routerShadow.legacyIntent || "N/A" },
                            { label: "Cart Policy", value: routerShadow.cartPolicy || "N/A" },
                            { label: "Usage Class", value: routerShadow.usageClass || "N/A" },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between gap-3">
                              <span className="text-sm text-muted-foreground">{label}</span>
                              <span className="font-mono text-[0.75rem] font-semibold text-foreground">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {routerShadow.reasons.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {routerShadow.reasons.map((reason) => (
                            <Badge
                              key={reason}
                              variant="outline"
                              className="rounded-full border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 font-mono text-[0.65rem] text-cyan-300"
                            >
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Routing + Flags ─────────────────────────── */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Routing card */}
                  <Card className="bg-card shadow-sm">
                    <CardContent className="p-5">
                      <div className="mb-3.5 flex items-center gap-1.5 text-[0.7rem] font-bold tracking-widest text-muted-foreground uppercase">
                        <Zap className="size-3.5" /> Routing Decision
                      </div>
                      <div className="flex flex-col gap-3">
                        {[
                          { label: "Route", value: <RouteTag route={detail.route_taken} /> },
                          { label: "Action", value: <span className="text-sm font-bold text-foreground">{detail.action_taken || "—"}</span> },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{label}</span>
                            {value}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Flags card */}
                  <Card className="bg-card shadow-sm">
                    <CardContent className="p-5">
                      <div className="mb-3.5 flex items-center gap-1.5 text-[0.7rem] font-bold tracking-widest text-muted-foreground uppercase">
                        <Cpu className="size-3.5" /> Execution Context
                      </div>
                      <div className="flex flex-col gap-3">
                        {[
                          {
                            label: "Intent",
                            value: detail.intent_classified ? (
                              <Badge variant="outline" className="px-1.5 py-0 font-mono text-[0.65rem]">{detail.intent_classified}</Badge>
                            ) : "—",
                          },
                          {
                            label: "Cart State",
                            value: (
                              <div className="flex items-center gap-1 font-mono text-[0.65rem] text-muted-foreground">
                                {detail.state_before || "none"} <ChevronRight className="size-3" /> {detail.state_after || "none"}
                              </div>
                            ),
                          },
                          {
                            label: "Model",
                            value: detail.model_used ? (
                              <Badge variant="secondary" className="border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0 font-mono text-[0.65rem] text-indigo-500 hover:bg-indigo-500/20">{detail.model_used}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground/70">None</span>
                            ),
                          },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">{label}</span>
                            {value}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* ── Signal Map ──────────────────────────────── */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Box className="size-4 text-primary" />
                    <h3 className="text-base font-bold tracking-tight text-foreground">Signal Density Map</h3>
                  </div>
                  <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                    Each row shows a rule the scorer evaluated, with its raw confidence, any modifier effects, and the final confidence used for routing.
                  </p>

                  {detailSignals.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                      No explicit signals were logged for this payload.
                    </div>
                  ) : (
                    <Card className="overflow-hidden bg-card shadow-sm">
                      {/* signal thead */}
                      <div className="grid grid-cols-[36px_1.8fr_1fr_1fr_1fr_1.4fr] border-b border-border bg-muted/30 px-4 py-2.5">
                        {["#", "Matched Keyword", "Strength", "Raw", "Modified", "Final Conf"].map((h) => (
                          <span key={h} className={cn("text-[0.68rem] font-bold tracking-widest text-muted-foreground uppercase", (h === "Final Conf" || h === "Modified" || h === "Raw") && "text-right")}>
                            {h}
                          </span>
                        ))}
                      </div>

                      {/* signal rows */}
                      <div className="flex flex-col">
                        {detailSignals.map((s, idx) => (
                          <div
                            key={s.id}
                            className={cn(
                              "grid grid-cols-[36px_1.8fr_1fr_1fr_1fr_1.4fr] items-center px-4 py-3 transition-colors hover:bg-muted/30",
                              idx < detailSignals.length - 1 && "border-b border-border/50"
                            )}
                          >
                            <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[0.68rem] font-bold text-muted-foreground">
                              {s.rank}
                            </span>

                            <div>
                              <div className="text-sm font-bold text-foreground">{s.matched_entry}</div>
                              <div className="mt-0.5 font-mono text-[0.68rem] text-muted-foreground">Rule #{s.rule_id}</div>
                            </div>

                            <span className="w-fit rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[0.68rem] text-muted-foreground uppercase">
                              {s.keyword_strength}
                            </span>

                            <span className="text-right font-mono text-xs text-muted-foreground/70">
                              {(s.raw_confidence ?? 0).toFixed(1)}%
                            </span>

                            <span className={cn("text-right font-mono text-xs", s.after_modifiers !== s.after_weight ? "font-bold text-amber-500" : "text-muted-foreground/70")}>
                              {s.after_modifiers !== s.after_weight ? `${(s.after_modifiers ?? 0).toFixed(1)}%` : "—"}
                            </span>

                            <ConfidenceBar value={s.final_confidence ?? 0} />
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
