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
    <header className="flex items-center justify-between gap-4 border-b border-[color:var(--tile-border)] bg-[var(--panel)] px-4 py-3">
      <div className="flex items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="rounded-full bg-[var(--key-bg)] px-3 py-1 text-sm font-medium text-[var(--text)]"
          >
            ←
          </Link>
        ) : null}
        <div>
          <h1 className="text-lg font-semibold text-[var(--text)]">{title}</h1>
          {subtitle ? <p className="text-xs text-[var(--text)] opacity-70">{subtitle}</p> : null}
        </div>
      </div>
      {actions}
    </header>
  );
}
