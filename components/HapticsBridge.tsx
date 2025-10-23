'use client';

import { useEffect } from 'react';

interface TelegramHaptics {
  impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
  notificationOccurred(type: 'success' | 'warning' | 'error'): void;
  selectionChanged(): void;
}

let hapticsRef: TelegramHaptics | null = null;

export function HapticsBridge() {
  useEffect(() => {
    const api = (window as typeof window & {
      Telegram?: { WebApp?: { HapticFeedback?: TelegramHaptics } };
    }).Telegram?.WebApp?.HapticFeedback;

    hapticsRef = api ?? null;

    return () => {
      hapticsRef = null;
    };
  }, []);

  return null;
}

export function triggerHaptic(event: 'success' | 'error' | 'light') {
  const api = hapticsRef;
  if (!api) {
    return;
  }
  if (event === 'light') {
    api.impactOccurred('light');
    return;
  }
  const type = event === 'success' ? 'success' : 'error';
  api.notificationOccurred(type);
}
