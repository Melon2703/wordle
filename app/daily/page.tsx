'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GameHeader } from '@/components/GameHeader';
import { KeyboardCyr } from '@/components/KeyboardCyr';
import { PuzzleGrid } from '@/components/PuzzleGrid';
import { ResultModal } from '@/components/ResultModal';
import { SettingsSheet } from '@/components/SettingsSheet';
import { useToast } from '@/components/ToastCenter';
import { triggerHaptic } from '@/components/HapticsBridge';
import { getDailyPuzzle, submitDailyGuess } from '@/lib/api';
import type { GuessLine, LetterState, DailyPuzzlePayload } from '@/lib/contracts';

interface SettingsState {
  highContrast: boolean;
  haptics: boolean;
  showTimer: boolean;
  treatYoAsYe: boolean;
}

const initialSettings: SettingsState = {
  highContrast: true,
  haptics: true,
  showTimer: false,
  treatYoAsYe: false
};

const statePriority: Record<LetterState, number> = {
  correct: 3,
  present: 2,
  absent: 1
};

function buildKeyboardState(lines: GuessLine[]): Record<string, LetterState> {
  return lines.reduce<Record<string, LetterState>>((acc, line) => {
    line.feedback.forEach(({ letter, state }) => {
      const existing = acc[letter];
      if (!existing || statePriority[state] > statePriority[existing]) {
        acc[letter] = state;
      }
    });
    return acc;
  }, {});
}

export default function DailyPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ 
    queryKey: ['puzzle', 'daily'], 
    queryFn: getDailyPuzzle,
    staleTime: 30 * 1000 // 30 seconds
  });
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [currentGuess, setCurrentGuess] = useState('');
  const [showResult, setShowResult] = useState(false);
  const toast = useToast();

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wordle-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...initialSettings, ...parsed });
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  // Save settings to localStorage
  const updateSettings = (newSettings: SettingsState) => {
    setSettings(newSettings);
    localStorage.setItem('wordle-settings', JSON.stringify(newSettings));
  };

  // Apply high contrast setting
  useEffect(() => {
    document.documentElement.setAttribute('data-contrast', settings.highContrast ? 'high' : 'normal');
  }, [settings.highContrast]);

  const submitGuessMutation = useMutation({
    mutationFn: ({ puzzleId, guess, hardMode }: { puzzleId: string; guess: string; hardMode: boolean }) =>
      submitDailyGuess(puzzleId, guess, hardMode),
    onSuccess: (response) => {
      console.log('🎯 Guess submitted successfully:', response);
      
      // Update the query cache immediately with the new data
      queryClient.setQueryData(['puzzle', 'daily'], (oldData: DailyPuzzlePayload | undefined) => {
        if (!oldData) return oldData;
        
        return {
          ...oldData,
          yourState: {
            ...oldData.yourState,
            status: response.status,
            attemptsUsed: response.attemptsUsed,
            lines: [...oldData.yourState.lines, response.line]
          }
        };
      });
      
      // Also invalidate the cache to ensure fresh data on next fetch
      queryClient.invalidateQueries({ queryKey: ['puzzle', 'daily'] });
      
      if (response.status === 'won' || response.status === 'lost') {
        triggerHaptic('success');
        setShowResult(true);
      } else {
        triggerHaptic('light');
      }
    },
    onError: (error) => {
      console.error('❌ Guess submission failed:', error);
      triggerHaptic('error');
      toast.notify(error instanceof Error ? error.message : 'Ошибка при отправке догадки');
    }
  });

  const lines = useMemo(() => data?.yourState.lines ?? [], [data]);
  const keyboardState = useMemo(() => buildKeyboardState(lines), [lines]);
  const length = data?.length ?? 5;
  const maxAttempts = data?.maxAttempts ?? 6;

  const handleKey = (letter: string) => {
    if (letter.length !== 1) {
      return;
    }
    if (currentGuess.length >= length) {
      return;
    }
    setCurrentGuess((prev) => prev + letter);
  };

  const handleBackspace = () => {
    setCurrentGuess((prev) => prev.slice(0, -1));
  };

  const handleEnter = () => {
    if (!data) {
      toast.notify('Загрузка данных...');
      return;
    }
    
    if (currentGuess.length !== length) {
      toast.notify('Слово должно быть нужной длины.');
      return;
    }
    
    if (submitGuessMutation.isPending) {
      toast.notify('Отправка догадки...');
      return;
    }
    
    console.log('🚀 Submitting guess:', currentGuess);
    submitGuessMutation.mutate({
      puzzleId: data.puzzleId,
      guess: currentGuess,
      hardMode: false // TODO: get from settings
    });
    
    setCurrentGuess('');
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800">
        <GameHeader
          title="Ежедневная загадка"
          subtitle="Загрузка..."
          backHref="/"
        />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm opacity-70">Загрузка загадки...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800">
        <GameHeader
          title="Ежедневная загадка"
          subtitle="Ошибка загрузки"
          backHref="/"
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-sm opacity-70">Не удалось загрузить загадку</p>
            <button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['puzzle', 'daily'] })}
              className="mt-2 text-sm text-blue-500 underline"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800">
      <GameHeader
        title="Ежедневная загадка"
        subtitle="Одна попытка в день, общий рейтинг"
        backHref="/"
        actions={
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full bg-blue-100 px-3 py-2 text-sm font-semibold text-slate-800"
          >
            Настройки
          </button>
        }
      />

      <section className="flex flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex items-center justify-between text-sm">
          <span>
            Попыток использовано: {lines.length} / {maxAttempts}
          </span>
          <span>Серия: 0</span>
        </div>
        <PuzzleGrid length={length} maxAttempts={maxAttempts} lines={lines} activeGuess={currentGuess} />
        <KeyboardCyr
          onKey={handleKey}
          onEnter={handleEnter}
          onBackspace={handleBackspace}
          keyStates={keyboardState}
          disabled={submitGuessMutation.isPending}
        />
      </section>

      <ResultModal
        open={showResult}
        status={data?.yourState.status ?? 'playing'}
        attemptsUsed={lines.length}
        onClose={() => setShowResult(false)}
        answer={undefined}
      />
      <SettingsSheet
        open={settingsOpen}
        state={settings}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
