"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function SidebarProvider({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-wrapper"
      className={cn("flex min-h-screen w-full bg-background text-foreground", className)}
      {...props}
    />
  )
}

function Sidebar({ className, ...props }: React.ComponentProps<"aside">) {
  return (
    <aside
      data-slot="sidebar"
      className={cn(
        "sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-4 py-4 text-sidebar-foreground",
        className
      )}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("mb-6 flex h-10 items-center gap-2.5 px-1", className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("flex min-h-0 flex-1 flex-col gap-1", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("flex flex-col gap-2 border-t border-sidebar-border pt-3", className)}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn("px-2 py-1 text-xs font-semibold text-sidebar-foreground/60", className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("list-none", className)}
      {...props}
    />
  )
}

function SidebarMenuButton({
  className,
  children,
  isActive,
  render,
  ...props
}: React.ComponentProps<"button"> & {
  isActive?: boolean
  render?: React.ReactElement<{ className?: string; "data-active"?: boolean }>
}) {
  const classes = cn(
    "group flex h-9 w-full items-center gap-2.5 rounded-md border border-transparent px-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:border-primary/20 data-[active=true]:bg-primary/10 data-[active=true]:font-semibold data-[active=true]:text-foreground",
    className
  )

  if (render) {
    return React.cloneElement(render, {
      className: cn(classes, render.props.className),
      "data-active": isActive,
    }, children)
  }

  return (
    <button
      data-slot="sidebar-menu-button"
      data-active={isActive}
      className={classes}
      {...props}
    >
      {children}
    </button>
  )
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-separator"
      className={cn("my-3 h-px bg-sidebar-border", className)}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("h-screen flex-1 overflow-y-auto bg-background", className)}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
}
