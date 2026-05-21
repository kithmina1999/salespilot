import * as React from "react"
import { type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Tone = "default" | "primary" | "success" | "warning" | "destructive" | "muted" | "info"

const toneClasses: Record<Tone, string> = {
  default: "border-border bg-muted/40 text-muted-foreground",
  primary: "border-primary/25 bg-primary/10 text-primary",
  success: "border-emerald-500/25 bg-emerald-500/10 text-emerald-500",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  destructive: "border-destructive/25 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/40 text-muted-foreground",
  info: "border-blue-500/25 bg-blue-500/10 text-blue-500",
}

function AdminPage({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-6 animate-fade-up", className)}
      {...props}
    />
  )
}

function AdminPageHeader({
  title,
  description,
  badge,
  actions,
  icon: Icon,
}: {
  title: string
  description?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="flex min-h-12 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {Icon && <Icon className="size-5 text-primary" strokeWidth={2.2} />}
          <h1 className="text-[1.375rem] font-bold leading-8 text-foreground">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex min-h-9 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

function AdminBadge({
  children,
  tone = "primary",
  className,
}: React.ComponentProps<typeof Badge> & { tone?: Tone }) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-2.5 py-0.5 font-semibold", toneClasses[tone], className)}
    >
      {children}
    </Badge>
  )
}

function AdminCard({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn("border border-border/70 bg-card/90 shadow-sm", className)}
      {...props}
    />
  )
}

function AdminStatCard({
  icon: Icon,
  label,
  value,
  description,
  tone = "primary",
  className,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  description?: React.ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <AdminCard className={cn("transition-colors hover:border-border", className)}>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className={cn("flex size-8 items-center justify-center rounded-md border", toneClasses[tone])}>
            <Icon className="size-4" />
          </span>
        </div>
        <div>
          <p className="text-2xl font-bold leading-none text-foreground">
            {value}
          </p>
          {description && (
            <p className="mt-1.5 text-xs leading-4 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </AdminCard>
  )
}

function AdminSectionCard({
  title,
  description,
  action,
  icon: Icon,
  children,
  className,
  contentClassName,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
  contentClassName?: string
}) {
  const hasHeader = title || description || action

  return (
    <AdminCard className={cn("overflow-hidden", className)}>
      {hasHeader && (
        <CardHeader className="border-b border-border/60 px-5 py-4">
          <div className="flex min-h-9 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {title && (
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {Icon && <Icon className="size-4 text-primary" />}
                  {title}
                </CardTitle>
              )}
              {description && (
                <CardDescription className="mt-1 text-sm leading-5">
                  {description}
                </CardDescription>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn("p-5", contentClassName)}>{children}</CardContent>
    </AdminCard>
  )
}

function AdminIconFrame({
  icon: Icon,
  tone = "primary",
  className,
}: {
  icon: LucideIcon
  tone?: Tone
  className?: string
}) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md border", toneClasses[tone], className)}>
      <Icon className="size-4" />
    </span>
  )
}

function AdminEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-h-36 flex-col items-center justify-center p-8 text-center", className)}>
      <AdminIconFrame icon={Icon} tone="muted" className="mb-3 size-10" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

function AdminSkeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-muted/60", className)}
      {...props}
    />
  )
}

export {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminIconFrame,
  AdminPage,
  AdminPageHeader,
  AdminSectionCard,
  AdminSkeleton,
  AdminStatCard,
  toneClasses,
  type Tone,
}
