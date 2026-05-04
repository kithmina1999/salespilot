import React from 'react';
import { UserCircle, Bot, Send, Loader2, ArrowLeft, Wifi, WifiOff, MessageSquare } from 'lucide-react';
import { useChatContext } from '../_context/ChatContext';
import { displayName, formatPhone, fmtTime, initials } from '../utils';

export function ChatPanel() {
  const {
    activePhone,
    inbox,
    messages,
    customer,
    loadingChat,
    setMobileView,
    replyText,
    setReplyText,
    sending,
    sendReply,
    messagesEndRef,
    replyInputRef,
  } = useChatContext();

  const activeSummary = inbox.find(c => c.phone === activePhone);
  const botActive = !!customer && !customer.bot_paused;

  return (
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
              {initials(activeSummary?.customer_name) || <UserCircle size={18} />}
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
          <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col-reverse gap-3">
            <div ref={messagesEndRef} className="shrink-0 h-1" />
            {loadingChat ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="animate-spin text-zinc-600" size={24} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col h-full items-center justify-center gap-3 text-center text-zinc-400">
                <MessageSquare size={32} className="text-emerald-400" />
                <p className="text-sm font-bold text-zinc-100">No messages yet</p>
                <p className="text-sm text-zinc-400 max-w-xs">This conversation will fill as the customer and bot exchange messages.</p>
              </div>
            ) : (
              [...messages].reverse().map((msg, i) => {
                const isUser     = msg.role === 'user';
                const isMerchant = msg.role === 'merchant';
                const isBot      = msg.role === 'model';
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
                        {initials(customer?.name) || <UserCircle size={14} />}
                      </div>
                    )}

                    <div className={`max-w-[70%] flex flex-col gap-1 ${isRight ? 'items-end' : 'items-start'}`}>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-0.5 ${
                        isBot ? 'text-emerald-500/60' : isMerchant ? 'text-amber-500/60' : 'text-zinc-500'
                      }`}>
                        {isBot ? 'AI Bot' : isMerchant ? 'You (Agent)' : displayName(customer?.name, activePhone ?? undefined)}
                      </span>

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

                      <span className="text-[10px] text-zinc-600 px-0.5">{fmtTime(msg.CreatedAt)}</span>
                    </div>
                  </div>
                );
              })
            )}
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
        <div className="flex flex-col h-full items-center justify-center gap-3 text-zinc-400 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <MessageSquare size={28} className="text-emerald-400" />
          </div>
          <p className="text-sm font-bold text-zinc-100">Select a conversation</p>
          <p className="text-sm text-zinc-400">Pick a chat from the inbox to view messages and customer details.</p>
        </div>
      )}
    </div>
  );
}
