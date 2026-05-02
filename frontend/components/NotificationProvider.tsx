'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NotifItem {
  id: number;           // message_id or notification.id from backend
  title: string;        // e.g. customer name / phone / order title
  preview: string;      // message snippet or notification body
  phone: string;        // for routing (empty for non-chat events)
  timestamp: number;    // Date.now()
  read: boolean;
  route: string;        // where to navigate on click
  type: 'chat' | 'new_order' | 'payment_proof'; // drives icon in bell
}

interface NotificationState {
  totalUnread: number;
  unreadThreads: number;
  notifications: NotifItem[];
  markAllRead: () => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const NotificationContext = createContext<NotificationState>({
  totalUnread: 0,
  unreadThreads: 0,
  notifications: [],
  markAllRead: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sp_notif_history';
const MAX_HISTORY = 30;

function loadHistory(): NotifItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(items: NotifItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {}
}

function formatPhone(p: string): string {
  if (!p) return 'Unknown';
  if (p.startsWith('94') && p.length === 11)
    return `+${p.slice(0, 2)} ${p.slice(2, 4)} ${p.slice(4, 7)} ${p.slice(7)}`;
  return `+${p}`;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [totalUnread,   setTotalUnread]   = useState(0);
  const [unreadThreads, setUnreadThreads] = useState(0);
  const [notifications, setNotifications] = useState<NotifItem[]>(() => loadHistory());

  const lastSeenIdRef = useRef<number>(
    loadHistory().length > 0 ? Math.max(...loadHistory().map(n => n.id)) : 0
  );

  // Count unread in local history
  const localUnread = notifications.filter(n => !n.read).length;

  function markAllRead() {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveHistory(updated);
      return updated;
    });
    // Mark event notifications as read on the backend (fire-and-forget)
    const token = localStorage.getItem('token');
    if (token) {
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/v1/dashboard/notifications/read`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      ).catch(() => {});
    }
  }

  const poll = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/v1/dashboard/notifications`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;

      const data: {
        total_unread: number;
        unread_threads: number;
        latest: { message_id: number; phone: string; preview: string; customer_name: string } | null;
        events: { id: number; type: string; title: string; body: string; ref_id: number; created_at: string }[] | null;
      } = await res.json();

      setTotalUnread(data.total_unread ?? 0);
      setUnreadThreads(data.unread_threads ?? 0);

      const latest = data.latest;

      const isViewingThatChat =
        pathname === '/dashboard/chats' &&
        typeof window !== 'undefined' &&
        (window as any).__activeChatPhone === latest?.phone;

      if (
        latest?.message_id &&
        latest.message_id > lastSeenIdRef.current &&
        !isViewingThatChat
      ) {
        lastSeenIdRef.current = latest.message_id;

        const senderLabel = latest.customer_name || formatPhone(latest.phone);
        const threadLabel =
          (data.unread_threads ?? 0) > 1
            ? `${data.unread_threads} new conversations · Latest from ${senderLabel}`
            : `💬 ${senderLabel}`;

        // Add to local notification history
        const newNotif: NotifItem = {
          id:        latest.message_id,
          title:     senderLabel,
          preview:   latest.preview?.slice(0, 100) || '',
          phone:     latest.phone,
          timestamp: Date.now(),
          read:      false,
          route:     '/dashboard/chats',
          type:      'chat',
        };

        setNotifications(prev => {
          if (prev.some(n => n.id === newNotif.id)) return prev;
          const updated = [newNotif, ...prev].slice(0, MAX_HISTORY);
          saveHistory(updated);
          return updated;
        });

        toast(threadLabel, {
          description: latest.preview?.slice(0, 80) || '',
          duration:    5000,
          action: {
            label:   'View',
            onClick: () => router.push('/dashboard/chats'),
          },
        });
      }

      // Merge event notifications (orders, payment proofs)
      const events = data.events ?? [];
      if (events.length > 0) {
        setNotifications(prev => {
          let updated = [...prev];
          let added = false;
          for (const ev of events) {
            const uid = ev.id + 1_000_000; // namespace collision with chat message IDs
            if (updated.some(n => n.id === uid)) continue;
            const item: NotifItem = {
              id:        uid,
              title:     ev.title,
              preview:   ev.body,
              phone:     '',
              timestamp: new Date(ev.created_at).getTime() || Date.now(),
              read:      false,
              route:     ev.type === 'payment_proof' ? '/dashboard/orders' : '/dashboard/orders',
              type:      ev.type as NotifItem['type'],
            };
            updated = [item, ...updated];
            added = true;
          }
          if (!added) return prev;
          updated = updated.slice(0, MAX_HISTORY);
          saveHistory(updated);
          return updated;
        });
      }
    } catch {
      // Silently ignore network errors
    }
  }, [pathname, router]);

  // Browser tab title
  useEffect(() => {
    document.title = localUnread > 0 ? `(${localUnread}) SalesPilot` : 'SalesPilot';
  }, [localUnread]);

  // Poll on mount then every 30s
  useEffect(() => {
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [poll]);

  return (
    <NotificationContext.Provider value={{ totalUnread, unreadThreads, notifications, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}
