'use client';

import clsx from 'clsx';
import type { LetterState } from '@/lib/contracts';

const stateToClass: Record<LetterState | 'empty', string> = {
  correct: 'bg-[var(--state-correct)] text-white',
  present: 'bg-[var(--state-present)] text-[var(--text)]',
  absent: 'bg-[var(--state-absent)] text-[var(--text)] opacity-80',
  empty: 'bg-[var(--panel)] text-[var(--text)] opacity-60'
};

interface TileProps {
  letter?: string;
  state?: LetterState;
}

export function Tile({ letter, state }: TileProps) {
  const variant = state ?? 'empty';
  return (
    <span
      className={clsx(
        'flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-semibold transition-colors',
        'border-[color:var(--tile-border)]',
        stateToClass[variant]
      )}
      aria-live="polite"
    >
      {letter ?? ''}
    </span>
  );
}
