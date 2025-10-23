'use client';

import { motion } from 'framer-motion';
import { Check, Circle, X } from 'lucide-react';
import clsx from 'clsx';
import type { LetterState } from '@/lib/contracts';

const stateToClass: Record<LetterState | 'empty', string> = {
  correct: 'bg-[var(--state-correct)] text-white',
  present: 'bg-[var(--state-present)] text-[var(--text)]',
  absent: 'bg-[var(--state-absent)] text-[var(--text)] opacity-80',
  empty: 'bg-[var(--panel)] text-[var(--text)] opacity-60'
};

const stateToIcon: Record<LetterState, typeof Check> = {
  correct: Check,
  present: Circle,
  absent: X
};

interface TileProps {
  letter?: string;
  state?: LetterState;
  delay?: number;
}

export function Tile({ letter, state, delay = 0 }: TileProps) {
  const variant = state ?? 'empty';
  const Icon = state ? stateToIcon[state] : null;
  
  return (
    <motion.span
      className={clsx(
        'relative flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-semibold transition-colors',
        'border-[color:var(--tile-border)]',
        stateToClass[variant]
      )}
      aria-live="polite"
      initial={{ rotateX: 0 }}
      animate={state ? { rotateX: [0, 90, 0] } : {}}
      transition={{
        duration: 0.15,
        delay: delay * 0.06,
        times: [0, 0.5, 1]
      }}
    >
      {letter ?? ''}
      {Icon && (
        <Icon 
          className="absolute right-1 top-1 h-3 w-3 text-current opacity-70" 
          aria-hidden="true"
        />
      )}
    </motion.span>
  );
}
