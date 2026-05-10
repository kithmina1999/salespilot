"use client"

import { useState } from "react"
import {
  AlertTriangle,
  Bot,
  Globe,
  RefreshCw,
  Save,
  Server,
  Settings2,
  Zap,
  type LucideIcon,
} from "lucide-react"

import {
  AdminBadge,
  AdminCard,
  AdminIconFrame,
  AdminPage,
  AdminPageHeader,
  AdminSectionCard,
} from "@/components/admin/page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

type SettingField = {
  key: string
  label: string
  value: string | number | boolean
  type: "text" | "number" | "toggle" | "select"
  options?: string[]
}

type SettingGroup = {
  icon: LucideIcon
  title: string
  description: string
  fields: SettingField[]
}

const SETTING_GROUPS: SettingGroup[] = [
  {
    icon: Bot,
    title: "AI & Gemini Limits",
    description: "Control global AI usage caps across all tenants",
    fields: [
      { key: "free_ai_limit", label: "Free Plan AI Messages/Month", value: 50, type: "number" },
      { key: "starter_ai_limit", label: "Starter Plan AI Messages/Month", value: 200, type: "number" },
      { key: "pro_ai_limit", label: "Pro Plan AI Messages/Month", value: 1000, type: "number" },
    ],
  },
  {
    icon: Zap,
    title: "Trial & Onboarding",
    description: "Default trial settings for new signups",
    fields: [
      { key: "trial_days", label: "Default Trial Days", value: 14, type: "number" },
      { key: "trial_plan", label: "Trial Plan", value: "starter", type: "select", options: ["free", "starter", "pro"] },
      { key: "auto_downgrade", label: "Auto-downgrade after trial", value: true, type: "toggle" },
    ],
  },
  {
    icon: Server,
    title: "Platform Maintenance",
    description: "System-wide toggles and maintenance mode",
    fields: [
      { key: "maintenance_mode", label: "Maintenance Mode", value: false, type: "toggle" },
      { key: "new_signups_enabled", label: "Allow New Signups", value: true, type: "toggle" },
      { key: "max_plan", label: "Maximum Available Plan", value: "pro", type: "select", options: ["free", "starter", "pro"] },
    ],
  },
  {
    icon: Globe,
    title: "Platform Identity",
    description: "Branding and global meta settings",
    fields: [
      { key: "platform_name", label: "Platform Name", value: "SalesPilot", type: "text" },
      { key: "support_email", label: "Support Email", value: "admin@salespilot.ai", type: "text" },
      { key: "webhook_secret", label: "Webhook Secret (Hash)", value: "wh**************", type: "text" },
    ],
  },
]

export default function PlatformSettingsPage() {
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Platform Settings"
        description="Global platform configuration - changes affect all tenants"
        badge={<AdminBadge tone="warning">Placeholder</AdminBadge>}
        actions={
          <Button
            onClick={handleSave}
            variant={saved ? "outline" : "default"}
            className={saved ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" : ""}
          >
            {saved ? <RefreshCw className="size-4" /> : <Save className="size-4" />}
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        }
      />

      <AdminCard className="border-destructive/20 bg-destructive/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-bold text-destructive">Platform-Wide Impact</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Changes to these settings apply globally to all tenant accounts. Changes are logged in the audit trail.
            </p>
          </div>
        </div>
      </AdminCard>

      {SETTING_GROUPS.map((group) => (
        <AdminSectionCard
          key={group.title}
          title={group.title}
          description={group.description}
          icon={group.icon}
          contentClassName="flex flex-col gap-4"
        >
          {group.fields.map((field) => (
            <div
              key={field.key}
              className="flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-semibold text-foreground">{field.label}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{field.key}</p>
              </div>
              <FieldControl field={field} />
            </div>
          ))}
        </AdminSectionCard>
      ))}

      <AdminCard className="border-amber-500/20 bg-amber-500/10 p-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <AdminIconFrame icon={Settings2} tone="warning" className="size-9 rounded-lg" />
          <p>
            Placeholder configuration. Wire to <code className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-xs">/system/settings</code> to persist values to the database.
          </p>
        </div>
      </AdminCard>
    </AdminPage>
  )
}

function FieldControl({ field }: { field: SettingField }) {
  if (field.type === "toggle") {
    const enabled = Boolean(field.value)

    return (
      <div className="flex items-center gap-3">
        <span className={enabled ? "text-sm text-emerald-500" : "text-sm text-muted-foreground"}>
          {enabled ? "Enabled" : "Disabled"}
        </span>
        <Switch defaultChecked={enabled} />
      </div>
    )
  }

  if (field.type === "select") {
    return (
      <select
        defaultValue={field.value as string}
        className="h-9 w-[200px] rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
      >
        {field.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }

  return (
    <Input
      type={field.type}
      defaultValue={field.value as string | number}
      className="w-[200px] bg-background"
    />
  )
}
