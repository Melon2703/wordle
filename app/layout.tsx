import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ThemeBridge } from '@/components/ThemeBridge';
import { HapticsBridge } from '@/components/HapticsBridge';
import { ToastCenter } from '@/components/ToastCenter';
import { Header } from '@/components/Header';
import { BottomNavWrapper } from '@/components/BottomNavWrapper';
import { LoadingFallback } from '@/components/LoadingFallback';

// Configure Inter font with Cyrillic support
const inter = Inter({ 
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'RU Word Puzzle',
  description: 'Ежедневная и аркадная загадки внутри Telegram Mini App.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <head>
        {/* Telegram WebApp Script - Required for Telegram Mini Apps */}
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body>
        <Providers>
          <ThemeBridge />
          <HapticsBridge />
          <Header />
          <ToastCenter>
            <Suspense fallback={<LoadingFallback length={5} />}>
              {children}
            </Suspense>
          </ToastCenter>
          <BottomNavWrapper />
        </Providers>
      </body>
    </html>
  );
}
