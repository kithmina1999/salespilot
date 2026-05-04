import useSWR from 'swr';

export interface NotificationSummary {
  total_unread: number;
  unread_threads: number;
  latest: {
    message_id: number;
    phone: string;
    preview: string;
    customer_name: string;
  } | null;
}

const fetcher = async (url: string) => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No token');
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export function useNotificationQuery() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  
  return useSWR<NotificationSummary>(
    `${apiUrl}/api/v1/dashboard/notifications`,
    fetcher,
    {
      refreshInterval: 30000, // Poll every 30 seconds
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    }
  );
}
