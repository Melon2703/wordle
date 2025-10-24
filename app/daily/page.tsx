'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyboardCyr } from '@/components/KeyboardCyr';
import { PuzzleGrid } from '@/components/PuzzleGrid';
import { ResultModal } from '@/components/ResultModal';
import { useToast } from '@/components/ToastCenter';
import { triggerHaptic } from '@/components/HapticsBridge';
import { getDailyPuzzle, submitDailyGuess } from '@/lib/api';
import { buildKeyboardState } from '@/lib/game/feedback';
import type { DailyPuzzlePayload } from '@/lib/contracts';

export default function DailyPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ 
    queryKey: ['puzzle', 'daily'], 
    queryFn: getDailyPuzzle,
    staleTime: 30 * 1000 // 30 seconds
  });
  
  const [currentGuess, setCurrentGuess] = useState('');
  const [submittingGuess, setSubmittingGuess] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const toast = useToast();

  const submitGuessMutation = useMutation({
    mutationFn: ({ puzzleId, guess, hardMode }: { puzzleId: string; guess: string; hardMode: boolean }) =>
      submitDailyGuess(puzzleId, guess, hardMode),
    onSuccess: (response) => {
      console.log('🎯 Guess submitted successfully:', response);
      
      // Clear submitting state
      setSubmittingGuess(null);
      
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
      setSubmittingGuess(null);
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
    
    // Set submitting state and clear current guess
    setSubmittingGuess(currentGuess);
    setCurrentGuess('');
    
    submitGuessMutation.mutate({
      puzzleId: data.puzzleId,
      guess: submittingGuess || currentGuess,
      hardMode: false // TODO: get from settings
    });
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm opacity-70">Загрузка загадки...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800">
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
    <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800 pb-20">
      <section className="flex flex-1 flex-col px-2 mx-auto w-full max-w-lg">
        <div className="pt-2 pb-4">
          <PuzzleGrid 
            length={length} 
            maxAttempts={maxAttempts} 
            lines={lines} 
            activeGuess={currentGuess}
            pendingGuess={submittingGuess}
          />
        </div>
        <div className="flex-1" />
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
    </main>
  );
}
