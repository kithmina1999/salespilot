'use client';
import { useState, useEffect, useRef } from 'react';
import {
  UserCircle, ShoppingBag, MessageSquare, AlertCircle, CheckCircle2,
  Bot, Pencil, X, Check, Tag, Send, Loader2, ArrowLeft, Search,
  Wifi, WifiOff, Clock,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatSummary {
  phone: string;
  latest_message: string;
  message_time: string;
  status: string;
  customer_name: string;
  unmatched_count: number;
  unread_count: number;
}
interface Message {
  ID: number;
  role: string;       // 'user' | 'model' | 'merchant' | 'system'
  content: string;
  is_unmatched: boolean;
  CreatedAt: string;
}
interface Customer {
  id: number;
  phone: string;
  name: string;
  address: string;
  notes: string;
  tags: string;
  bot_paused: boolean;
  bot_paused_until: string | null;
}
interface Order {
  ID: number;
  status: string;
  total_price: number;
  items: string;
  CreatedAt: string;
}
type MobileView = 'inbox' | 'chat' | 'crm';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_ORDER = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const STATUS_STYLE: Record<string, string> = {
  new:       'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  confirmed: 'text-blue-400  border-blue-400/30  bg-blue-400/10',
  shipped:   'text-purple-400 border-purple-400/30 bg-purple-400/10',
  delivered: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
  cancelled: 'text-red-400   border-red-400/30   bg-red-400/10',
};
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// ── Helpers ───────────────────────────────────────────────────────────────────
const isLID = (p = '') => { const d = p.split('@')[0].split(':')[0].replace(/\D/g, ''); return d.length >= 13; };
const formatPhone = (p = '') => {
  if (!p) return 'Unknown';
  if (isLID(p)) return 'Privacy Contact';
  const d = p.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (!d) return p;
  if (d.startsWith('94') && d.length === 11) return `+94 ${d.slice(2,4)} ${d.slice(4,7)} ${d.slice(7)}`;
  if (d.startsWith('94') && d.length === 12) return `+94 ${d.slice(2,5)} ${d.slice(5,8)} ${d.slice(8)}`;
  if (d.startsWith('1')  && d.length === 11) return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  if (d.length >= 7) return `+${d}`;
  return p;
};
const displayName = (name?: string, phone?: string) => {
  const n = name?.trim();
  if (n) return n;
  if (phone && isLID(phone)) return 'WhatsApp Contact';
  return phone ? formatPhone(phone) : 'Customer';
};
const fmtTime = (s: string) => new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDate = (s: string) => new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric' });
const parseItems = (j: string) => { try { return JSON.parse(j); } catch { return []; } };
const initials = (name?: string, phone?: string) => {
  const n = name?.trim();
  if (n) return n.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  return '??';
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChatsPage() {
  const [inbox,       setInbox]       = useState<ChatSummary[]>([]);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [customer,    setCustomer]    = useState<Customer | null>(null);
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [editingCRM,  setEditingCRM]  = useState(false);
  const [crmForm,     setCrmForm]     = useState({ name: '', address: '', notes: '', tags: '' });
  const [searchTerm,  setSearchTerm]  = useState('');
  const [mobileView,  setMobileView]  = useState<MobileView>('inbox');
  const [replyText,   setReplyText]   = useState('');
  const [sending,     setSending]     = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
  const [pendingFocus,setPendingFocus]= useState(false);
  const [timeLeft,    setTimeLeft]    = useState<{ m: number; s: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyInputRef  = useRef<HTMLTextAreaElement>(null);
  const scrollPending  = useRef(false);

  // ── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => { fetchInbox(); }, []);
  useEffect(() => { const t = setInterval(fetchInbox, 15000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!activePhone) return;
    const t = setInterval(() => loadChat(activePhone, false), 5000);
    return () => clearInterval(t);
  }, [activePhone]);

  // ── Scroll ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (scrollPending.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      scrollPending.current = false;
    }
  }, [messages]);

  // ── Focus reply input ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sending && pendingFocus) {
      replyInputRef.current?.focus();
      setPendingFocus(false);
    }
  }, [sending, pendingFocus]);

  // ── Bot pause countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (!customer?.bot_paused || !customer?.bot_paused_until) { setTimeLeft(null); return; }
    let expired = false;
    const tick = () => {
      const diff = new Date(customer.bot_paused_until!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ m: 0, s: 0 });
        if (!expired) { expired = true; setTimeout(() => activePhone && loadChat(activePhone, false), 2000); }
      } else {
        setTimeLeft({ m: Math.floor(diff / 60000), s: Math.floor((diff % 60000) / 1000) });
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [customer?.bot_paused, customer?.bot_paused_until]);

  // ── API calls ──────────────────────────────────────────────────────────────
  async function fetchInbox() {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/chats`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setInbox((await res.json()) || []);
    } catch { /* silent */ }
  }

  async function loadChat(phone: string, showLoader = true, scrollBottom = false) {
    setActivePhone(phone);
    if (scrollBottom) scrollPending.current = true;
    if (showLoader) { setLoadingChat(true); setEditingCRM(false); }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/chats/${phone}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setMessages(d.messages || []);
        setOrders(d.orders || []);
        const c: Customer = d.customer;
        setCustomer(c?.id ? c : null);
        setCrmForm({ name: c?.name || '', address: c?.address || '', notes: c?.notes || '', tags: c?.tags || '' });
      }
    } catch { toast.error('Failed to load chat'); }
    finally { if (showLoader) setLoadingChat(false); }
  }

  async function saveCRM() {
    if (!activePhone) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/customers/${activePhone}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(crmForm),
      });
      if (res.ok) { const d = await res.json(); setCustomer(d.customer); setEditingCRM(false); toast.success('Profile saved'); fetchInbox(); }
      else toast.error('Failed to save profile');
    } catch { toast.error('Network error'); }
  }

  async function updateOrderStatus(id: number, status: string) {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/v1/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      toast.success(`Order → ${status}`);
      if (activePhone) loadChat(activePhone, false);
    } catch { toast.error('Failed to update order'); }
  }

  async function sendReply() {
    if (!activePhone || !replyText.trim()) return;
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/chats/${activePhone}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      if (res.ok) {
        setReplyText('');
        loadChat(activePhone, false, true);
        fetchInbox();
        setPendingFocus(true);
      } else {
        const d = await res.json();
        toast.error(d.error || 'Failed to send');
      }
    } catch { toast.error('Network error'); }
    finally { setSending(false); }
  }

  async function toggleBot() {
    if (!activePhone || !customer) return;
    setTogglingBot(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/customers/${activePhone}/bot-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bot_paused: !customer.bot_paused }),
      });
      if (res.ok) { const d = await res.json(); setCustomer(d.customer); }
      else toast.error('Failed to toggle bot');
    } catch { toast.error('Network error'); }
    finally { setTogglingBot(false); }
  }

  const activeSummary = inbox.find(c => c.phone === activePhone);
  const filteredInbox = inbox.filter(c =>
    c.phone.includes(searchTerm) ||
    (c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const totalUnread = inbox.reduce((s, c) => s + (c.unread_count || 0), 0);
  const botActive = !!customer && !customer.bot_paused;

  // ── Inbox Panel ────────────────────────────────────────────────────────────
  const InboxPanel = (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800/60">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-emerald-400" />
            <span className="font-bold text-sm text-white">Conversations</span>
            {totalUnread > 0 && (
              <span className="text-[10px] font-black bg-red-500/90 text-white px-1.5 py-0.5 rounded-full leading-none">
                {totalUnread}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
            {inbox.length}
          </span>
        </div>
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            placeholder="Search name or number…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs outline-none focus:border-zinc-600 text-zinc-200 placeholder-zinc-500 transition-colors"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredInbox.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-zinc-600">
            <MessageSquare size={28} className="opacity-30" />
            <p className="text-xs">No conversations yet</p>
          </div>
        )}
        {filteredInbox.map(chat => {
          const active = chat.phone === activePhone;
          const hasUnread = chat.unread_count > 0;
          const name = displayName(chat.customer_name, chat.phone);
          return (
            <button
              key={chat.phone}
              onClick={() => { loadChat(chat.phone, true, true); setMobileView('chat'); }}
              className={`w-full text-left px-4 py-3 border-b border-zinc-800/40 transition-all relative ${
                active
                  ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500'
                  : 'hover:bg-zinc-900/60 border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${
                  active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {initials(chat.customer_name, chat.phone)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-sm truncate pr-2 ${hasUnread ? 'font-bold text-white' : 'text-zinc-300'}`}>
                      {name}
                    </span>
                    <span className={`text-[10px] shrink-0 ${hasUnread ? 'text-emerald-400 font-bold' : 'text-zinc-600'}`}>
                      {chat.message_time ? fmtTime(chat.message_time) : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs truncate pr-2 ${hasUnread ? 'text-zinc-300' : 'text-zinc-500'}`}>
                      {chat.latest_message || 'No messages'}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      {hasUnread  && (
                        <span className="text-[9px] font-black bg-emerald-500 text-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                          {chat.unread_count > 99 ? '99+' : chat.unread_count}
                        </span>
                      )}
                      {chat.unmatched_count > 0 && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Has unmatched messages" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ── Chat Panel ─────────────────────────────────────────────────────────────
  const ChatPanel = (
    <div className="flex flex-col h-full bg-zinc-950">
      {activePhone ? (
        <>
          {/* Top Bar */}
          <div className="h-14 shrink-0 px-4 flex items-center gap-3 border-b border-zinc-800/60 bg-zinc-900/40 backdrop-blur">
            <button
              onClick={() => setMobileView('inbox')}
              className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft size={17} />
            </button>
            {/* avatar */}
            <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-xs font-black text-emerald-400 shrink-0">
              {initials(activeSummary?.customer_name, activePhone ?? undefined)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {displayName(activeSummary?.customer_name, activePhone ?? undefined)}
              </p>
              <p className="text-[11px] text-zinc-500 truncate">{formatPhone(activePhone ?? undefined)}</p>
            </div>
            {/* Bot status chip */}
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${
              botActive
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}>
              {botActive ? <Wifi size={10} /> : <WifiOff size={10} />}
              {botActive ? 'Bot Active' : 'Bot Paused'}
            </div>
            <button
              onClick={() => setMobileView('crm')}
              className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <UserCircle size={17} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
            {loadingChat ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="animate-spin text-zinc-600" size={24} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col h-full items-center justify-center gap-2 text-zinc-600">
                <MessageSquare size={32} className="opacity-20" />
                <p className="text-sm">No messages yet</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isUser     = msg.role === 'user';
                const isMerchant = msg.role === 'merchant';
                const isBot      = msg.role === 'model';
                // Customer → RIGHT | Bot / Merchant → LEFT
                const isRight = isUser;

                if (msg.role === 'system') {
                  return (
                    <div key={i} className="flex justify-center my-2">
                      <span className="text-[10px] px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 font-medium">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={i} className={`flex items-end gap-2 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    {isBot && (
                      <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                        <Bot size={13} className="text-black" />
                      </div>
                    )}
                    {isMerchant && (
                      <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
                        <UserCircle size={14} className="text-black" />
                      </div>
                    )}
                    {isUser && (
                      <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-[9px] font-black text-zinc-300">
                        {initials(customer?.name, activePhone ?? undefined)}
                      </div>
                    )}

                    <div className={`max-w-[70%] flex flex-col gap-1 ${isRight ? 'items-end' : 'items-start'}`}>
                      {/* Sender label */}
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-0.5 ${
                        isBot ? 'text-emerald-500/60' : isMerchant ? 'text-amber-500/60' : 'text-zinc-500'
                      }`}>
                        {isBot ? 'AI Bot' : isMerchant ? 'You (Agent)' : displayName(customer?.name, activePhone ?? undefined)}
                      </span>

                      {/* Bubble */}
                      <div className={`relative px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isUser
                          ? 'bg-zinc-800 text-zinc-100 rounded-2xl rounded-br-sm border border-zinc-700/50'
                          : isMerchant
                          ? 'bg-amber-500/10 text-amber-50 border border-amber-500/20 rounded-2xl rounded-bl-sm'
                          : 'bg-emerald-500/8 text-emerald-50 border border-emerald-500/15 rounded-2xl rounded-bl-sm'
                      }`}>
                        {msg.content}
                        {isUser && msg.is_unmatched && (
                          <span className="absolute -top-1.5 -right-1.5">
                            <span className="flex h-3 w-3 rounded-full bg-red-500" title="Bot couldn't match this" />
                          </span>
                        )}
                      </div>

                      {/* Time */}
                      <span className="text-[10px] text-zinc-600 px-0.5">{fmtTime(msg.CreatedAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Bar */}
          <div className="shrink-0 border-t border-zinc-800/60 bg-zinc-900/40 p-3">
            {!customer?.bot_paused && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <WifiOff size={11} className="text-amber-400" />
                <p className="text-[10px] text-amber-400/80 font-medium">
                  Pause the AI bot from the customer profile to reply manually.
                </p>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={replyInputRef}
                rows={1}
                placeholder={customer?.bot_paused ? 'Type a reply…' : 'Bot is active — pause to reply'}
                value={replyText}
                onChange={e => { setReplyText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                disabled={!customer?.bot_paused || sending}
                className="flex-1 resize-none rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed leading-relaxed"
                style={{ minHeight: '42px' }}
              />
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || !customer?.bot_paused || sending}
                className="h-[42px] w-[42px] shrink-0 rounded-xl bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center text-black transition-all disabled:opacity-40 disabled:bg-zinc-800 disabled:text-zinc-500 active:scale-95"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col h-full items-center justify-center gap-3 text-zinc-600">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <MessageSquare size={28} className="opacity-30" />
          </div>
          <p className="text-sm font-medium">Select a conversation</p>
          <p className="text-xs text-zinc-700">Pick a chat from the inbox to start</p>
        </div>
      )}
    </div>
  );

  // ── CRM Panel ──────────────────────────────────────────────────────────────
  const CRMPanel = activePhone ? (
    <div className="flex flex-col h-full bg-zinc-950 border-l border-zinc-800/60">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between shrink-0 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileView('chat')} className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <ArrowLeft size={17} />
          </button>
          <span className="text-sm font-bold text-zinc-200">Customer Profile</span>
        </div>
        {!editingCRM ? (
          <button onClick={() => setEditingCRM(true)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <Pencil size={11} /> Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditingCRM(false)} className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 transition-colors">
              <X size={13} />
            </button>
            <button onClick={saveCRM} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors">
              <Check size={13} /> Save
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Bot Toggle */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Bot size={14} className={customer?.bot_paused ? 'text-zinc-500' : 'text-emerald-400'} />
                <span className="text-xs font-bold text-zinc-200">AI Auto-Reply</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed tabular-nums pl-0.5">
                {customer?.bot_paused
                  ? timeLeft
                    ? (timeLeft.m > 0 || timeLeft.s > 0 ? `Paused · resumes in ${timeLeft.m}m ${timeLeft.s}s` : 'Resuming…')
                    : 'Paused · manual control'
                  : 'Active · responding automatically'}
              </p>
            </div>
            <button
              onClick={toggleBot}
              disabled={togglingBot || !customer}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 outline-none ${
                customer?.bot_paused ? 'bg-zinc-700' : 'bg-emerald-500'
              } disabled:opacity-50`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                customer?.bot_paused ? 'translate-x-0' : 'translate-x-5'
              }`} />
            </button>
          </div>
        </section>

        {/* Identity */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/60">
            <UserCircle size={13} className="text-emerald-400" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Identity</span>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-semibold ml-0.5">Phone</label>
            <p className="text-xs font-mono mt-1 px-3 py-2 bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-300 select-all">
              {formatPhone(customer?.phone || activePhone || undefined)}
            </p>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-semibold ml-0.5">Name</label>
            {editingCRM
              ? <input value={crmForm.name} onChange={e => setCrmForm({...crmForm, name: e.target.value})} className="mt-1 w-full text-sm px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white outline-none focus:border-zinc-500 transition-colors" placeholder="Full name…" />
              : <p className={`text-sm mt-1 px-3 py-2 rounded-lg border border-transparent ${customer?.name ? 'text-zinc-200 bg-zinc-900/50' : 'text-zinc-600 italic'}`}>{customer?.name || 'Not set'}</p>
            }
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-semibold ml-0.5">Address</label>
            {editingCRM
              ? <input value={crmForm.address} onChange={e => setCrmForm({...crmForm, address: e.target.value})} className="mt-1 w-full text-sm px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white outline-none focus:border-zinc-500 transition-colors" placeholder="Delivery address…" />
              : <p className={`text-sm mt-1 px-3 py-2 rounded-lg border border-transparent ${customer?.address ? 'text-zinc-200 bg-zinc-900/50' : 'text-zinc-600 italic'}`}>{customer?.address || 'Not set'}</p>
            }
          </div>
        </section>

        {/* Tags */}
        <section>
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/60 mb-3">
            <Tag size={13} className="text-blue-400" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Tags</span>
          </div>
          {editingCRM
            ? <input value={crmForm.tags} onChange={e => setCrmForm({...crmForm, tags: e.target.value})} className="w-full text-sm px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white outline-none focus:border-zinc-500 transition-colors" placeholder="vip, bulk, returning…" />
            : (
              <div className="flex flex-wrap gap-1.5">
                {customer?.tags
                  ? customer.tags.split(',').map((t, i) => (
                      <span key={i} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {t.trim()}
                      </span>
                    ))
                  : <span className="text-xs text-zinc-600 italic">No tags</span>
                }
              </div>
            )
          }
        </section>

        {/* Notes */}
        <section>
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/60 mb-3">
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Private Notes</span>
          </div>
          {editingCRM
            ? <textarea value={crmForm.notes} onChange={e => setCrmForm({...crmForm, notes: e.target.value})} rows={3} className="w-full text-sm px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white outline-none resize-none focus:border-zinc-500 transition-colors" placeholder="Internal notes…" />
            : <p className={`text-sm p-3 rounded-xl border leading-relaxed ${customer?.notes ? 'text-zinc-300 bg-zinc-900/50 border-zinc-800/50' : 'text-zinc-600 italic border-zinc-800/30'}`}>{customer?.notes || 'No notes.'}</p>
          }
        </section>

        {/* Orders */}
        <section>
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/60 mb-3">
            <ShoppingBag size={13} className="text-purple-400" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Orders</span>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-500 border border-zinc-800">
              {orders.length}
            </span>
          </div>
          {orders.length === 0
            ? <p className="text-xs text-center py-4 rounded-xl text-zinc-600 bg-zinc-900/50 border border-zinc-800 border-dashed">No orders yet</p>
            : (
              <div className="space-y-2.5">
                {orders.map(o => {
                  const items = parseItems(o.items);
                  return (
                    <div key={o.ID} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-zinc-500">ORDER #{o.ID}</span>
                        <span className="text-[10px] text-zinc-600">{fmtDate(o.CreatedAt)}</span>
                      </div>
                      <div className="space-y-1 border-t border-zinc-800/50 pt-1.5">
                        {items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="truncate pr-2 text-zinc-300"><span className="text-zinc-600 mr-1">{item.qty}×</span>{item.name}</span>
                            <span className="shrink-0 text-zinc-400 font-mono">Rs.{Number(item.price).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center border-t border-zinc-800 pt-2">
                        <span className="text-sm font-black text-white">Rs.{o.total_price.toLocaleString()}</span>
                        <select
                          value={o.status}
                          onChange={e => updateOrderStatus(o.ID, e.target.value)}
                          className={`text-[10px] font-bold uppercase rounded-md px-2 py-1 outline-none cursor-pointer border ${STATUS_STYLE[o.status] ?? ''}`}
                          style={{ background: 'transparent' }}
                        >
                          {STATUS_ORDER.map(s => (
                            <option key={s} value={s} className="bg-zinc-900 text-white">{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </section>
      </div>
    </div>
  ) : null;

  // ── Layout ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Desktop: three columns */}
      <div
        className="hidden md:flex rounded-2xl overflow-hidden border border-zinc-800/60 shadow-2xl"
        style={{ height: 'calc(100vh - 130px)' }}
      >
        <div className="w-[260px] lg:w-[290px] shrink-0">{InboxPanel}</div>
        <div className="flex-1 flex flex-col overflow-hidden">{ChatPanel}</div>
        {activePhone && <div className="w-[290px] lg:w-[310px] shrink-0">{CRMPanel}</div>}
      </div>

      {/* Mobile: single panel */}
      <div
        className="md:hidden flex flex-col rounded-2xl overflow-hidden border border-zinc-800/60 shadow-2xl"
        style={{ height: 'calc(100svh - 130px)' }}
      >
        {mobileView === 'inbox' && InboxPanel}
        {mobileView === 'chat'  && ChatPanel}
        {mobileView === 'crm'   && (activePhone ? CRMPanel : <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">Select a conversation first</div>)}
      </div>
    </>
  );
}
