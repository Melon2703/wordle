'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface GameHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  actions?: ReactNode;
}

export function GameHeader({ title, subtitle, backHref, actions }: GameHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-blue-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        {backHref ? (
          <Link
            href={backHref as '/daily' | '/arcade' | '/leaders' | '/shop' | '/help'}
            className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-slate-800"
          >
            ←
          </Link>
        ) : null}
        <div>
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
          {subtitle ? <p className="text-xs text-slate-800 opacity-70">{subtitle}</p> : null}
        </div>
      </div>
      {actions}
    </header>
  );
}
