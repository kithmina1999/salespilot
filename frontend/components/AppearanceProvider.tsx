'use client';

import { ThemeProvider } from 'next-themes';
import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

const FONT_SCALES: Record<string, number> = {
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
};

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const fontScale = useAppStore((state) => state.appearance?.fontScale || 'md');

  useEffect(() => {
    // Apply font size to the root html element
    const pxSize = FONT_SCALES[fontScale] || 16;
    document.documentElement.style.fontSize = `${pxSize}px`;
  }, [fontScale]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
