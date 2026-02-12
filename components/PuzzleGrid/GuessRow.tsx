'use client';

import { motion } from 'framer-motion';
import type { TileFeedback } from '@/lib/contracts';
import { Tile } from './Tile';

interface GuessRowProps {
  length: number;
  feedback?: TileFeedback[];
  activeGuess?: string;
  isInvalid?: boolean;
}

export function GuessRow({ length, feedback, activeGuess, isInvalid }: GuessRowProps) {
  const placeholders = Array.from({ length });

  return (
    <motion.div
      className="grid gap-2 md:gap-3"
      style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
      variants={{
        shake: {
          x: [-10, 10, -10, 10, 0],
          transition: { duration: 0.5 }
        }
      }}
      animate={isInvalid ? 'shake' : 'initial'}
    >
      {placeholders.map((_, index) => {
        const item = feedback?.find((entry) => entry.index === index);
        const letter = item?.letter ?? activeGuess?.[index];
        return (
          <Tile 
            key={index} 
            letter={letter} 
            state={item?.state} 
            delay={feedback ? index : 0}
          />
        );
      })}
    </motion.div>
  );
}
