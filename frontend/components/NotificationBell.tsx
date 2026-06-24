'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/hooks/_shared';
import { Bell, MessageSquare, X, CheckCheck } from 'lucide-react';
import { useNotificationStore, type NotifItem } from '@/hooks/useNotificationStore';
import { useNotificationQuery } from '@/hooks/useNotificationQuery';

// ── Time formatter ─────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface NotificationBellProps {
  collapsed: boolean;
  mobile?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NotificationBell({ collapsed, mobile = false }: NotificationBellProps) {
  const router = useRouter();
  const { notifications, clearAll, removeNotification } = useNotificationStore();
  const { data, mutate } = useNotificationQuery();
  const [open, setOpen]       = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef           = useRef<HTMLDivElement>(null);
  const panelRef               = useRef<HTMLDivElement>(null);

  // SSR safety — portals need the DOM to exist
  useEffect(() => { setMounted(true); }, []);

  const unreadCount = data?.total_unread || 0;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return ()  => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function handleOpen() {
    setOpen(o => !o);
  }

  function handleNotifClick(notif: NotifItem) {
    // Remove specific notification from local dropdown
    removeNotification(notif.id);
    setOpen(false);
    router.push(notif.route);
  }

  async function handleMarkAll(e: React.MouseEvent) {
    e.stopPropagation();
    clearAll();
    
    try {
      await fetch(`${API_URL}/api/v1/dashboard/notifications/mark-read`, {
        method: 'POST',
        credentials: 'include',
      });
      mutate();
    } catch (err) {}
  }

  return (
    <>
      {/* ── Bell button (stays inside sidebar DOM) ── */}
      <div ref={containerRef} className="relative">
        <button
          onClick={handleOpen}
          title={collapsed && !mobile ? 'Notifications' : undefined}
          className={`group relative w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm transition-all duration-150 ${
            open
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          {/* Bell icon with badge */}
          <div className="relative shrink-0">
            <Bell size={16} className={open ? 'text-emerald-400' : ''} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-black text-[8px] font-black min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5 leading-none shadow-lg shadow-emerald-500/30 animate-in zoom-in duration-200">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          {/* Label */}
          {(!collapsed || mobile) && (
            <span className="truncate">Notifications</span>
          )}

          {/* Collapsed tooltip */}
          {collapsed && !mobile && (
            <span className="pointer-events-none absolute left-full ml-3 px-2 py-1 rounded-md bg-secondary border border-border text-xs text-foreground font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50">
              Notifications
            </span>
          )}
        </button>
      </div>

      {/* ── Portal: overlay + panel rendered at document.body ── */}
      {mounted && open && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150"
            style={{ zIndex: 9998 }}
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Panel */}
          <div
            ref={panelRef}
            className="fixed bottom-20 w-80 animate-in slide-in-from-bottom-2 fade-in duration-200"
            style={{
              zIndex: 9999,
              left: mobile ? '16px' : collapsed ? '68px' : '232px',
            }}
          >
            <div className="bg-background border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/80">
                <div className="flex items-center gap-2">
                  <Bell size={14} className="text-emerald-400" />
                  <span className="text-sm font-bold text-foreground">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAll}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-emerald-400 transition-colors px-2 py-1 rounded-lg hover:bg-accent font-bold"
                      title="Mark all as read"
                    >
                      <CheckCheck size={12} />
                      All read
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Notification list */}
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center">
                      <Bell size={20} className="text-zinc-600" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">No notifications yet</p>
                    <p className="text-xs text-zinc-600 text-center px-6">
                      You'll be notified when customers need manual attention.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/50">
                    {notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/80 transition-colors flex items-start gap-3 group bg-emerald-500/4`}
                      >
                        {/* Icon */}
                        <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-400`}>
                          <MessageSquare size={13} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-bold truncate text-foreground`}>
                              {notif.title}
                            </p>
                            <span className="text-[10px] text-zinc-600 shrink-0">
                              {timeAgo(notif.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                            {notif.preview}
                          </p>
                          <p className="text-[10px] text-emerald-500/70 mt-1 font-medium group-hover:text-emerald-400 transition-colors">
                            View in Chats →
                          </p>
                        </div>

                        {/* Unread dot */}
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-2 shadow-sm shadow-emerald-500/50" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="border-t border-border/80 px-4 py-2.5">
                  <button
                    onClick={() => { setOpen(false); router.push('/dashboard/chats'); }}
                    className="w-full text-center text-xs text-muted-foreground hover:text-emerald-400 transition-colors font-bold py-0.5"
                  >
                    Go to Chat Logs
                  </button>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
