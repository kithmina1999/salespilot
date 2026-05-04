import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useRef, MutableRefObject, ReactNode } from 'react';
import { toast } from 'sonner';
import { ChatSummary, Message, Customer, Order, MobileView } from '../types';
import { useChatAPI } from '@/hooks/useChatAPI';

interface CRMForm {
  name: string;
  address: string;
  notes: string;
  tags: string;
}

interface ChatContextValue {
  inbox: ChatSummary[];
  activePhone: string | null;
  messages: Message[];
  customer: Customer | null;
  orders: Order[];
  loadingChat: boolean;
  editingCRM: boolean;
  setEditingCRM: (val: boolean) => void;
  crmForm: CRMForm;
  setCrmForm: (val: CRMForm) => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  mobileView: MobileView;
  setMobileView: (val: MobileView) => void;
  replyText: string;
  setReplyText: (val: string) => void;
  sending: boolean;
  togglingBot: boolean;
  timeLeft: { m: number; s: number } | null;

  loadChat: (phone: string, showLoader?: boolean, scrollBottom?: boolean) => Promise<void>;
  saveCRM: () => Promise<void>;
  updateOrderStatus: (id: number, status: string) => Promise<void>;
  sendReply: () => Promise<void>;
  toggleBot: () => Promise<void>;

  messagesEndRef: MutableRefObject<HTMLDivElement | null>;
  replyInputRef: MutableRefObject<HTMLTextAreaElement | null>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const api = useChatAPI();

  const [inbox, setInbox] = useState<ChatSummary[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  const [loadingChat, setLoadingChat] = useState(false);
  const [editingCRM, setEditingCRM] = useState(false);
  const [crmForm, setCrmForm] = useState<CRMForm>({ name: '', address: '', notes: '', tags: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileView, setMobileView] = useState<MobileView>('inbox');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
  const [pendingFocus, setPendingFocus] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ m: number; s: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollPending = useRef<'auto' | 'smooth' | null>(null);

  // Polling inbox
  const loadInbox = async () => {
    try {
      const data = await api.fetchInbox();
      setInbox(data || []);
    } catch { /* silent */ }
  };

  useEffect(() => { loadInbox(); }, []);
  useEffect(() => { const t = setInterval(loadInbox, 15000); return () => clearInterval(t); }, []);

  // Polling chat
  useEffect(() => {
    if (!activePhone) return;
    const t = setInterval(() => loadChat(activePhone, false, false), 5000);
    return () => clearInterval(t);
  }, [activePhone]);

  // Scroll — fires synchronously after DOM mutation but before browser paint
  useLayoutEffect(() => {
    if (scrollPending.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: scrollPending.current });
      scrollPending.current = null;
    }
  }, [messages]);

  // Focus
  useEffect(() => {
    if (!sending && pendingFocus) {
      replyInputRef.current?.focus();
      setPendingFocus(false);
    }
  }, [sending, pendingFocus]);

  // Bot pause countdown
  useEffect(() => {
    if (!customer?.bot_paused || !customer?.bot_paused_until) { setTimeLeft(null); return; }
    let notified = false;
    const tick = () => {
      const diff = new Date(customer.bot_paused_until!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ m: 0, s: 0 });
        if (!notified) {
          notified = true;
          setTimeout(() => activePhone && loadChat(activePhone, false, false), 3000);
        }
      } else {
        setTimeLeft({ m: Math.floor(diff / 60000), s: Math.floor((diff % 60000) / 1000) });
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [customer?.bot_paused, customer?.bot_paused_until, activePhone]);

  // Actions
  const loadChat = async (phone: string, showLoader = true, scrollBottom = false) => {
    setActivePhone(phone);
    // Opening a chat natively anchors to bottom via CSS flex-col-reverse.
    // We only need to trigger a smooth scroll if explicitly requested (e.g. after sending a message).
    if (scrollBottom) scrollPending.current = 'smooth';
    if (showLoader) { setLoadingChat(true); setEditingCRM(false); }
    try {
      const d = await api.fetchChat(phone, showLoader);
      setMessages(d.messages || []);
      setOrders(d.orders || []);
      const c: Customer = d.customer;
    setCustomer(c?.id ? c : null);
      if (showLoader) {
        setCrmForm({ name: c?.name || '', address: c?.address || '', notes: c?.notes || '', tags: c?.tags || '' });
      }
    } catch {
      toast.error('Failed to load chat');
    } finally {
      if (showLoader) setLoadingChat(false);
    }
  };

  const saveCRM = async () => {
    if (!activePhone) return;
    try {
      const d = await api.saveCustomer(activePhone, crmForm);
      setCustomer(d.customer);
      setEditingCRM(false);
      toast.success('Profile saved');
      loadInbox();
    } catch {
      toast.error('Failed to save profile');
    }
  };

  const updateOrderStatus = async (id: number, status: string) => {
    try {
      await api.updateOrderStatus(id, status);
      toast.success(`Order → ${status}`);
      if (activePhone) loadChat(activePhone, false);
    } catch {
      toast.error('Failed to update order');
    }
  };

  const sendReply = async () => {
    if (!activePhone || !replyText.trim()) return;
    setSending(true);
    try {
      await api.sendMessage(activePhone, replyText.trim());
      setReplyText('');
      scrollPending.current = 'smooth';
      loadChat(activePhone, false, false);
      loadInbox();
      setPendingFocus(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const toggleBot = async () => {
    if (!activePhone) return;
    setTogglingBot(true);
    const currentlyPaused = customer?.bot_paused ?? false;
    try {
      const d = await api.toggleBotStatus(activePhone, !currentlyPaused);
      setCustomer(d.customer);
      loadInbox();
    } catch {
      toast.error('Failed to toggle bot');
    } finally {
      setTogglingBot(false);
    }
  };

  const value = {
    inbox, activePhone, messages, customer, orders,
    loadingChat, editingCRM, setEditingCRM, crmForm, setCrmForm,
    searchTerm, setSearchTerm, mobileView, setMobileView,
    replyText, setReplyText, sending, togglingBot, timeLeft,
    loadChat, saveCRM, updateOrderStatus, sendReply, toggleBot,
    messagesEndRef, replyInputRef
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
