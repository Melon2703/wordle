'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { init } from '@tma.js/sdk';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isShareDeepLink, getTelegramStartParam, decodeShareParam } from '@/lib/deeplink';

let initialized = false;

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 1000 * 30
          }
        }
      })
  );

  useEffect(() => {
    if (initialized) {
      return;
    }
    initialized = true;
    try {
      // why: ensure Mini App SDK features are ready once per app boot (docs/frontend/Frontend_Documentation.md §2)
      init({ acceptCustomStyles: true });
    } catch (error) {
      console.error('Failed to init Telegram Mini App SDK', error);
    }
  }, []);

  // why: detect and handle share deep links on app boot, redirect to game mode (docs/backend/Backend_Documentation.md §A.2)
  useEffect(() => {
    // Add small delay to ensure SDK is ready
    const timer = setTimeout(() => {
      const startParam = getTelegramStartParam();
      
      if (isShareDeepLink() && startParam) {
        const payload = decodeShareParam(startParam);
        if (payload) {
          const targetPath = payload.mode === 'daily' ? '/daily' : '/arcade';
          router.push(targetPath);
        }
      }
    }, 100); // Small delay to ensure SDK is ready

    return () => clearTimeout(timer);
  }, [router]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}