import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { LocaleProvider } from '@/lib/locale';
import './globals.css';

export const metadata: Metadata = {
  title: 'SalesPilot — WhatsApp AI Bot for Sri Lankan Businesses',
  description: 'Turn your WhatsApp into a 24/7 AI sales agent. Answer customers, take orders, and grow your business automatically. Built for Sri Lankan SMBs. Start free.',
  keywords: 'WhatsApp bot Sri Lanka, AI sales bot, WhatsApp automation Sri Lanka, Sinhala chatbot, WhatsApp business bot',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <LocaleProvider>
          {children}
          <Toaster theme="dark" position="bottom-right" duration={4000} />
        </LocaleProvider>
      </body>
    </html>
  );
}

