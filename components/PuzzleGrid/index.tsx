'use client';

import type { GuessLine } from '@/lib/contracts';
import { GuessRow } from './GuessRow';

interface PuzzleGridProps {
  length: number;
  maxAttempts: number;
  lines: GuessLine[];
  activeGuess: string;
}

export function PuzzleGrid({ length, maxAttempts, lines, activeGuess }: PuzzleGridProps) {
  const rows = Array.from({ length: maxAttempts });

  return (
    <div className="flex flex-col" style={{ gap: '8px' }}>
      {rows.map((_, index) => {
        const historyLine = lines[index];
        const isActiveRow = index === lines.length;
        return (
          <GuessRow
            key={index}
            length={length}
            feedback={historyLine?.feedback}
            activeGuess={isActiveRow ? activeGuess : undefined}
          />
        );
      })}
    </div>
  );
}
