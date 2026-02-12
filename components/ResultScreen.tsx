'use client';

import type { GuessLine } from '@/lib/contracts';
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
  const resultCopy = status === 'won' ? 'Победа!' : 'Попробуйте снова';
  
  const formatTime = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds} с`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}м ${remainingSeconds}с`;
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
        <Heading level={2}>{resultCopy}</Heading>
        {status === 'lost' && mode === 'arcade' && (
          <Text className="mt-2">
            Можете потренироваться в режиме Аркада.
          </Text>
        )}
        {status === 'lost' && answer && (
          <Text className="mt-3">Сегодняшнее слово: {answer}</Text>
        )}
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
