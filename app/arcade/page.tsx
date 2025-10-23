'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { GameHeader } from '@/components/GameHeader';
import { KeyboardCyr } from '@/components/KeyboardCyr';
import { PuzzleGrid } from '@/components/PuzzleGrid';
import { ResultModal } from '@/components/ResultModal';
import { useToast } from '@/components/ToastCenter';
import { startArcade, submitArcadeGuess } from '@/lib/api';
import type { ArcadeStartResponse, GuessLine } from '@/lib/contracts';

const lengths: Array<ArcadeStartResponse['length']> = [4, 5, 6, 7];

export default function ArcadePage() {
  const toast = useToast();
  const [activeLength, setActiveLength] = useState<ArcadeStartResponse['length']>(5);
  const [session, setSession] = useState<ArcadeStartResponse | null>(null);
  const [lines, setLines] = useState<GuessLine[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [showResult, setShowResult] = useState(false);

  const startArcadeMutation = useMutation({
    mutationFn: (len: ArcadeStartResponse['length']) => startArcade(len, false),
    onSuccess: (sessionData) => {
      setSession(sessionData);
      setLines([]);
      setCurrentGuess('');
    },
    onError: (error) => {
      console.error(error);
      toast.notify('Не удалось запустить аркаду.');
    }
  });

  const submitGuessMutation = useMutation({
    mutationFn: ({ puzzleId, guess }: { puzzleId: string; guess: string }) =>
      submitArcadeGuess(puzzleId, guess),
    onSuccess: (response) => {
      setLines(prev => [...prev, response.line]);
      
      if (response.status === 'won' || response.status === 'lost') {
        setShowResult(true);
      }
    },
    onError: (error) => {
      toast.notify(error instanceof Error ? error.message : 'Ошибка при отправке догадки');
    }
  });

  const length = session?.length ?? activeLength;

  const handleStart = async (len: ArcadeStartResponse['length']) => {
    setActiveLength(len);
    try {
      await startArcadeMutation.mutateAsync(len);
    } catch (error) {
      // Error handled by mutation
    }
  };

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
    if (!session) {
      toast.notify('Сначала начните игру.');
      return;
    }
    if (currentGuess.length !== length) {
      toast.notify('Слово должно быть нужной длины.');
      return;
    }
    
    submitGuessMutation.mutate({
      puzzleId: session.puzzleId,
      guess: currentGuess
    });
    
    setCurrentGuess('');
  };

  return (
    <main className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      <GameHeader title="Аркада" subtitle="Режим без ограничений" backHref="/" />

      <section className="flex flex-col gap-6 px-4 py-6">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {lengths.map((len) => (
            <button
              key={len}
              type="button"
              onClick={() => handleStart(len)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                len === length ? 'bg-[var(--accent)] text-white' : 'bg-[var(--key-bg)] text-[var(--text)]'
              }`}
              disabled={startArcadeMutation.isPending}
            >
              {len} букв
            </button>
          ))}
        </div>

        {session ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span>
                Попыток использовано: {lines.length} / {session.maxAttempts}
              </span>
              <span>Аркада</span>
            </div>
            <PuzzleGrid length={length} maxAttempts={session.maxAttempts} lines={lines} activeGuess={currentGuess} />
            <KeyboardCyr onKey={handleKey} onEnter={handleEnter} onBackspace={handleBackspace} />
          </>
        ) : (
          <p className="rounded-3xl border border-dashed border-[color:var(--tile-border)] bg-[var(--panel)] px-4 py-10 text-center text-sm opacity-80">
            Выберите длину слова, чтобы начать новую игру. Режим MMR появится позже.
          </p>
        )}
      </section>

      <ResultModal
        open={showResult}
        status="playing"
        attemptsUsed={lines.length}
        onClose={() => setShowResult(false)}
      />
    </main>
  );
}
