"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  BookOpen,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  VolumeX,
  type LucideIcon,
} from "lucide-react"

import {
  AdminEmptyState,
  AdminIconFrame,
  AdminPage,
  AdminPageHeader,
  AdminSectionCard,
  AdminStatCard,
} from "@/components/admin/page"
import { StatusBadge, type StatusTone } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"

interface GlobalRule {
  ID: number
  keywords: string
  response: string
  sinhala_response: string
  is_active: boolean
  is_drop_rule: boolean
  is_context_bridge: boolean
  usage_count: number
}

type RuleType = "faq" | "drop" | "bridge"

const RULE_META: Record<RuleType, { label: string; description: string; icon: LucideIcon; tone: StatusTone }> = {
  faq: {
    label: "FAQ",
    description: "Standard FAQ reply rule.",
    icon: BookOpen,
    tone: "warning",
  },
  drop: {
    label: "Silent Drop",
    description: "No reply sent. No token consumed. No inbox log. Pure silence.",
    icon: VolumeX,
    tone: "destructive",
  },
  bridge: {
    label: "Context Bridge",
    description: "Checks conversation history. Re-prompts if bot asked a question; else drops silently.",
    icon: GitBranch,
    tone: "primary",
  },
}

function getRuleType(rule: GlobalRule): RuleType {
  if (rule.is_drop_rule) return "drop"
  if (rule.is_context_bridge) return "bridge"
  return "faq"
}

function RuleBadge({ type }: { type: RuleType }) {
  const meta = RULE_META[type]
  const Icon = meta.icon

  return (
    <StatusBadge tone={meta.tone} className="gap-1">
      <Icon className="size-3" />
      {meta.label}
    </StatusBadge>
  )
}

export default function GlobalRulesPage() {
  const { data: rules, error, mutate, isLoading } = useSWR<GlobalRule[]>(
    "/system/global-rules",
    (url: string) => api.get(url).then((res) => res.data)
  )
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    keywords: "",
    response: "",
    sinhala_response: "",
    is_active: true,
    ruleType: "faq" as RuleType,
  })

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setCreating(true)
    try {
      await api.post("/system/global-rules", {
        keywords: form.keywords,
        response: form.response,
        sinhala_response: form.sinhala_response,
        is_active: form.is_active,
        is_drop_rule: form.ruleType === "drop",
        is_context_bridge: form.ruleType === "bridge",
      })
      setShowCreate(false)
      setForm({ keywords: "", response: "", sinhala_response: "", is_active: true, ruleType: "faq" })
      mutate()
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this global rule? It affects all tenants immediately.")) return
    await api.delete(`/system/global-rules/${id}`)
    mutate()
  }

  const safeRules = rules || []
  const dropRules = safeRules.filter((rule) => rule.is_drop_rule)
  const bridgeRules = safeRules.filter((rule) => rule.is_context_bridge)
  const faqRules = safeRules.filter((rule) => !rule.is_drop_rule && !rule.is_context_bridge)

  return (
    <AdminPage>
      <AdminPageHeader
        title="Global Rules"
        description={
          <>
            Platform-wide rules that apply to <strong>all tenants</strong>. Changes take effect immediately.
          </>
        }
        actions={
          <>
            <Button onClick={() => mutate()} variant="outline">
              <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
              Refresh
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="size-4" />
              New Global Rule
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <AdminStatCard icon={BookOpen} label="FAQ Rules" value={faqRules.length} tone="warning" />
        <AdminStatCard icon={VolumeX} label="Silent Drop Rules" value={dropRules.length} tone="destructive" />
        <AdminStatCard icon={GitBranch} label="Context Bridge Rules" value={bridgeRules.length} tone="primary" />
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[560px]">
          <form onSubmit={handleCreate} className="space-y-5">
            <DialogHeader>
              <DialogTitle>New Global Rule</DialogTitle>
              <DialogDescription>
                Add a platform rule that applies across every tenant.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">Rule Type</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["faq", "drop", "bridge"] as RuleType[]).map((type) => {
                  const meta = RULE_META[type]
                  const Icon = meta.icon

                  return (
                    <Button
                      key={type}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, ruleType: type }))}
                      variant="outline"
                      className={form.ruleType === type ? "border-primary/40 bg-primary/10 text-primary" : ""}
                    >
                      <Icon className="size-4" />
                      {meta.label}
                    </Button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">{RULE_META[form.ruleType].description}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground">
                Keywords (comma-separated)*
              </label>
              <Textarea
                value={form.keywords}
                onChange={(event) => setForm((current) => ({ ...current, keywords: event.target.value }))}
                required
                rows={2}
                placeholder='e.g. "ok,okay,k,fine"'
              />
            </div>

            {form.ruleType === "faq" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-muted-foreground">English Response*</label>
                  <Textarea
                    value={form.response}
                    onChange={(event) => setForm((current) => ({ ...current, response: event.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-muted-foreground">Sinhala Response (optional)</label>
                  <Textarea
                    value={form.sinhala_response}
                    onChange={(event) => setForm((current) => ({ ...current, sinhala_response: event.target.value }))}
                    rows={2}
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="size-4 animate-spin" />}
                Create Rule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AdminSectionCard contentClassName="p-0">
        {isLoading ? (
          <div className="flex justify-center p-12 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-12 text-center text-destructive">Failed to load rules</div>
        ) : safeRules.length === 0 ? (
          <AdminEmptyState
            icon={BookOpen}
            title="No global rules yet."
            description="Create your first global rule above."
          />
        ) : (
          <div className="divide-y divide-border">
            {safeRules.map((rule) => {
              const type = getRuleType(rule)

              return (
                <div key={rule.ID} className="flex items-center gap-3 px-4 py-3">
                  <AdminIconFrame icon={RULE_META[type].icon} tone={RULE_META[type].tone} className="size-9 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      <RuleBadge type={type} />
                      <code className="truncate font-mono text-xs text-muted-foreground">{rule.keywords}</code>
                    </div>
                    {!rule.is_drop_rule && !rule.is_context_bridge && rule.response && (
                      <p className="truncate text-sm text-muted-foreground">{rule.response}</p>
                    )}
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {rule.usage_count} hits
                  </span>
                  <Button
                    onClick={() => handleDelete(rule.ID)}
                    size="icon-sm"
                    variant="destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </AdminSectionCard>
    </AdminPage>
  )
}
