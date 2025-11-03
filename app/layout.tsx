import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ThemeBridge } from '@/components/ThemeBridge';
import { HapticsBridge } from '@/components/HapticsBridge';
import { ToastCenter } from '@/components/ToastCenter';
import { BottomNavWrapper } from '@/components/BottomNavWrapper';
import { LoadingFallback } from '@/components/LoadingFallback';
import Script from 'next/script';

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
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-J25T6N5ZQ1';

  return (
    <html lang="ru" className={inter.variable}>
      <head>
        {/* Telegram WebApp Script - Required for Telegram Mini Apps */}
        <script src="https://telegram.org/js/telegram-web-app.js" async />
        <Script
          id="ga-script"
          src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
          strategy="afterInteractive"
        />
        <Script id="ga-config" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaMeasurementId}');
        `}
        </Script>
      </head>
      <body>
        <Providers>
          <ThemeBridge />
          <HapticsBridge />
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
