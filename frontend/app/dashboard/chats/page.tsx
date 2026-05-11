'use client';

import React from 'react';
import { ChatProvider, useChatContext } from './_context/ChatContext';
import { InboxPanel } from './_components/InboxPanel';
import { ChatPanel } from './_components/ChatPanel';
import { CRMPanel } from './_components/CRMPanel';

function ChatsLayout() {
  const { activePhone, mobileView } = useChatContext();

  return (
    <>
      {/* Desktop: three columns */}
      <div
        className="hidden md:flex rounded-2xl overflow-hidden border border-border/60 shadow-2xl"
        style={{ height: 'calc(100vh - 130px)' }}
      >
        <div className="w-[260px] lg:w-[290px] shrink-0"><InboxPanel /></div>
        <div className="flex-1 flex flex-col overflow-hidden"><ChatPanel /></div>
        {activePhone && <div className="w-[290px] lg:w-[310px] shrink-0"><CRMPanel /></div>}
      </div>

      {/* Mobile: single panel */}
      <div
        className="md:hidden flex flex-col rounded-2xl overflow-hidden border border-border/60 shadow-2xl"
        style={{ height: 'calc(100svh - 130px)' }}
      >
        {mobileView === 'inbox' && <InboxPanel />}
        {mobileView === 'chat'  && <ChatPanel />}
        {mobileView === 'crm'   && (
          activePhone ? <CRMPanel /> : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation first
            </div>
          )
        )}
      </div>
    </>
  );
}

export default function ChatsPage() {
  return (
    <ChatProvider>
      <ChatsLayout />
    </ChatProvider>
  );
}
