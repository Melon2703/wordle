'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyboardCyr } from '@/components/KeyboardCyr';
import { PuzzleGrid } from '@/components/PuzzleGrid';
import { PuzzleLoader } from '@/components/PuzzleLoader';
import { ResultScreen } from '@/components/ResultScreen';
import { useToast } from '@/components/ToastCenter';
import { triggerHaptic } from '@/components/HapticsBridge';
import { startArcade, completeArcadeSession, getDictionaryWords } from '@/lib/api';
import { buildKeyboardState } from '@/lib/game/feedback';
import { evaluateGuess, normalizeGuess, validateDictionary } from '@/lib/game/feedback.client';
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
  const [dictionaryCache, setDictionaryCache] = useState<Map<number, Set<string>>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const startArcadeMutation = useMutation({
    mutationFn: (len: ArcadeStartResponse['length']) => startArcade(len, false),
    onSuccess: async (sessionData) => {
      setSession(sessionData);
      setLines([]);
      setCurrentGuess('');
      setSessionStartTime(Date.now());
      setIsSubmitting(false);
      
      // Fetch dictionary if not cached
      if (!dictionaryCache.has(sessionData.length)) {
        try {
          const dictionary = await getDictionaryWords(sessionData.length);
          setDictionaryCache(prev => new Map(prev).set(sessionData.length, dictionary));
        } catch (error) {
          console.error('Failed to load dictionary:', error);
          toast.notify('Не удалось загрузить словарь. Проверка слов недоступна.');
        }
      }
    },
    onError: (error) => {
      console.error(error);
      toast.notify('Не удалось запустить аркаду.');
      // Reset activeLength when mutation fails
      setActiveLength(null);
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
      // Reset activeLength when API call fails
      setActiveLength(null);
    }
  };

  const handleNewGame = (len: ArcadeStartResponse['length']) => {
    setShowResult(false);
    setSession(null);
    setLines([]);
    setCurrentGuess('');
    setSessionStartTime(null);
    setIsSubmitting(false);
    handleStart(len);
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
      setCurrentGuess('');
      return;
    }
    
    if (isSubmitting) {
      toast.notify('Обработка догадки...');
      return;
    }
    
    // Validate dictionary if available
    const dictionary = dictionaryCache.get(session.length);
    if (dictionary && !validateDictionary(currentGuess, dictionary)) {
      toast.notify('Слово не найдено в словаре.');
      setCurrentGuess('');
      return;
    }
    
    setIsSubmitting(true);
    
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
      triggerHaptic('error');
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при обработке догадки';
      toast.notify(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-blue-50 text-slate-800 pb-20">
      <section className="flex flex-1 flex-col px-2 mx-auto w-full max-w-lg">
        {session ? (
          <>
            {/* Result Screen */}
            {showResult && (
              <div className="transition-all duration-500 ease-in-out opacity-100 translate-y-0">
                <ResultScreen
                  status={lines.length > 0 && lines[lines.length - 1].feedback.every(f => f.state === 'correct') ? 'won' : 'lost'}
                  attemptsUsed={lines.length}
                  mode="arcade"
                  timeMs={sessionStartTime ? Date.now() - sessionStartTime : undefined}
                  onNewGame={handleNewGame}
                  length={length}
                  lines={lines}
                />
              </div>
            )}

            {!showResult && (
              <div className="pt-2 pb-4">
                <PuzzleGrid 
                  length={length} 
                  maxAttempts={session.maxAttempts} 
                  lines={lines} 
                  activeGuess={currentGuess} 
                />
              </div>
            )}

            {!showResult && <div className="flex-1" />}

            {/* Share Button - only show when game is completed */}
            {showResult && (
              <>
                <div className="flex-1" />
                <div className="mb-4">
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-xl bg-gray-300 px-4 py-3 text-sm font-semibold text-gray-500 cursor-not-allowed"
                    title="Share functionality coming soon"
                  >
                    Поделиться результатом
                  </button>
                  <p className="text-xs text-slate-500 text-center mt-2">
                    Функция поделиться будет доступна в следующих обновлениях
                  </p>
                </div>
              </>
            )}

            {/* Keyboard with animation */}
            <div className={`transition-all duration-300 ${
              showResult ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100'
            }`}>
              <KeyboardCyr 
                onKey={handleKey} 
                onEnter={handleEnter} 
                onBackspace={handleBackspace}
                keyStates={keyboardState}
                disableEnter={currentGuess.length !== length}
                disabled={isSubmitting}
              />
            </div>
          </>
        ) : (
          <>
            {/* Title and subtitle header - only shown when no session */}
            <div className="mb-6">
              <h1 className="text-3xl font-semibold font-sans">Аркада</h1>
              <p className="mt-2 text-lg font-sans">Неограниченные попытки и гибкая длина слов</p>
            </div>

            <div className="rounded-3xl border border-dashed border-blue-200 bg-white px-4 py-10 text-center text-sm opacity-80">
            {startArcadeMutation.isPending ? (
              <div className="flex justify-center">
                <PuzzleLoader length={activeLength ?? 5} />
              </div>
            ) : (
              <>
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
                            : 'bg-blue-100 text-slate-800 hover:bg-blue-200'
                        }`}
                      >
                        {len} букв
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          </>
        )}
      </section>
    </main>
  );
}
