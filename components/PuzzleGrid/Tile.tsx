'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { LetterState } from '@/lib/types';
import { stateToClass } from '@/lib/game/tile-colors';

interface TileProps {
  letter?: string;
  state?: LetterState;
  delay?: number;
  isFlashing?: boolean;
}

export function Tile({ letter, state, delay = 0, isFlashing = false }: TileProps) {
  const variant = state ?? 'empty';

  return (
    <motion.span
      className={clsx(
        'relative flex h-14 w-14 items-center justify-center rounded-md border text-xl font-semibold transition-colors font-sans',
        'border-blue-200',
        stateToClass[variant],
        isFlashing && 'animate-pulse'
      )}
      aria-live="polite"
      initial={{ rotateX: 0 }}
      animate={state ? { rotateX: [0, 90, 0] } : {}}
      transition={{
        duration: 0.15,
        delay: delay * 0.06,
        times: [0, 0.5, 1]
      }}
      style={{
        opacity: isFlashing ? undefined : 1
      }}
    >
      {letter ?? ''}
    </motion.span>
  );
}
