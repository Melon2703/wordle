'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyboardCyr } from '@/components/KeyboardCyr';
import { PuzzleGrid } from '@/components/PuzzleGrid';
import { LoadingFallback } from '@/components/LoadingFallback';
import { ResultScreen } from '@/components/ResultScreen';
import { ShareButton } from '@/components/ShareButton';
import { useToast } from '@/components/ToastCenter';
import { triggerHaptic } from '@/components/HapticsBridge';
import { Button } from '@/components/ui';
import { getDailyPuzzle, submitDailyGuess, getUserStatus } from '@/lib/api';
import { buildKeyboardState } from '@/lib/game/feedback';
import type { DailyPuzzlePayload } from '@/lib/contracts';

export default function DailyPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ 
    queryKey: ['puzzle', 'daily'], 
    queryFn: getDailyPuzzle,
    staleTime: 30 * 1000 // 30 seconds
  });

  const { data: userStatus } = useQuery({
    queryKey: ['user', 'status'],
    queryFn: getUserStatus,
    staleTime: 30 * 1000,
  });
  
  const [currentGuess, setCurrentGuess] = useState('');
  const [submittingGuess, setSubmittingGuess] = useState<string | null>(null);
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
      queryClient.invalidateQueries({ queryKey: ['user', 'status'] });
      
      if (response.status === 'won' || response.status === 'lost') {
        triggerHaptic('success');
      } else {
        triggerHaptic('light');
      }
    }
  });

  const lines = useMemo(() => data?.yourState.lines ?? [], [data]);
  const keyboardState = useMemo(() => buildKeyboardState(lines), [lines]);
  const length = data?.length ?? 5;
  
  // Derive result state from game data instead of local state
  const isGameCompleted = data?.yourState.status === 'won' || data?.yourState.status === 'lost';

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

  const handleEnter = async () => {
    if (!data) {
      toast.notify('Загрузка данных...');
      return;
    }
    
    if (currentGuess.length !== length) {
      toast.notify('Слово должно быть нужной длины.');
      setCurrentGuess('');
      return;
    }
    
    if (submitGuessMutation.isPending) {
      toast.notify('Отправка догадки...');
      return;
    }
    
    // Capture the guess value before state updates to avoid race condition
    const guessToSubmit = currentGuess;
    
    // Set submitting state and clear current guess
    setSubmittingGuess(guessToSubmit);
    setCurrentGuess('');
    
    try {
      await submitGuessMutation.mutateAsync({
        puzzleId: data.puzzleId,
        guess: guessToSubmit,
        hardMode: false // TODO: get from settings
      });
    } catch (error) {
      triggerHaptic('error');
      setSubmittingGuess(null);
      
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при отправке догадки';
      toast.notify(errorMessage);
    }
  };

  if (isLoading) {
    return <LoadingFallback length={5} />;
  }

  if (error) {
    return (
      <main className="page-container">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-caption">Не удалось загрузить загадку</p>
            <Button 
              variant="ghost"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['puzzle', 'daily'] })}
              className="mt-2"
            >
              Попробовать снова
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-container">
      <section className="flex flex-1 flex-col px-4 mx-auto w-full max-w-lg">
        {/* Result Screen */}
        {isGameCompleted && (
          <div className="transition-all duration-500 ease-in-out opacity-100 translate-y-0">
            <ResultScreen
              status={data?.yourState.status === 'won' ? 'won' : 'lost'}
              attemptsUsed={lines.length}
              answer={data?.answer}
              mode="daily"
              timeMs={data?.yourState.timeMs}
              streak={userStatus?.streak}
              length={length}
              lines={lines}
            />
          </div>
        )}

        {!isGameCompleted && (
          <div className="pt-2 pb-4">
            <PuzzleGrid 
              length={length} 
              maxAttempts={6} 
              lines={lines} 
              activeGuess={currentGuess}
              pendingGuess={submittingGuess}
            />
          </div>
        )}

        {!isGameCompleted && <div className="flex-1" />}

        {/* Share Button - only show when game is completed */}
        {isGameCompleted && data && data.yourState.status !== 'playing' && (
          <div className="mt-auto">
            <ShareButton
              mode="daily"
              puzzleId={data.puzzleId}
              status={data.yourState.status}
              attemptsUsed={lines.length}
              timeMs={data.yourState.timeMs}
              lines={lines}
              streak={userStatus?.streak}
            />
          </div>
        )}

        {/* Keyboard with animation */}
        <div className={`transition-all duration-300 -mx-4 ${
          isGameCompleted ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100'
        }`}>
          <KeyboardCyr
            onKey={handleKey}
            onEnter={handleEnter}
            onBackspace={handleBackspace}
            keyStates={keyboardState}
            disabled={submitGuessMutation.isPending}
            disableEnter={currentGuess.length !== length}
          />
        </div>
      </section>
    </main>
  );
}
