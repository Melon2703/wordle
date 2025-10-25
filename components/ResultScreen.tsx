'use client';

import Link from 'next/link';
import type { GuessLine } from '@/lib/contracts';
import { PuzzleGrid } from './PuzzleGrid';
import { RisingStar } from './FiringStarAnimations';
import { Button, Card, Heading, Text } from '@/components/ui';
import { Flame } from 'lucide-react';

interface ResultScreenProps {
  status: 'won' | 'lost';
  attemptsUsed: number;
  answer?: string;
  mode: 'daily' | 'arcade';
  timeMs?: number;
  streak?: number;
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
        <Heading level={4} className="mb-4">Статистика</Heading>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Text variant="caption">Попыток использовано:</Text>
            <Text className="font-medium">{attemptsUsed}</Text>
          </div>
          {timeMs && (
            <div className="flex justify-between items-center">
              <Text variant="caption">Время:</Text>
              <Text className="font-medium">{formatTime(timeMs)}</Text>
            </div>
          )}
          {mode === 'daily' && streak !== undefined && (
            <div className="flex justify-between items-center">
              <Text variant="caption" className="flex items-center gap-1">
                Серия:
                <Flame className="w-4 h-4 text-orange-500" />
              </Text>
              <Text className="font-medium">{streak}</Text>
            </div>
          )}
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

      {/* Arcade New Game Button */}
      {mode === 'arcade' && (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Link href="/arcade">
              <Button fullWidth size="sm">
                Новая игра
              </Button>
            </Link>
            <Button fullWidth size="sm" disabled>
              Поделиться результатом
            </Button>
          </div>
          <Text variant="caption" className="text-center mt-2">
            Функция поделиться будет доступна в следующих обновлениях
          </Text>
        </div>
      )}
    </div>
  );
}
