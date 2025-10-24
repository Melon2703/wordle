'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyboardCyr } from '@/components/KeyboardCyr';
import { PuzzleGrid } from '@/components/PuzzleGrid';
import { ResultModal } from '@/components/ResultModal';
import { useToast } from '@/components/ToastCenter';
import { triggerHaptic } from '@/components/HapticsBridge';
import { startArcade, completeArcadeSession } from '@/lib/api';
import { buildKeyboardState } from '@/lib/game/feedback';
import { evaluateGuess, normalizeGuess } from '@/lib/game/feedback.client';
import type { ArcadeStartResponse, GuessLine } from '@/lib/contracts';

const lengths: Array<ArcadeStartResponse['length']> = [4, 5, 6, 7];

export default function ArcadePage() {
  const toast = useToast();
  const [activeLength, setActiveLength] = useState<ArcadeStartResponse['length'] | null>(null);
  const [session, setSession] = useState<ArcadeStartResponse | null>(null);
  const [lines, setLines] = useState<GuessLine[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  const startArcadeMutation = useMutation({
    mutationFn: (len: ArcadeStartResponse['length']) => startArcade(len, false),
    onSuccess: (sessionData) => {
      setSession(sessionData);
      setLines([]);
      setCurrentGuess('');
      setSessionStartTime(Date.now());
    },
    onError: (error) => {
      console.error(error);
      toast.notify('Не удалось запустить аркаду.');
    }
  });

  // Client-side evaluation for Arcade mode
  const evaluateGuessLocally = (guess: string): GuessLine => {
    if (!session) {
      throw new Error('No active session');
    }
    
    const normalizedGuess = normalizeGuess(guess, false);
    const feedback = evaluateGuess(normalizedGuess, session.solution);
    
    return {
      guess: normalizedGuess,
      submittedAt: new Date().toISOString(),
      feedback
    };
  };

  const keyboardState = buildKeyboardState(lines);
  const length = session?.length ?? activeLength ?? 5; // Default to 5 for UI purposes when no selection

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
    
    try {
      // Evaluate guess locally
      const line = evaluateGuessLocally(currentGuess);
      setLines(prev => [...prev, line]);
      
      // Check win/loss
      const isWin = line.feedback.every(f => f.state === 'correct');
      const isLost = !isWin && lines.length + 1 >= session.maxAttempts;
      
      if (isWin || isLost) {
        triggerHaptic('success');
        setShowResult(true);
        
        // Record session completion in background
        if (sessionStartTime) {
          const timeMs = Date.now() - sessionStartTime;
          completeArcadeSession(session.puzzleId, isWin ? 'won' : 'lost', lines.length + 1, timeMs)
            .then(() => {
              console.log('✅ Arcade session recorded successfully');
            })
            .catch((error) => {
              console.error('❌ Failed to record arcade session:', error);
              // Don't show error to user - game already completed locally
            });
        }
      } else {
        triggerHaptic('light');
      }
      
      setCurrentGuess('');
    } catch (error) {
      console.error('Local evaluation error:', error);
      triggerHaptic('error');
      toast.notify(error instanceof Error ? error.message : 'Ошибка при обработке догадки');
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800 pb-20">
      <section className="flex flex-1 flex-col px-2 mx-auto w-full max-w-lg">
        {session ? (
          <>
            <div className="pt-2 pb-4">
              <PuzzleGrid length={length} maxAttempts={session.maxAttempts} lines={lines} activeGuess={currentGuess} />
            </div>
            <div className="flex-1" />
            <KeyboardCyr 
              onKey={handleKey} 
              onEnter={handleEnter} 
              onBackspace={handleBackspace}
              keyStates={keyboardState}
            />
          </>
        ) : (
          <>
            {/* Title and subtitle header - only shown when no session */}
            <div className="mb-6">
              <h1 className="text-3xl font-semibold font-sans">Аркада</h1>
              <p className="mt-2 text-lg font-sans">Неограниченные попытки и гибкая длина слов</p>
            </div>

            <div className="rounded-3xl border border-dashed border-blue-200 bg-white px-4 py-10 text-center text-sm opacity-80">
            <p className="mb-6">Выберите длину слова, чтобы начать новую игру</p>
            
            {/* Word length selector */}
            <div className="flex justify-center">
              <div className="flex flex-wrap items-center gap-2">
                {lengths.map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => handleStart(len)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      len === activeLength 
                        ? 'bg-blue-500 text-white' 
                        : startArcadeMutation.isPending
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-100 text-slate-800 hover:bg-blue-200'
                    }`}
                    disabled={startArcadeMutation.isPending}
                  >
                    {len} букв
                  </button>
                ))}
              </div>
            </div>
          </div>
          </>
        )}
      </section>

      <ResultModal
        open={showResult}
        status={lines.length > 0 && lines[lines.length - 1].feedback.every(f => f.state === 'correct') ? 'won' : 'lost'}
        attemptsUsed={lines.length}
        onClose={() => setShowResult(false)}
      />
    </main>
  );
}
