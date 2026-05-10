"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import {
  BookOpen,
  Building2,
  ChevronRight,
  DollarSign,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings2,
  Shield,
} from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { RequireAuth } from "@/components/auth/require-auth"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "main" },
  { href: "/businesses", label: "Businesses", icon: Building2, section: "main" },
  { href: "/activation-codes", label: "Activation Codes", icon: KeyRound, section: "main" },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, section: "main" },
  { href: "/revenue", label: "Revenue", icon: DollarSign, section: "main" },
  { href: "/global-rules", label: "Global Rules", icon: BookOpen, section: "system" },
  { href: "/platform-settings", label: "Platform Settings", icon: Settings2, section: "system" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [showLogout, setShowLogout] = useState(false)
  const { logout, admin } = useAuth()

  async function handleLogout() {
    try {
      await api.post("/system/auth/logout")
    } catch {
      // Logout should still clear local auth when the network request fails.
    }
    logout()
    router.push("/")
  }

  const mainNav = navItems.filter((item) => item.section === "main")
  const systemNav = navItems.filter((item) => item.section === "system")

  function NavLink({ href, label, icon: Icon }: (typeof navItems)[0]) {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href))

    return (
      <SidebarMenuButton isActive={active} render={<Link href={href} />}>
        <Icon className="size-4 shrink-0 text-current transition-colors" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {active && <ChevronRight className="size-3.5 text-primary/80" />}
      </SidebarMenuButton>
    )
  }

  return (
    <RequireAuth>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              SA
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {admin?.name || "Super Admin"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {admin?.email || "admin@salespilot.lk"}
              </p>
            </div>
            <ThemeToggle />
          </SidebarHeader>

          <SidebarContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <NavLink {...item} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>

            <SidebarSeparator />

            <SidebarMenu>
              {systemNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <NavLink {...item} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter>
            <div className="flex min-h-10 items-center gap-2 rounded-md border border-primary/15 bg-primary/10 px-2.5 py-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Shield className="size-3.5" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight text-foreground">Super Admin</div>
                <div className="text-[0.68rem] leading-tight text-muted-foreground">Full access</div>
              </div>
            </div>

            <Button
              onClick={() => setShowLogout(true)}
              variant="ghost"
              className="justify-start text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset>
          <div className="mx-auto min-h-full w-full max-w-[1440px] px-6 py-7 sm:px-8 lg:px-10">
            {children}
          </div>
        </SidebarInset>

        <Dialog open={showLogout} onOpenChange={setShowLogout}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <div className="mb-1 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
                  <LogOut className="size-5" />
                </span>
                <DialogTitle>Sign Out</DialogTitle>
              </div>
              <DialogDescription>
                Are you sure you want to sign out of the super admin panel?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button onClick={handleLogout} variant="destructive">
                Sign Out
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarProvider>
    </RequireAuth>
  )
}
