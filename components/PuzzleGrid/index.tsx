'use client';

import type { GuessLine } from '@/lib/contracts';
import { GuessRow } from './GuessRow';

interface PuzzleGridProps {
  length: number;
  maxAttempts: number;
  lines: GuessLine[];
  activeGuess: string;
  pendingGuess?: string | null;
}

export function PuzzleGrid({ length, maxAttempts, lines, activeGuess, pendingGuess }: PuzzleGridProps) {
  const rows = Array.from({ length: maxAttempts });

  return (
    <div className="flex flex-col" style={{ gap: '8px' }}>
      {rows.map((_, index) => {
        const historyLine = lines[index];
        const isActiveRow = index === lines.length;
        const isPendingRow = index === lines.length && pendingGuess;
        return (
          <GuessRow
            key={index}
            length={length}
            feedback={historyLine?.feedback}
            activeGuess={isActiveRow ? activeGuess : undefined}
            isPending={!!isPendingRow}
            pendingGuess={isPendingRow ? pendingGuess : undefined}
          />
        );
      })}
    </div>
  );
}
