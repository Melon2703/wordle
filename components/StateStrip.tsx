'use client';

import { useState, useEffect } from 'react';
import { PuzzleLoader } from './PuzzleLoader';
import type { UserStatus } from '@/lib/types';

interface StateStripProps {
  status: UserStatus | null;
  isLoading: boolean;
}

export function StateStrip({ status, isLoading }: StateStripProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('');

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Update countdown timer
  useEffect(() => {
    if (!status?.nextPuzzleAt) return;

    const updateCountdown = () => {
      const now = new Date();
      const nextPuzzle = new Date(status.nextPuzzleAt);
      const diff = nextPuzzle.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilNext('Новая загадка готова!');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeUntilNext(`До новой: ${hours} ч ${minutes} м`);
      } else {
        setTimeUntilNext(`До новой: ${minutes} м`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [status?.nextPuzzleAt]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <PuzzleLoader length={5} />
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const formatTime = (timeMs?: number): string => {
    if (!timeMs) return '';
    const seconds = Math.floor(timeMs / 1000);
    return `${seconds} с`;
  };

  const getDailyStatusText = (): string => {
    switch (status.dailyStatus) {
      case 'not_started':
        return 'Сегодня: ждёт вас';
      case 'playing':
        return 'Сегодня: в процессе';
      case 'won':
        return `Решено (${status.dailyAttempts} · ${formatTime(status.dailyTimeMs)})`;
      case 'lost':
        return `Не решено (${status.dailyAttempts} попыток)`;
      default:
        return 'Сегодня: ждёт вас';
    }
  };

  const isNearMidnight = (): boolean => {
    if (!status.nextPuzzleAt) return false;
    const now = new Date();
    const nextPuzzle = new Date(status.nextPuzzleAt);
    const diff = nextPuzzle.getTime() - now.getTime();
    return diff < 30 * 60 * 1000; // Less than 30 minutes
  };

  const isLongStreak = status.streak >= 7;

  return (
    <div className="text-sm text-slate-600 leading-relaxed text-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* Daily Status */}
        <span className="font-medium">
          {getDailyStatusText()}
        </span>

        {/* Separator */}
        <span className="text-slate-400">·</span>

        {/* Streak */}
        <span className="flex items-center gap-1">
          <span>Серия: {status.streak}</span>
          <span 
            className={`text-orange-500 ${
              isLongStreak && !prefersReducedMotion 
                ? 'animate-pulse' 
                : ''
            }`}
            role="img"
            aria-label="Пламя"
          >
            🔥
          </span>
        </span>

        {/* Separator */}
        <span className="text-slate-400">·</span>

        {/* Countdown */}
        <span 
          className={`${
            isNearMidnight() && !prefersReducedMotion
              ? 'text-orange-600 font-medium'
              : ''
          }`}
        >
          {timeUntilNext}
        </span>
      </div>
    </div>
  );
}
