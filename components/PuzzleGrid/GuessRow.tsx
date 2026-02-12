'use client';

import { motion } from 'framer-motion';
import type { TileFeedback } from '@/lib/contracts';
import { Tile } from './Tile';

interface GuessRowProps {
  length: number;
  feedback?: TileFeedback[];
  activeGuess?: string;
  isInvalid?: boolean;
  isPending?: boolean;
  pendingGuess?: string;
}

export function GuessRow({ length, feedback, activeGuess, isInvalid, isPending, pendingGuess }: GuessRowProps) {
  const placeholders = Array.from({ length });

  return (
    <motion.div
      className="grid justify-center"
      style={{ 
        gap: '8px',
        gridTemplateColumns: `repeat(${length}, 56px)`
      }}
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
        const letter = item?.letter ?? activeGuess?.[index] ?? pendingGuess?.[index];
        const isFlashing = isPending && !feedback;
        return (
          <Tile 
            key={index} 
            letter={letter} 
            state={item?.state} 
            delay={feedback ? index : 0}
            isFlashing={isFlashing}
          />
        );
      })}
    </motion.div>
  );
}
