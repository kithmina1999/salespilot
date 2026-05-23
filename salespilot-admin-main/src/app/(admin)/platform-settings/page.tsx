"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import {
  AlertTriangle,
  Banknote,
  Loader2,
  Lock,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react"

import {
  AdminBadge,
  AdminCard,
  AdminPage,
  AdminPageHeader,
  AdminSectionCard,
  AdminSkeleton,
} from "@/components/admin/page"
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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { AddonsManager } from "./AddonsManager"

type BankSettings = {
  bank_name: string
  bank_branch: string
  bank_account_no: string
  bank_account_name: string
  support_phone: string
  trial_days: number
  trial_plan_key: string
}

type PlanSettings = {
  key: string
  display_name: string
  badge: string
  description: string
  currency: string
  monthly_price: number
  annual_price: number
  is_active: boolean
  is_public: boolean
  sort_order: number
  max_products: number
  max_rules: number
  max_ai_messages: number
  max_system_messages: number
  max_rule_gens: number
  max_simulations: number
  max_storage_bytes: number
  max_file_size_bytes: number
  can_upload_cloudinary: boolean
  can_send_whatsapp_images: boolean
  can_use_gemini_vision: boolean
}

type BillingSettingsResponse = {
  bank: BankSettings
  plans: PlanSettings[]
  confirmation_phrase: string
}

type NumericPlanField =
  | "monthly_price"
  | "annual_price"
  | "sort_order"
  | "max_products"
  | "max_rules"
  | "max_ai_messages"
  | "max_system_messages"
  | "max_rule_gens"
  | "max_simulations"
  | "max_storage_bytes"
  | "max_file_size_bytes"

const fetcher = (url: string) => api.get<BillingSettingsResponse>(url).then((r) => r.data)

const numberFields: Array<{ key: NumericPlanField; label: string; hint?: string }> = [
  { key: "monthly_price", label: "Monthly price" },
  { key: "annual_price", label: "Annual price" },
  { key: "max_products", label: "Products", hint: "-1 = unlimited" },
  { key: "max_rules", label: "FAQ rules", hint: "-1 = unlimited" },
  { key: "max_ai_messages", label: "AI replies", hint: "-1 = unlimited" },
  { key: "max_system_messages", label: "Inbound messages", hint: "-1 = unlimited" },
  { key: "max_rule_gens", label: "AI rule generations", hint: "-1 = unlimited" },
  { key: "max_simulations", label: "Simulations", hint: "-1 = unlimited" },
  { key: "max_storage_bytes", label: "Storage bytes" },
  { key: "max_file_size_bytes", label: "Max file size bytes" },
]

function cloneSettings(data: BillingSettingsResponse): BillingSettingsResponse {
  return {
    bank: { ...data.bank },
    plans: data.plans.map((plan) => ({ ...plan })),
    confirmation_phrase: data.confirmation_phrase,
  }
}

function normalize(value: BillingSettingsResponse | null) {
  if (!value) return ""
  return JSON.stringify({
    bank: value.bank,
    plans: [...value.plans].sort((a, b) => a.key.localeCompare(b.key)),
  })
}

function getApiErrorMessage(err: any) {
  const message = err?.response?.data?.error
  return typeof message === "string" ? message : err instanceof Error ? err.message : "Request failed"
}

export default function PlatformSettingsPage() {
  const { admin } = useAuth()
  const isOwner = admin?.role === "owner"
  const { data, isLoading, mutate } = useSWR("/system/settings/billing", fetcher, {
    revalidateOnFocus: false,
  })
  const [draft, setDraft] = useState<BillingSettingsResponse | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [confirm, setConfirm] = useState("")
  const [accountConfirm, setAccountConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const form = draft ?? data ?? null
  const changed = useMemo(() => normalize(data ?? null) !== normalize(form), [data, form])
  const accountChanged = Boolean(data && form && data.bank.bank_account_no.trim() !== form.bank.bank_account_no.trim())
  const confirmPhrase = data?.confirmation_phrase ?? "UPDATE BILLING SETTINGS"
  const canSubmit =
    isOwner &&
    changed &&
    reason.trim().length > 0 &&
    confirm.trim() === confirmPhrase &&
    (!accountChanged || accountConfirm.trim() === form?.bank.bank_account_no.trim())

  function ensureDraft() {
    if (draft) return draft
    if (!data) return null
    const next = cloneSettings(data)
    setDraft(next)
    return next
  }

  function updateBank<K extends keyof BankSettings>(key: K, value: BankSettings[K]) {
    const next = ensureDraft()
    if (!next) return
    setDraft({ ...next, bank: { ...next.bank, [key]: value } })
  }

  function updatePlan<K extends keyof PlanSettings>(index: number, key: K, value: PlanSettings[K]) {
    const next = ensureDraft()
    if (!next) return
    const plans = next.plans.map((plan, i) => (i === index ? { ...plan, [key]: value } : plan))
    setDraft({ ...next, plans })
  }

  async function save() {
    if (!form || !canSubmit) return
    setSaving(true)
    setMessage("")
    try {
      await api.put("/system/settings/billing", {
        bank: form.bank,
        plans: form.plans,
        reason: reason.trim(),
        confirm: confirm.trim(),
        account_confirm: accountConfirm.trim(),
      })
      await mutate()
      setDraft(null)
      setDialogOpen(false)
      setReason("")
      setConfirm("")
      setAccountConfirm("")
      setMessage("Billing settings saved.")
    } catch (err) {
      setMessage(`Error: ${getApiErrorMessage(err)}`)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !form) {
    return (
      <AdminPage>
        <AdminPageHeader title="Platform Settings" description="Global billing and plan configuration" />
        <AdminSkeleton className="h-32" />
        <AdminSkeleton className="h-96" />
      </AdminPage>
    )
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Platform Settings"
        description="Bank details, subscription prices, and plan entitlements used by tenant billing flows."
        badge={<AdminBadge tone="warning">High risk</AdminBadge>}
        actions={
          <Button disabled={!changed || !isOwner} onClick={() => setDialogOpen(true)}>
            <Save className="size-4" />
            Save Changes
          </Button>
        }
      />

      {!isOwner && (
        <AdminCard className="border-border bg-muted/40 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" />
            Owner permissions are required to edit billing settings.
          </div>
        </AdminCard>
      )}

      <AdminCard className="border-destructive/20 bg-destructive/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-bold text-destructive">Revenue-impacting settings</p>
            <p className="mt-1 text-sm text-muted-foreground">
              These values are read by tenant billing screens and backend payment validation. Every save is audited.
            </p>
          </div>
        </div>
      </AdminCard>

      <AdminSectionCard
        title="Bank & Trial"
        description="Tenant bank-transfer instructions and trial duration."
        icon={Banknote}
        contentClassName="grid gap-4 md:grid-cols-2"
      >
        <Field label="Bank name" value={form.bank.bank_name} disabled={!isOwner} onChange={(v) => updateBank("bank_name", v)} />
        <Field label="Branch" value={form.bank.bank_branch} disabled={!isOwner} onChange={(v) => updateBank("bank_branch", v)} />
        <Field label="Account number" value={form.bank.bank_account_no} disabled={!isOwner} onChange={(v) => updateBank("bank_account_no", v)} />
        <Field label="Account name" value={form.bank.bank_account_name} disabled={!isOwner} onChange={(v) => updateBank("bank_account_name", v)} />
        <Field label="Support phone" value={form.bank.support_phone} disabled={!isOwner} onChange={(v) => updateBank("support_phone", v)} />
        <Field
          label="Trial days"
          type="number"
          value={String(form.bank.trial_days)}
          disabled={!isOwner}
          onChange={(v) => updateBank("trial_days", Number(v))}
        />
      </AdminSectionCard>

      <AdminSectionCard
        title="Plans & Entitlements"
        description="Prices and limits used by billing, usage cards, and plan comparison."
        icon={Sparkles}
        contentClassName="grid gap-4"
      >
        {form.plans.map((plan, index) => (
          <AdminCard key={plan.key} className="p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-foreground">{plan.key}</p>
                <p className="text-xs text-muted-foreground">-1 means unlimited for limit fields.</p>
              </div>
              <div className="flex flex-wrap gap-4">
                <Toggle label="Active" checked={plan.is_active} disabled={!isOwner} onChange={(v) => updatePlan(index, "is_active", v)} />
                <Toggle label="Public" checked={plan.is_public} disabled={!isOwner} onChange={(v) => updatePlan(index, "is_public", v)} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Display name" value={plan.display_name} disabled={!isOwner} onChange={(v) => updatePlan(index, "display_name", v)} />
              <Field label="Badge" value={plan.badge ?? ""} disabled={!isOwner} onChange={(v) => updatePlan(index, "badge", v)} />
              <Field
                label="Sort order"
                type="number"
                value={String(plan.sort_order)}
                disabled={!isOwner}
                onChange={(v) => updatePlan(index, "sort_order", Number(v))}
              />
            </div>

            <div className="mt-3">
              <Label className="text-xs font-semibold text-muted-foreground">Description</Label>
              <Textarea
                value={plan.description ?? ""}
                disabled={!isOwner}
                onChange={(e) => updatePlan(index, "description", e.target.value)}
                className="mt-1 min-h-16 bg-background"
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {numberFields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground">{field.label}</Label>
                  <Input
                    type="number"
                    disabled={!isOwner}
                    value={String(plan[field.key] ?? 0)}
                    onChange={(e) => updatePlan(index, field.key, Number(e.target.value))}
                    className="bg-background"
                  />
                  {field.hint && <p className="text-[0.7rem] text-muted-foreground">{field.hint}</p>}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-5">
              <Toggle label="Product image uploads" checked={plan.can_upload_cloudinary} disabled={!isOwner} onChange={(v) => updatePlan(index, "can_upload_cloudinary", v)} />
              <Toggle label="WhatsApp image replies" checked={plan.can_send_whatsapp_images} disabled={!isOwner} onChange={(v) => updatePlan(index, "can_send_whatsapp_images", v)} />
              <Toggle label="Gemini Vision" checked={plan.can_use_gemini_vision} disabled={!isOwner} onChange={(v) => updatePlan(index, "can_use_gemini_vision", v)} />
            </div>
          </AdminCard>
        ))}
      </AdminSectionCard>

      <AddonsManager />

      {message && (
        <p className={message.startsWith("Error") ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-emerald-500"}>
          {message}
        </p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-4" />
              Confirm billing settings update
            </DialogTitle>
            <DialogDescription>
              These changes affect what tenants pay and where they send bank transfers.
            </DialogDescription>
          </DialogHeader>

          {accountChanged && (
            <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
              Bank account number is changing. Re-enter the new account number before saving.
            </div>
          )}

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Reason</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. New company bank account approved by finance" />
            </div>
            <div className="grid gap-1.5">
              <Label>Type {confirmPhrase}</Label>
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {accountChanged && (
              <div className="grid gap-1.5">
                <Label>New account number</Label>
                <Input value={accountConfirm} onChange={(e) => setAccountConfirm(e.target.value)} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={save} disabled={!canSubmit || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
              Save Billing Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  )
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = "text",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  type?: string
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <Input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="bg-background" />
    </div>
  )
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
      {label}
    </label>
  )
}
