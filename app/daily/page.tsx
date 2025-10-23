'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GameHeader } from '@/components/GameHeader';
import { KeyboardCyr } from '@/components/KeyboardCyr';
import { PuzzleGrid } from '@/components/PuzzleGrid';
import { ResultModal } from '@/components/ResultModal';
import { SettingsSheet } from '@/components/SettingsSheet';
import { useToast } from '@/components/ToastCenter';
import { getDailyPuzzle } from '@/lib/api';
import type { GuessLine, LetterState } from '@/lib/contracts';

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
  const { data } = useQuery({ queryKey: ['puzzle', 'daily'], queryFn: getDailyPuzzle });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [currentGuess, setCurrentGuess] = useState('');
  const [showResult, setShowResult] = useState(false);
  const toast = useToast();

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
    if (currentGuess.length !== length) {
      toast.notify('Слово должно быть нужной длины.');
      return;
    }
    toast.notify('Отправка догадки скоро появится.');
    setShowResult(true);
  };

  return (
    <main className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      <GameHeader
        title="Ежедневная загадка"
        subtitle="Одна попытка в день, общий рейтинг"
        backHref="/"
        actions={
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-full bg-[var(--key-bg)] px-3 py-2 text-sm font-semibold text-[var(--text)]"
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
        onChange={setSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
