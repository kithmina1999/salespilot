"use client"

import { useState } from "react"
import Link from "next/link"
import { createPortal } from "react-dom"
import useSWR from "swr"
import { Bug, Building2, ChevronRight, Eye, Search, X } from "lucide-react"

import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/components/admin/data-table"
import {
  AdminPage,
  AdminPageHeader,
} from "@/components/admin/page"
import { PlanBadge, StatusBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  TableCell,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

type Business = {
  id: number
  name: string
  phone: string
  plan: string
  plan_expires_at: string | null
  created_at: string
  wa_status: string
  suspended_at: string | null
  ai_message_count: number
  ai_message_limit: number
  trial_expires_at: string | null
  debug_active: boolean
  debug_expires_at: string | null
  debug_remaining_seconds: number
}

const DEBUG_DURATIONS = [1, 6, 24, 72]
const DEBUG_MENU_WIDTH = 280
const DEBUG_MENU_HEIGHT = 230
const BUSINESS_COLUMNS: AdminDataTableColumn[] = [
  { key: "name", header: "ID / Name" },
  { key: "phone", header: "Phone" },
  { key: "plan", header: "Plan" },
  { key: "wa", header: "WA" },
  { key: "usage", header: "Usage" },
  { key: "status", header: "Status / Joined" },
  { key: "actions", header: "", className: "text-right" },
]

function formatDebugRemaining(seconds: number, expiresAt: string | null) {
  if (seconds > 0) {
    if (seconds < 3600) return `${Math.max(1, Math.ceil(seconds / 60))}m left`
    return `${Math.ceil(seconds / 3600)}h left`
  }
  if (!expiresAt) return ""
  return `until ${new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
}

function DebugBadge({ business }: { business: Business }) {
  if (!business.debug_active) return null

  return (
    <StatusBadge
      tone="warning"
      title={business.debug_expires_at ? `Debugging until ${new Date(business.debug_expires_at).toLocaleString()}` : "Debugging active"}
      className="gap-1"
    >
      Debug
      <span className="normal-case tracking-normal text-muted-foreground">
        {formatDebugRemaining(business.debug_remaining_seconds, business.debug_expires_at)}
      </span>
    </StatusBadge>
  )
}

function getDebugError(err: unknown) {
  if (err instanceof Error) return err.message
  return "Failed to update debugging"
}

export default function BusinessesPage() {
  const [search, setSearch] = useState("")
  const [debugTargetId, setDebugTargetId] = useState<number | null>(null)
  const [debugDuration, setDebugDuration] = useState(24)
  const [debugReason, setDebugReason] = useState("")
  const [debugBusyId, setDebugBusyId] = useState<number | null>(null)
  const [debugError, setDebugError] = useState("")
  const [debugMenuPosition, setDebugMenuPosition] = useState<{ top: number; left: number } | null>(null)

  const { data, isLoading: loading, mutate } = useSWR<{ businesses: Business[] }>(
    "/system/businesses",
    (url: string) => api.get(url).then((res) => res.data)
  )
  const businesses = data?.businesses || []

  const filtered = businesses.filter(
    (business) =>
      business.name.toLowerCase().includes(search.toLowerCase()) ||
      business.phone.includes(search)
  )

  const openDebugStart = (businessId: number, anchor: HTMLElement) => {
    if (debugTargetId === businessId) {
      setDebugTargetId(null)
      setDebugMenuPosition(null)
      return
    }

    const rect = anchor.getBoundingClientRect()
    const topBelow = rect.bottom + 8
    const topAbove = rect.top - DEBUG_MENU_HEIGHT - 8
    const top = topBelow + DEBUG_MENU_HEIGHT > window.innerHeight - 16
      ? Math.max(16, topAbove)
      : topBelow
    const left = Math.min(
      Math.max(16, rect.right - DEBUG_MENU_WIDTH),
      window.innerWidth - DEBUG_MENU_WIDTH - 16
    )

    setDebugTargetId(businessId)
    setDebugMenuPosition({ top, left })
    setDebugDuration(24)
    setDebugReason("")
    setDebugError("")
  }

  const startDebug = async (businessId: number) => {
    setDebugBusyId(businessId)
    setDebugError("")
    try {
      await api.post(`/system/businesses/${businessId}/debug-mode`, {
        enable: true,
        duration_hours: debugDuration,
        reason: debugReason.trim() || undefined,
      })
      setDebugTargetId(null)
      setDebugMenuPosition(null)
      setDebugReason("")
      mutate()
    } catch (err: unknown) {
      setDebugError(getDebugError(err))
    } finally {
      setDebugBusyId(null)
    }
  }

  const stopDebug = async (businessId: number) => {
    setDebugBusyId(businessId)
    setDebugError("")
    try {
      await api.post(`/system/businesses/${businessId}/debug-mode`, {
        enable: false,
      })
      mutate()
    } catch (err: unknown) {
      setDebugError(getDebugError(err))
    } finally {
      setDebugBusyId(null)
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Businesses"
        description={loading ? "Loading tenants..." : `${filtered.length} of ${businesses.length} tenants`}
        actions={
          <div className="relative w-[280px] max-w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search name or phone..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="bg-card pl-9"
            />
          </div>
        }
      />

      <AdminDataTable
        columns={BUSINESS_COLUMNS}
        isLoading={loading}
        isEmpty={filtered.length === 0}
        emptyIcon={Building2}
        emptyTitle="No businesses found."
        minWidth="1100px"
      >
        {filtered.map((business) => (
          <TableRow key={business.id} className="border-border/50 hover:bg-muted/30">
            <TableCell className="px-4 py-3">
              <div className="font-semibold text-foreground">{business.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">ID: {business.id}</div>
            </TableCell>
            <TableCell className="px-4 py-3 font-mono text-sm text-muted-foreground">
              {business.phone}
            </TableCell>
            <TableCell className="px-4 py-3">
              <PlanBadge plan={business.plan} />
            </TableCell>
            <TableCell className="px-4 py-3">
              <StatusBadge tone={business.wa_status === "connected" ? "success" : "muted"}>
                {business.wa_status ? business.wa_status.replace("_", " ") : "Not Connected"}
              </StatusBadge>
            </TableCell>
            <TableCell className="px-4 py-3 text-sm font-semibold text-foreground">
              {business.ai_message_limit > 0
                ? `${((business.ai_message_count / business.ai_message_limit) * 100).toFixed(1)}%`
                : "N/A"}
            </TableCell>
            <TableCell className="px-4 py-3">
              <div className="flex flex-col items-start gap-1.5">
                <DebugBadge business={business} />
                {business.suspended_at && <StatusBadge tone="destructive">Suspended</StatusBadge>}
                <span className="text-sm text-muted-foreground">
                  {new Date(business.created_at).toLocaleDateString()}
                </span>
              </div>
            </TableCell>
            <TableCell className="px-4 py-3">
              <div className="flex justify-end gap-1.5">
                {business.debug_active ? (
                  <>
                    <Button
                      onClick={() => stopDebug(business.id)}
                      disabled={debugBusyId === business.id}
                      title="Stop pipeline debugging"
                      variant="destructive"
                      size="icon-sm"
                    >
                      <X className="size-4" />
                    </Button>
                    <Button
                      nativeButton={false}
                      render={<Link href={`/businesses/${business.id}/pipeline`} />}
                      title="View pipeline logs"
                      variant="outline"
                      size="icon-sm"
                      className="border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                    >
                      <Eye className="size-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={(event) => openDebugStart(business.id, event.currentTarget)}
                    title="Start pipeline debugging"
                    variant="outline"
                    size="icon-sm"
                    className={cn(
                      "border-amber-500/30 text-amber-500 hover:bg-amber-500/10",
                      debugTargetId === business.id && "bg-amber-500/10"
                    )}
                  >
                    <Bug className="size-4" />
                  </Button>
                )}

                      <Button
                        nativeButton={false}
                        render={<Link href={`/businesses/${business.id}`} />}
                        variant="outline"
                        size="sm"
                        className="text-primary"
                      >
                        View
                        <ChevronRight className="size-3.5" />
                      </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </AdminDataTable>

      {debugTargetId !== null && debugMenuPosition && createPortal(
        <>
          <button
            aria-label="Close debug menu"
            onClick={() => {
              setDebugTargetId(null)
              setDebugMenuPosition(null)
            }}
            className="fixed inset-0 z-40 cursor-default border-0 bg-transparent"
          />
          <div
            className="fixed z-50"
            style={{
              top: `${debugMenuPosition.top}px`,
              left: `${debugMenuPosition.left}px`,
              width: `${DEBUG_MENU_WIDTH}px`,
            }}
          >
            <Card className="shadow-2xl">
              <CardHeader className="grid-cols-[1fr_auto]">
                <div>
                  <CardTitle className="text-sm">Start pipeline debugging</CardTitle>
                  <CardDescription className="text-xs">
                    Capture all text pipeline events for this business.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    setDebugTargetId(null)
                    setDebugMenuPosition(null)
                  }}
                  size="icon-sm"
                  variant="ghost"
                >
                  <X className="size-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {DEBUG_DURATIONS.map((hours) => (
                    <Button
                      className={debugDuration === hours ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : ""}
                      key={hours}
                      onClick={() => setDebugDuration(hours)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {hours}h
                    </Button>
                  ))}
                </div>
                <Input
                  value={debugReason}
                  onChange={(event) => setDebugReason(event.target.value)}
                  placeholder="Reason (optional)"
                />
                {debugError && <p className="text-xs font-semibold text-destructive">{debugError}</p>}
                <Button
                  className="w-full border-amber-400/35 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                  onClick={() => startDebug(debugTargetId)}
                  disabled={debugBusyId === debugTargetId}
                  variant="outline"
                >
                  {debugBusyId === debugTargetId ? "Starting..." : `Start for ${debugDuration}h`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </>,
        document.body
      )}
    </AdminPage>
  )
}
