'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface ToastMessage {
  id: string;
  message: string;
}

interface ToastContextValue {
  notify(message: string): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('ToastCenter is missing in the component tree');
  }
  return ctx;
}

export function ToastCenter({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const notify = useCallback((message: string) => {
    const id = createId();
    setMessages((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((toast) => toast.id !== id));
    }, 2500);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 flex justify-center z-50">
        <div className="flex w-full max-w-sm flex-col gap-2 px-4">
          {messages.map((toast) => (
            <div
              key={toast.id}
              className="rounded-xl bg-[var(--panel)] px-4 py-3 text-center text-sm text-[var(--text)] shadow-xl border border-[var(--tile-border)]"
            >
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
