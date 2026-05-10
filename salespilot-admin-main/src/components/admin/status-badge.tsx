import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StatusTone = "primary" | "success" | "warning" | "destructive" | "muted" | "info"

const statusToneClasses: Record<StatusTone, string> = {
  primary: "border-primary/25 bg-primary/10 text-primary",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-500",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/50 text-muted-foreground",
  info: "border-blue-500/25 bg-blue-500/10 text-blue-500",
}

function StatusBadge({
  children,
  tone = "muted",
  className,
}: React.ComponentProps<typeof Badge> & { tone?: StatusTone }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wider",
        statusToneClasses[tone],
        className
      )}
    >
      {children}
    </Badge>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const normalized = plan?.toLowerCase()
  const tone: StatusTone =
    normalized === "pro"
      ? "primary"
      : normalized === "starter" || normalized === "growth"
        ? "success"
        : "muted"

  return <StatusBadge tone={tone}>{plan || "Free"}</StatusBadge>
}

function BooleanBadge({
  active,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
}: {
  active: boolean
  activeLabel?: string
  inactiveLabel?: string
}) {
  return (
    <StatusBadge tone={active ? "success" : "muted"}>
      {active ? activeLabel : inactiveLabel}
    </StatusBadge>
  )
}

export { BooleanBadge, PlanBadge, StatusBadge, statusToneClasses, type StatusTone }
