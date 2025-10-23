'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { init } from '@tma.js/sdk';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

let initialized = false;

export function Providers({ children }: { children: ReactNode }) {
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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
