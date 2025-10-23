import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';
import { ThemeBridge } from '@/components/ThemeBridge';
import { HapticsBridge } from '@/components/HapticsBridge';
import { ToastCenter } from '@/components/ToastCenter';

export const metadata: Metadata = {
  title: 'RU Word Puzzle',
  description: 'Ежедневная и аркадная загадки внутри Telegram Mini App.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>
          <ThemeBridge />
          <HapticsBridge />
          <ToastCenter>{children}</ToastCenter>
        </Providers>
      </body>
    </html>
  );
}
