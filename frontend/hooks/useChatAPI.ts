import { useCallback } from 'react';
import { API_URL } from '../app/dashboard/chats/utils';

export function useChatAPI() {
  const fetchInbox = useCallback(async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/chats`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to fetch inbox');
    return res.json();
  }, []);

  const fetchChat = useCallback(async (phone: string, markRead: boolean = true) => {
    const token = localStorage.getItem('token');
    const qs = markRead ? '?mark_read=true' : '';
    const res = await fetch(`${API_URL}/api/v1/chats/${phone}${qs}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to load chat');
    return res.json();
  }, []);

  const saveCustomer = useCallback(async (phone: string, data: any) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/customers/${phone}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save profile');
    return res.json();
  }, []);

  const updateOrderStatus = useCallback(async (id: number, status: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update order');
    return res.json(); // May be empty depending on backend, but ok for now
  }, []);

  const sendMessage = useCallback(async (phone: string, message: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/chats/${phone}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error || 'Failed to send');
    }
    return res.json();
  }, []);

  const toggleBotStatus = useCallback(async (phone: string, botPaused: boolean) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/api/v1/customers/${phone}/bot-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bot_paused: botPaused }),
    });
    if (!res.ok) throw new Error('Failed to toggle bot');
    return res.json();
  }, []);

  return {
    fetchInbox,
    fetchChat,
    saveCustomer,
    updateOrderStatus,
    sendMessage,
    toggleBotStatus,
  };
}
