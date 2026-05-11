'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export default function PlatformNoticeBanner() {
  const notice = useAppStore((s) => s.platformNotice);
  const [dismissedId, setDismissedId] = useState<number | null>(null);

  // Read dismissed notice ID from session storage so it persists across soft reloads,
  // but reappears if a NEW notice is published
  useEffect(() => {
    const saved = sessionStorage.getItem('dismissedNoticeId');
    if (saved) {
      setDismissedId(parseInt(saved, 10));
    }
  }, []);

  if (!notice) return null;
  if (dismissedId === notice.id) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('dismissedNoticeId', notice.id.toString());
    setDismissedId(notice.id);
  };

  const styleMap: Record<string, { bg: string; border: string; icon: React.ReactNode; titleColor: string }> = {
    info: {
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
      icon: <Info size={16} className="text-indigo-400" />,
      titleColor: 'text-indigo-300',
    },
    warning: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      icon: <AlertTriangle size={16} className="text-amber-400" />,
      titleColor: 'text-amber-300',
    },
    critical: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      icon: <AlertCircle size={16} className="text-red-400" />,
      titleColor: 'text-red-300',
    },
  };

  const style = styleMap[notice.type] || styleMap.info;

  return (
    <div className={`shrink-0 border-b px-4 py-3 flex items-start sm:items-center gap-3 transition-all ${style.bg} ${style.border}`}>
      <div className="shrink-0 mt-0.5 sm:mt-0">
        {style.icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold tracking-tight leading-snug ${style.titleColor}`}>
          {notice.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {notice.message}
        </p>
      </div>

      <button
        onClick={handleDismiss}
        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-muted-foreground hover:bg-white/5 transition-colors -mr-1"
        aria-label="Dismiss notice"
      >
        <X size={16} />
      </button>
    </div>
  );
}
