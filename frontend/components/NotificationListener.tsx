'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { useNotificationQuery } from '@/hooks/useNotificationQuery';
import { useNotificationStore } from '@/hooks/useNotificationStore';

function formatPhone(p: string): string {
  if (!p) return 'Unknown';
  if (p.startsWith('94') && p.length === 11)
    return `+${p.slice(0, 2)} ${p.slice(2, 4)} ${p.slice(4, 7)} ${p.slice(7)}`;
  return `+${p}`;
}

export default function NotificationListener() {
  const router = useRouter();
  const pathname = usePathname();
  const { data } = useNotificationQuery();
  const { lastSeenMessageId, addNotification } = useNotificationStore();

  useEffect(() => {
    if (!data?.latest) return;
    const latest = data.latest;

    const isViewingThatChat =
      pathname === '/dashboard/chats' &&
      typeof window !== 'undefined' &&
      (window as any).__activeChatPhone === latest.phone;

    if (latest.message_id > lastSeenMessageId && !isViewingThatChat) {
      const senderLabel = latest.customer_name || formatPhone(latest.phone);
      const threadLabel =
        data.unread_threads > 1
          ? `${data.unread_threads} new conversations · Latest from ${senderLabel}`
          : `💬 ${senderLabel}`;

      addNotification({
        id: latest.message_id,
        title: senderLabel,
        preview: latest.preview?.slice(0, 100) || '',
        phone: latest.phone,
        timestamp: Date.now(),
        read: false,
        route: '/dashboard/chats',
      });

      toast(threadLabel, {
        description: latest.preview?.slice(0, 80) || '',
        duration: 5000,
        action: {
          label: 'View',
          onClick: () => router.push('/dashboard/chats'),
        },
      });
    }
  }, [data, lastSeenMessageId, pathname, router, addNotification]);

  // Update browser tab title based on actual unread count from the server
  useEffect(() => {
    if (data && data.total_unread > 0) {
      document.title = `(${data.total_unread}) SalesPilot`;
    } else {
      document.title = 'SalesPilot';
    }
  }, [data?.total_unread]);

  return null; // Invisible component
}
