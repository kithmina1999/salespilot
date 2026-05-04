import React from 'react';
import Link from 'next/link';
import { MessageSquare, UserCircle } from 'lucide-react';
import { ToolbarSearch } from '@/components/dashboard';
import { useChatContext } from '../_context/ChatContext';
import { displayName, fmtTime, initials } from '../utils';

export function InboxPanel() {
  const { 
    inbox, 
    activePhone, 
    searchTerm, 
    setSearchTerm, 
    loadChat, 
    setMobileView 
  } = useChatContext();

  const filteredInbox = inbox.filter(c =>
    c.phone.includes(searchTerm) ||
    (c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const totalUnread = inbox.reduce((s, c) => s + (c.unread_count || 0), 0);

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800/60">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-emerald-400" />
            <span className="font-bold text-sm text-white">Conversations</span>
            {totalUnread > 0 && (
              <span
                title={`${totalUnread} unread message${totalUnread > 1 ? 's' : ''} from customers`}
                className="text-[10px] font-black bg-red-500/90 text-white px-1.5 py-0.5 rounded-full leading-none cursor-default"
              >
                {totalUnread}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
            {inbox.length}
          </span>
        </div>
        {/* Search */}
        <ToolbarSearch
          label="Search conversations"
          placeholder="Search conversations by name or number"
          value={searchTerm}
          onChange={setSearchTerm}
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {/* True empty — no conversations at all (not a search) */}
        {inbox.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 text-center p-6 mt-4">
            <MessageSquare size={24} className="text-zinc-700" />
            <div>
              <p className="text-sm font-bold text-zinc-400">No conversations yet</p>
              <p className="text-xs text-zinc-600 mt-1">Connect WhatsApp to start receiving customer messages.</p>
            </div>
            <Link href="/dashboard/connect" className="dash-secondary-action">Connect WhatsApp</Link>
          </div>
        )}
        {/* Search returned no results */}
        {inbox.length > 0 && filteredInbox.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-xs font-bold text-zinc-500">No results for &ldquo;{searchTerm}&rdquo;</p>
            <p className="text-[11px] text-zinc-600">Try a different name or phone number.</p>
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
                  {initials(chat.customer_name) || <UserCircle size={18} />}
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
}
