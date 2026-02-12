'use client';

import type { GuessLine } from '@/lib/types';
import { PuzzleGrid } from './PuzzleGrid';
import { RisingStar } from './FiringStarAnimations';
import { Card, Heading, Text } from '@/components/ui';

interface ResultScreenProps {
  status: 'won' | 'lost';
  attemptsUsed: number;
  answer?: string;
  mode: 'daily' | 'arcade';
  timeMs?: number;
  streak?: number;
  arcadeSolved?: number;
  // Grid props
  length: number;
  lines: GuessLine[];
}

export function ResultScreen({ 
  status, 
  attemptsUsed, 
  answer, 
  mode, 
  timeMs, 
  streak,
  arcadeSolved,
  length,
  lines
}: ResultScreenProps) {
  const resultCopy = status === 'won' ? 'Победа!' : 'Получится в следующий раз!';
  
  const formatTime = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds} с`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}м ${remainingSeconds}с`;
  };

  return (
    <div className="w-full max-w-sm mx-auto mb-8">
      {/* Result Header */}
      <div className="text-center mb-5">
        {status === 'won' ? (
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
            <RisingStar size={64} />
          </div>
        ) : (
          // For loss: show answer block instead of icon (same size as star)
          <div className="mx-auto mb-4 flex h-20 items-center justify-center">
            <div className="px-3 py-2 bg-slate-100 rounded-lg text-center min-w-20">
              <Text className="text-[10px] text-slate-600 block leading-tight mb-0.5">{mode === 'daily' ? 'Слово дня' : 'Неразгаданное слово'}</Text>
              <Text className="font-bold text-sm text-slate-800 uppercase leading-tight">{answer}</Text>
            </div>
          </div>
        )}
        
        <Heading level={2}>{resultCopy}</Heading>
      </div>

      {/* Statistics Section */}
      <Card padding="md" className="mb-6">
        <div className="grid grid-cols-3 gap-4">
          {/* Попытки */}
          <div className="text-center">
            <Text variant="caption" className="block mb-1">Попытки</Text>
            <Text className="font-semibold text-lg">{attemptsUsed}</Text>
          </div>
          
          {/* Время */}
          <div className="text-center">
            <Text variant="caption" className="block mb-1">Время</Text>
            <Text className="font-semibold text-lg">{timeMs ? formatTime(timeMs) : '-'}</Text>
          </div>
          
          {/* Серия (daily) or Аркад решено (arcade) */}
          <div className="text-center">
            <Text variant="caption" className="block mb-1">
              {mode === 'daily' ? 'Серия' : 'Аркад решено'}
            </Text>
            <Text className="font-semibold text-lg">
              {mode === 'daily' ? (streak ?? '-') : (arcadeSolved ?? '-')}
            </Text>
          </div>
        </div>
      </Card>

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
    </div>
  );
}
