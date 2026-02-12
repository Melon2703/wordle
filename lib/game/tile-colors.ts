import type { LetterState } from '@/lib/types';

/**
 * Shared tile background/text color classes, previously duplicated in
 * components/PuzzleGrid/Tile.tsx and components/PuzzleLoader.tsx.
 */
export const stateToClass: Record<LetterState | 'empty', string> = {
    correct: 'bg-green-500 text-white',
    present: 'bg-yellow-400 text-slate-800',
    absent: 'bg-gray-300 text-slate-800 opacity-80',
    empty: 'bg-white text-slate-800 opacity-60'
};
