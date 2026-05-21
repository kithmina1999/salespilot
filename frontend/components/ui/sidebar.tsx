'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type AsChildProps = {
  asChild?: boolean;
  children?: React.ReactNode;
  className?: string;
};

function renderAsChild(
  children: React.ReactNode,
  props: React.HTMLAttributes<HTMLElement>
) {
  if (React.isValidElement<{ className?: string }>(children)) {
    return React.cloneElement(children, {
      ...props,
      className: cn(props.className, children.props.className),
    });
  }

  return <span {...props}>{children}</span>;
}

function Sidebar({ className, ...props }: React.ComponentProps<'aside'>) {
  return (
    <aside
      data-slot="sidebar"
      className={cn('relative flex h-full flex-col bg-sidebar text-sidebar-foreground', className)}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn('flex min-h-14 shrink-0 items-center border-b border-sidebar-border', className)}
      {...props}
    />
  );
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden py-3', className)}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn('flex w-full min-w-0 flex-col gap-1 px-2', className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn('flex w-full min-w-0 flex-col gap-1', className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn('relative min-w-0', className)}
      {...props}
    />
  );
}

type SidebarMenuButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  AsChildProps & {
    isActive?: boolean;
    size?: 'default' | 'sm' | 'lg';
  };

const menuButtonSizes = {
  default: 'h-9 px-2.5 text-sm',
  sm: 'h-8 px-2 text-xs',
  lg: 'h-11 px-2.5 text-sm',
};

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  size = 'default',
  className,
  children,
  type = 'button',
  ...props
}: SidebarMenuButtonProps) {
  const buttonClassName = cn(
    'group/menu-button relative flex w-full min-w-0 items-center gap-2 rounded-md font-medium outline-none transition-colors',
    'focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    menuButtonSizes[size],
    isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
    className
  );

  const sharedProps = {
    ...props,
    'data-slot': 'sidebar-menu-button',
    'data-active': isActive,
    className: buttonClassName,
  };

  if (asChild) {
    return renderAsChild(children, sharedProps);
  }

  return (
    <button type={type} {...sharedProps}>
      {children}
    </button>
  );
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      className={cn(
        'mx-3.5 flex min-w-0 translate-x-px flex-col gap-0.5 border-l border-sidebar-border px-2 py-1 transition-colors',
        className
      )}
      {...props}
    />
  );
}

function SidebarMenuSubItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      className={cn('relative min-w-0', className)}
      {...props}
    />
  );
}

type SidebarMenuSubButtonProps = React.AnchorHTMLAttributes<HTMLAnchorElement> &
  AsChildProps & {
    isActive?: boolean;
  };

function SidebarMenuSubButton({
  asChild = false,
  isActive = false,
  className,
  children,
  ...props
}: SidebarMenuSubButtonProps) {
  const buttonClassName = cn(
    'group/menu-sub-button relative flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-sm outline-none transition-colors',
    'focus-visible:ring-2 focus-visible:ring-sidebar-ring',
    isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm ring-1 ring-sidebar-border/70'
      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
    className
  );

  const sharedProps = {
    ...props,
    'data-slot': 'sidebar-menu-sub-button',
    'data-active': isActive,
    className: buttonClassName,
  };

  if (asChild) {
    return renderAsChild(children, sharedProps);
  }

  return (
    <a {...sharedProps}>
      {children}
    </a>
  );
}

function SidebarRail({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      data-slot="sidebar-rail"
      className={cn('pointer-events-none absolute inset-y-0 right-0 w-px bg-sidebar-border', className)}
      {...props}
    />
  );
}

export {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
};
