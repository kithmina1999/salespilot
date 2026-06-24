import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { Send, Loader2, RefreshCw, Bot, Sparkles, X } from 'lucide-react';

const fetcher = (url: string) => {
  return fetch(url, {
    credentials: 'include',
  }).then(res => res.json());
};

export function SandboxSimulator({ onClose }: { onClose?: () => void }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: profile, mutate } = useSWR('/api/v1/chats/99900000000', fetcher, {
    refreshInterval: 3000, // Poll for bot replies
  });

  const messages = profile?.messages || [];

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    const text = message.trim();
    setMessage('');

    // Optimistic UI update could go here
    
    try {
      await fetch('/api/v1/business/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text })
      });
      mutate(); // Trigger a refetch immediately
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setSending(false);
    }
  };

  const clearChat = async () => {
    try {
      await fetch('/api/v1/business/simulate', {
        method: 'DELETE',
        credentials: 'include',
      });
      mutate();
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-background border-border rounded-none sm:rounded-l-2xl overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Bot className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Sandbox Simulator</h3>
            {profile?.simulation_limit > 0 ? (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-muted-foreground">
                  {profile.simulation_count} / {profile.simulation_limit} tests used
                </p>
                <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${profile.simulation_count >= profile.simulation_limit ? 'bg-red-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, (profile.simulation_count / profile.simulation_limit) * 100)}%` }}
                  />
                </div>
              </div>
            ) : profile?.simulation_limit === -1 ? (
              <p className="text-[11px] text-muted-foreground">Unlimited testing</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Test your rules safely</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearChat} className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
            <RefreshCw size={16} />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Close">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#f0f2f5] dark:bg-[#0b141a]"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50 px-4">
            <Sparkles className="w-8 h-8 text-amber-500 mb-3" />
            <p className="text-sm text-muted-foreground">Start typing to test your bot!</p>
            <p className="text-xs text-muted-foreground mt-1">No real messages will be sent.</p>
          </div>
        ) : (
          messages.map((msg: any) => {
            const isBot = msg.role === 'model';
            let content = msg.content || '';
            let isInteractive = false;
            let interactiveType = '';

            if (content.startsWith('[Buttons] ')) {
              isInteractive = true;
              interactiveType = 'buttons';
              content = content.replace('[Buttons] ', '');
            } else if (content.startsWith('[List] ')) {
              isInteractive = true;
              interactiveType = 'list';
              content = content.replace('[List] ', '');
            }

            return (
              <div key={msg.ID} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl text-[13px] leading-relaxed relative flex flex-col ${
                    isBot 
                      ? 'bg-secondary text-foreground rounded-tl-sm border border-border/50' 
                      : 'bg-emerald-650 dark:bg-emerald-700 text-white rounded-tr-sm'
                  }`}
                >
                  <div className="px-4 py-2.5">
                    <p className="whitespace-pre-wrap">{content}</p>
                    <div className={`text-[9px] mt-1 text-right ${isBot ? 'text-muted-foreground' : 'text-emerald-200'}`}>
                      {new Date(msg.CreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  
                  {isInteractive && (
                    <div className="border-t border-border/50 flex flex-col items-center p-2 gap-1.5 bg-muted rounded-b-2xl">
                      {interactiveType === 'buttons' ? (
                        <>
                          <div className="w-full text-center text-amber-500 font-medium py-1.5 text-xs border border-border/50 rounded-lg bg-accent shadow-sm cursor-not-allowed opacity-80">Interactive Button 1</div>
                          <div className="w-full text-center text-amber-500 font-medium py-1.5 text-xs border border-border/50 rounded-lg bg-accent shadow-sm cursor-not-allowed opacity-80">Interactive Button 2</div>
                        </>
                      ) : (
                        <div className="w-full text-center text-amber-500 font-medium py-2 text-xs border border-border/50 rounded-lg bg-accent shadow-sm cursor-not-allowed opacity-80 flex items-center justify-center gap-1">
                          <span className="w-3 h-3 bg-zinc-600 rounded-sm inline-block"></span>
                          List Selection Menu
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-muted border-t border-border shrink-0">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={sending}
            placeholder="Type a test message..."
            className="w-full bg-background border border-border text-sm text-foreground rounded-full pl-5 pr-12 py-3 outline-none focus:border-amber-500/50 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!message.trim() || sending}
            className="absolute right-2 w-8 h-8 flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-black rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
