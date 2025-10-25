'use client';

import { useState } from 'react';
import type { GuessLine } from '@/lib/contracts';
import { PuzzleGrid } from './PuzzleGrid';
import { RisingStar } from './FiringStarAnimations';

interface ResultScreenProps {
  status: 'won' | 'lost';
  attemptsUsed: number;
  answer?: string;
  mode: 'daily' | 'arcade';
  timeMs?: number;
  onNewGame?: (length: 4 | 5 | 6 | 7) => void;
  // Grid props
  length: number;
  lines: GuessLine[];
}

const lengths: Array<4 | 5 | 6 | 7> = [4, 5, 6, 7];

export function ResultScreen({ 
  status, 
  attemptsUsed, 
  answer, 
  mode, 
  timeMs, 
  onNewGame,
  length,
  lines
}: ResultScreenProps) {
  const [selectedLength, setSelectedLength] = useState<4 | 5 | 6 | 7>(5);

  const resultCopy = status === 'won' ? 'Победа!' : 'Попробуйте снова';
  
  const formatTime = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds} с`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}м ${remainingSeconds}с`;
  };

  const handleNewGame = () => {
    if (onNewGame) {
      onNewGame(selectedLength);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto mb-8 mt-8">
      {/* Result Header */}
      <div className="text-center mb-5">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
          {status === 'won' ? (
            <RisingStar size={64} />
          ) : (
            <span className="text-2xl">💭</span>
          )}
        </div>
        <h2 className="text-2xl font-bold text-slate-800 font-sans">{resultCopy}</h2>
        {status === 'lost' && mode === 'arcade' && (
          <p className="mt-2 text-sm text-slate-600 font-sans">
            Можете потренироваться в режиме Аркада.
          </p>
        )}
        {status === 'lost' && answer && (
          <p className="mt-3 text-sm text-slate-600 font-sans">Сегодняшнее слово: {answer}</p>
        )}
      </div>

      {/* Statistics Section */}
      <div className="bg-white rounded-2xl border border-blue-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-slate-800 mb-4">Статистика</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-600">Попыток использовано:</span>
            <span className="font-medium text-slate-800">{attemptsUsed}</span>
          </div>
          {timeMs && (
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Время:</span>
              <span className="font-medium text-slate-800">{formatTime(timeMs)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex justify-center mb-6">
        <div className="scale-[0.66]">
          <PuzzleGrid 
            length={length} 
            maxAttempts={lines.length} 
            lines={lines} 
            activeGuess=""
          />
        </div>
      </div>

      {/* Arcade New Game Selector */}
      {mode === 'arcade' && onNewGame && (
        <div className="bg-white rounded-2xl border border-blue-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Новая игра</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {lengths.map((len) => (
              <button
                key={len}
                type="button"
                onClick={() => setSelectedLength(len)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  len === selectedLength 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-blue-100 text-slate-800 hover:bg-blue-200'
                }`}
              >
                {len} букв
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleNewGame}
            className="w-full rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
          >
            Начать новую игру
          </button>
        </div>
      )}
    </div>
  );
}
