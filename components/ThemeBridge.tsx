'use client';

import { useEffect } from 'react';

export function ThemeBridge() {
  useEffect(() => {
    const themeParams = (window as typeof window & {
      Telegram?: { WebApp?: { themeParams?: Record<string, string> } };
    }).Telegram?.WebApp?.themeParams;

    if (!themeParams) {
      return;
    }

    Object.entries(themeParams).forEach(([key, value]) => {
      document.documentElement.style.setProperty(`--tg-${key.replace(/_/g, '-')}`, `#${value}`);
    });
  }, []);

  return null;
}
