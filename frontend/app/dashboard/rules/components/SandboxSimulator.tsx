import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { Send, Loader2, RefreshCw, Bot, User, Sparkles } from 'lucide-react';

const fetcher = (url: string) => {
  const token = localStorage.getItem('token');
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(res => res.json());
};

export function SandboxSimulator() {
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
      const token = localStorage.getItem('token');
      await fetch('/api/v1/business/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
    // We don't have an endpoint to delete a specific chat easily, 
    // but the user can just ignore it or we can add one later.
    // For now, let's just refresh.
    mutate();
  };

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Bot className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Sandbox Simulator</h3>
            <p className="text-[11px] text-zinc-400">Test your rules safely</p>
          </div>
        </div>
        <button onClick={clearChat} className="p-2 text-zinc-400 hover:text-white transition-colors" title="Refresh">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[url('/img/wa-bg.png')] bg-repeat bg-opacity-5"
        style={{ backgroundImage: `url('https://i.imgur.com/3qC5P7W.png')`, backgroundSize: '400px' }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50 px-4">
            <Sparkles className="w-8 h-8 text-amber-500 mb-3" />
            <p className="text-sm text-zinc-300">Start typing to test your bot!</p>
            <p className="text-xs text-zinc-500 mt-1">No real messages will be sent.</p>
          </div>
        ) : (
          messages.slice().reverse().map((msg: any) => {
            const isBot = msg.role === 'model';
            return (
              <div key={msg.ID} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed relative ${
                    isBot 
                      ? 'bg-zinc-800 text-white rounded-tl-sm border border-zinc-700/50' 
                      : 'bg-emerald-600 text-white rounded-tr-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <div className={`text-[9px] mt-1 text-right ${isBot ? 'text-zinc-400' : 'text-emerald-200'}`}>
                    {new Date(msg.CreatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-zinc-900 border-t border-zinc-800 shrink-0">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={sending}
            placeholder="Type a test message..."
            className="w-full bg-zinc-950 border border-zinc-800 text-sm text-white rounded-full pl-5 pr-12 py-3 outline-none focus:border-amber-500/50 transition-colors disabled:opacity-50"
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
