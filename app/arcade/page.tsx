'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { KeyboardCyr } from '@/components/KeyboardCyr';
import { PuzzleGrid } from '@/components/PuzzleGrid';
import { PuzzleLoader } from '@/components/PuzzleLoader';
import { ResultScreen } from '@/components/ResultScreen';
import { ShareButton } from '@/components/ShareButton';
import { useToast } from '@/components/ToastCenter';
import { triggerHaptic } from '@/components/HapticsBridge';
import { Button, Card, Heading, Text } from '@/components/ui';
import { startArcade, completeArcadeSession, getDictionaryWords, callArcadeHint, checkArcadeSession, recordArcadeGuess, getArcadeStatus, unlockArcade } from '@/lib/api';
import { HintModal } from '@/components/HintModal';
import { TopCenterIcon } from '@/components/TopCenterIcon';
import { buildKeyboardState } from '@/lib/game/feedback';
import { evaluateGuess, normalizeGuess, validateDictionary } from '@/lib/game/feedback.client';
import type { ArcadeStartResponse, GuessLine } from '@/lib/contracts';

const allLengths: Array<ArcadeStartResponse['length']> = [4, 5, 6];

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
  const [availableLengths, setAvailableLengths] = useState<Array<ArcadeStartResponse['length']>>([5]);
  const [isHintModalOpen, setIsHintModalOpen] = useState(false);
  const [hintEntitlementsRemaining, setHintEntitlementsRemaining] = useState(0);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [isArcadeAvailable, setIsArcadeAvailable] = useState(true);
  const [newGameEntitlements, setNewGameEntitlements] = useState(0);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isConfirmingUnlock, setIsConfirmingUnlock] = useState(false);

  // Check arcade availability on mount
  useEffect(() => {
    getArcadeStatus()
      .then(status => {
        setIsArcadeAvailable(status.isArcadeAvailable);
        setNewGameEntitlements(status.newGameEntitlements);
      })
      .catch(error => {
        console.error('Failed to get arcade status:', error);
      });
  }, []);

  // Check Telegram user ID to determine available word lengths
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkTelegramUser = () => {
      const tg = (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } }).Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.id === 626033046) {
        setAvailableLengths(allLengths); // Show all lengths for specific user
      } else {
        setAvailableLengths([5]); // Only show 5-letter words for regular users
      }
    };

    // Try immediately
    checkTelegramUser();
    
    // Also try after a delay in case Telegram isn't ready yet
    const timeout = setTimeout(checkTelegramUser, 1000);
    return () => clearTimeout(timeout);
  }, []);

  const startArcadeMutation = useMutation({
    mutationFn: (len: ArcadeStartResponse['length']) => startArcade(len, false),
    onSuccess: async (sessionData) => {
      setSession(sessionData);
      setHintEntitlementsRemaining(sessionData.hintEntitlementsAvailable);
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
    // why: normalize both guess and solution to lowercase for consistent comparison
    const feedback = evaluateGuess(normalizedGuess.toLowerCase(), session.solution.toLowerCase());
    
    return {
      guess: normalizedGuess,
      submittedAt: new Date().toISOString(),
      feedback
    };
  };

  // Check for incomplete arcade session on mount
  const { data: incompleteSession } = useQuery({
    queryKey: ['arcade', 'incomplete-session'],
    queryFn: checkArcadeSession,
    staleTime: 30 * 1000,
  });

  // Restore incomplete session if found
  useEffect(() => {
    if (incompleteSession?.hasIncomplete && incompleteSession.session && incompleteSession.lines) {
      try {
        // Validate session data
        if (!incompleteSession.session.solution || !incompleteSession.session.sessionId) {
          console.error('Invalid session data detected');
          toast.notify('Не удалось восстановить игру. Начните новую.');
          return;
        }
        
        setSession(incompleteSession.session);
        setLines(incompleteSession.lines);
        setHintEntitlementsRemaining(incompleteSession.session.hintEntitlementsAvailable);
        
        // Set session start time
        if (incompleteSession.startedAt) {
          const startedAtMs = new Date(incompleteSession.startedAt).getTime();
          const elapsedMs = Date.now() - startedAtMs;
          setSessionStartTime(Date.now() - elapsedMs);
        } else {
          setSessionStartTime(Date.now());
        }
        
        // Set active length
        setActiveLength(incompleteSession.session.length);
        
        // Fetch dictionary if not cached
        if (!dictionaryCache.has(incompleteSession.session.length)) {
          getDictionaryWords(incompleteSession.session.length)
            .then(dictionary => {
              setDictionaryCache(prev => new Map(prev).set(incompleteSession.session!.length, dictionary));
            })
            .catch(error => {
              console.error('Failed to load dictionary:', error);
              toast.notify('Не удалось загрузить словарь. Проверка слов недоступна.');
            });
        }
        
      } catch (error) {
        console.error('Error restoring session:', error);
        toast.notify('Ошибка при восстановлении игры. Начните новую.');
        // Clear the invalid session state
        setSession(null);
        setLines([]);
        setSessionStartTime(null);
        setActiveLength(null);
      }
    }
  }, [incompleteSession, dictionaryCache, toast]);

  // Get user status for arcade solved count
  const { data: userStatus } = useQuery({
    queryKey: ['user', 'status'],
    queryFn: () => fetch('/api/user/status').then(res => res.json()),
    staleTime: 30 * 1000,
  });

  const keyboardState = buildKeyboardState(lines);
  const length = session?.length ?? activeLength ?? 5; // Default to 5 for UI purposes when no selection

  const handleUseHint = async () => {
    if (!session?.sessionId) return;
    
    setIsLoadingHint(true);
    try {
      const response = await callArcadeHint(session.sessionId);
      setSession(prev => prev ? { ...prev, hintsUsed: response.hints } : null);
      setHintEntitlementsRemaining(response.entitlementsRemaining);
    } catch (error) {
      console.error('Failed to use hint:', error);
      toast.notify('Не удалось использовать подсказку');
    } finally {
      setIsLoadingHint(false);
    }
  };

  const handleUnlockArcade = async () => {
    setIsConfirmingUnlock(false);
    setIsUnlocking(true);
    try {
      await unlockArcade();
      setIsArcadeAvailable(true);
      setNewGameEntitlements(prev => prev - 1);
      toast.notify('Аркада разблокирована!');
    } catch (error) {
      console.error('Failed to unlock arcade:', error);
      toast.notify('Не удалось разблокировать аркаду');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleBuyGames = () => {
    window.location.href = '/shop';
  };

  const handleStart = async (len: ArcadeStartResponse['length']) => {
    setActiveLength(len);
    try {
      await startArcadeMutation.mutateAsync(len);
    } catch (error) {
      // Reset activeLength when API call fails
      setActiveLength(null);
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
      
      // Record guess in database (background, non-blocking)
      const guessIndex = lines.length + 1;
      const feedbackMask = JSON.stringify(line.feedback.map(f => f.state));
      const normalizedGuess = normalizeGuess(currentGuess, false);
      
      recordArcadeGuess(
        session.sessionId,
        guessIndex,
        currentGuess, // original input
        normalizedGuess, // normalized
        feedbackMask
      ).catch(error => {
        console.error('Failed to record guess:', error);
        // Don't block UI - game continues locally
      });
      
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
    <main className="page-container">
        <section className="flex flex-1 flex-col px-4 mx-auto w-full max-w-lg">
        {session ? (
          <>
            {/* Hint Modal */}
            <HintModal
              isOpen={isHintModalOpen}
              onClose={() => setIsHintModalOpen(false)}
              hints={session.hintsUsed}
              entitlementsRemaining={hintEntitlementsRemaining}
              onUseHint={handleUseHint}
              isLoading={isLoadingHint}
            />

            {/* Hint Icon */}
            {!showResult && (
              <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none h-12">
                <TopCenterIcon 
                  onClick={() => setIsHintModalOpen(true)}
                  badgeCount={session.hintsUsed.length}
                />
              </div>
            )}

            {/* Result Screen */}
            {showResult && (
              <div className="transition-all duration-500 ease-in-out opacity-100 translate-y-0">
                <ResultScreen
                  status={lines.length > 0 && lines[lines.length - 1].feedback.every(f => f.state === 'correct') ? 'won' : 'lost'}
                  attemptsUsed={lines.length}
                  mode="arcade"
                  timeMs={sessionStartTime ? Date.now() - sessionStartTime : undefined}
                  arcadeSolved={userStatus?.arcadeSolved}
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

            {/* Arcade Result Buttons - positioned at bottom above nav */}
            {showResult && session && (
              <div className="mt-auto">
                <div className="grid grid-cols-2 gap-3">
                  <Button fullWidth onClick={() => window.location.href = '/arcade'}>
                    Новая игра
                  </Button>
                  <ShareButton
                    mode="arcade"
                    puzzleId={session.puzzleId}
                    status={lines.length > 0 && lines[lines.length - 1].feedback.every(f => f.state === 'correct') ? 'won' : 'lost'}
                    attemptsUsed={lines.length}
                    timeMs={sessionStartTime ? Date.now() - sessionStartTime : undefined}
                    lines={lines}
                    arcadeSolved={userStatus?.arcadeSolved}
                  />
                </div>
              </div>
            )}

            {/* Share Button - only show when game is completed */}

            {/* Keyboard with animation */}
            <div className={`transition-all duration-300 -mx-4 ${
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
              <Heading level={2}>Аркада</Heading>
              <Text className="mt-2">Неограниченные попытки и гибкая длина слов</Text>
            </div>

            <Card padding="lg" className="text-center">
              {startArcadeMutation.isPending ? (
                <div className="flex justify-center">
                  <PuzzleLoader length={activeLength ?? 5} />
                </div>
              ) : !isArcadeAvailable ? (
                <>
                  <Heading level={3} className="mb-4">Аркада недоступна</Heading>
                  <Text className="mb-6">Аркада доступна раз в день. Используйте дополнительную игру?</Text>
                  
                  {newGameEntitlements > 0 ? (
                    <>
                      {!isConfirmingUnlock ? (
                        <Button
                          fullWidth
                          variant="primary"
                          onClick={() => setIsConfirmingUnlock(true)}
                          disabled={isUnlocking}
                        >
                          {isUnlocking ? 'Загрузка...' : `Использовать игру (${newGameEntitlements} шт.)`}
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            onClick={() => setIsConfirmingUnlock(false)}
                            className="flex-1"
                            disabled={isUnlocking}
                          >
                            Отмена
                          </Button>
                          <Button
                            variant="primary"
                            onClick={handleUnlockArcade}
                            disabled={isUnlocking}
                            className="flex-1"
                          >
                            {isUnlocking ? 'Загрузка...' : 'Подтвердить'}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <Button
                      fullWidth
                      variant="primary"
                      onClick={handleBuyGames}
                    >
                      Купить игры
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Text className="mb-6">Выберите длину слова, чтобы начать новую игру</Text>
                  
                  {/* Word length selector */}
                  <div className="flex justify-center">
                    <div className="flex flex-wrap items-center gap-2">
                      {availableLengths.map((len) => (
                        <Button
                          key={len}
                          onClick={() => handleStart(len)}
                          variant={len === activeLength ? 'primary' : 'secondary'}
                          size="sm"
                          className="rounded-full"
                        >
                          {len} букв
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </Card>
          </>
        )}
      </section>
    </main>
  );
}
