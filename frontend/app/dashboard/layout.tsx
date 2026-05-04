'use client';
import { useState } from 'react';
import { Menu, PanelLeft } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import ConnectionBanner from '@/components/ConnectionBanner';
import TrialBanner from '@/components/TrialBanner';
import TrialUpsellController from '@/components/TrialUpsellModal';
import DashboardGuard from '@/components/DashboardGuard';
import NotificationListener from '@/components/NotificationListener';
import { SidebarProvider, useSidebar } from '@/components/SidebarContext';

// Inner layout uses the context
function DashboardInner({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed } = useSidebar();

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Sidebar — handles desktop (collapsible) + mobile (drawer) */}
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* Main content — shifts width as sidebar collapses */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 transition-all duration-300">

        {/* ── Mobile Top Bar ── */}
        <header
          className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-zinc-800/70 shrink-0 bg-zinc-950"
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold text-zinc-200 tracking-tight">SalesPilot</span>
        </header>

        <TrialBanner />
        <ConnectionBanner />

        <main className="dashboard-shell flex-1 overflow-y-auto p-4 md:p-6 relative">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGuard>
      <NotificationListener />
      <SidebarProvider>
        <DashboardInner>{children}</DashboardInner>
        <TrialUpsellController />
      </SidebarProvider>
    </DashboardGuard>
  );
}
