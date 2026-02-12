'use client';

type TelegramWebApp = {
  initData?: string;
};

type TelegramWindow = Window & {
  Telegram?: { WebApp?: TelegramWebApp };
  tg?: { WebApp?: TelegramWebApp };
};

function getTelegramWebApp(): TelegramWebApp | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const win = window as TelegramWindow;
  return win.Telegram?.WebApp || win.tg?.WebApp;
}

export function hasTelegramInitData(): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return Boolean(getTelegramWebApp()?.initData);
}

interface WaitOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

export async function waitForTelegramInitData(options: WaitOptions = {}): Promise<boolean> {
  if (hasTelegramInitData()) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const timeoutMs = options.timeoutMs ?? 4000;
  const intervalMs = options.intervalMs ?? 100;

  return new Promise((resolve) => {
    const startedAt = Date.now();

    const check = () => {
      if (hasTelegramInitData()) {
        resolve(true);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }

      setTimeout(check, intervalMs);
    };

    check();
  });
}
