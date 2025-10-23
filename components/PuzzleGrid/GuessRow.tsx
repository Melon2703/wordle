'use client';

import type { TileFeedback } from '@/lib/contracts';
import { Tile } from './Tile';

interface GuessRowProps {
  length: number;
  feedback?: TileFeedback[];
  activeGuess?: string;
}

export function GuessRow({ length, feedback, activeGuess }: GuessRowProps) {
  const placeholders = Array.from({ length });

  return (
    <div
      className="grid gap-2 md:gap-3"
      style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
    >
      {placeholders.map((_, index) => {
        const item = feedback?.find((entry) => entry.index === index);
        const letter = item?.letter ?? activeGuess?.[index];
        return <Tile key={index} letter={letter} state={item?.state} />;
      })}
    </div>
  );
}
