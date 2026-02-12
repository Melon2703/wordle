'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyboardCyr } from '@/components/KeyboardCyr';
import { PuzzleGrid } from '@/components/PuzzleGrid';
import { PuzzleLoader } from '@/components/PuzzleLoader';
import { LoadingFallback } from '@/components/LoadingFallback';
import { ResultScreen } from '@/components/ResultScreen';
import { ShareButton } from '@/components/ShareButton';
import { SaveWordButton } from '@/components/SaveWordButton';
import { useToast } from '@/components/ToastCenter';
import { triggerHaptic } from '@/components/HapticsBridge';
import { Button, Card, Heading, Text } from '@/components/ui';
import { startArcade, completeArcadeSession, getDictionaryWords, callArcadeHint, checkArcadeSession, recordArcadeGuess, getArcadeStatus, unlockArcade, useExtraTry as callUseExtraTry, finishExtraTry, purchaseProduct, cleanupCancelledPurchase, getUserStatus } from '@/lib/api';
import { invoice } from '@tma.js/sdk';
import { HintModal } from '@/components/HintModal';
import { ExtraTryModal } from '@/components/ExtraTryModal';
import { TopCenterIcon } from '@/components/TopCenterIcon';
import { buildKeyboardState } from '@/lib/game/feedback';
import { evaluateGuess, normalizeGuess, validateDictionary } from '@/lib/game/feedback.client';
import type { ArcadeStartResponse, GuessLine, ArcadeTheme } from '@/lib/types';
import { hasTelegramInitData, waitForTelegramInitData } from '@/lib/telegram';
import { trackEvent } from '@/lib/analytics';

const allLengths: Array<ArcadeStartResponse['length']> = [4, 5, 6];
const defaultLength: ArcadeStartResponse['length'] = 5;
const defaultTheme: ArcadeTheme = 'common';
const themeOptions: Array<{ value: ArcadeTheme; label: string }> = [
  { value: 'common', label: 'Обычные слова' },
  { value: 'music', label: 'Музыка' }
];

const getDictionaryKey = (length: ArcadeStartResponse['length'], theme: ArcadeTheme) => `${theme}-${length}`;

export default function ArcadePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeLength, setActiveLength] = useState<ArcadeStartResponse['length']>(defaultLength);
  const [activeTheme, setActiveTheme] = useState<ArcadeTheme>(defaultTheme);
  const [session, setSession] = useState<ArcadeStartResponse | null>(null);
  const [lines, setLines] = useState<GuessLine[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [dictionaryCache, setDictionaryCache] = useState<Map<string, Set<string>>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableLengths, setAvailableLengths] = useState<Array<ArcadeStartResponse['length']>>([5]);
  const [isHintModalOpen, setIsHintModalOpen] = useState(false);
  const [hintEntitlementsRemaining, setHintEntitlementsRemaining] = useState(0);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [arcadeCredits, setArcadeCredits] = useState(0);
  const [newGameEntitlements, setNewGameEntitlements] = useState(0);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isConfirmingUnlock, setIsConfirmingUnlock] = useState(false);
  const [extraTryEntitlements, setExtraTryEntitlements] = useState(0);
  const [showExtraTryModal, setShowExtraTryModal] = useState(false);
  const [isUsingExtraTry, setIsUsingExtraTry] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [isTelegramReady, setIsTelegramReady] = useState(() => hasTelegramInitData());
  
  // Track pending record requests
  const pendingRecords = useRef<Promise<unknown>[]>([]);
  const sessionRestoredRef = useRef(false);
  const extraTryPromptLoggedRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const maxArcadeCredits = 3;

  // Check arcade availability on mount
  useEffect(() => {
    let isMounted = true;

    setIsStatusLoading(true);

    getArcadeStatus()
      .then(status => {
        if (!isMounted) {
          return;
        }
        const credits = Math.max(0, Math.min(status.arcadeCredits ?? 0, maxArcadeCredits));
        setArcadeCredits(credits);
        setNewGameEntitlements(status.newGameEntitlements);
      })
      .catch(() => {
        // Error loading arcade status
      })
      .finally(() => {
        if (isMounted) {
          setIsStatusLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isTelegramReady) {
      return;
    }

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const pollTelegram = () => {
      if (!isMounted) {
        return;
      }

      if (hasTelegramInitData()) {
        setIsTelegramReady(true);
        return;
      }

      timeoutId = setTimeout(pollTelegram, 100);
    };

    pollTelegram();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isTelegramReady]);

  const ensureTelegramReady = useCallback(async () => {
    if (isTelegramReady) {
      return true;
    }

    const ready = await waitForTelegramInitData({ timeoutMs: 4000, intervalMs: 100 });
    if (!ready) {
      toast.notify('Телеграм еще загружается, попробуйте чуть позже');
      return false;
    }

    setIsTelegramReady(true);
    return true;
  }, [isTelegramReady, toast]);

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

  useEffect(() => {
    if (availableLengths.length === 0) {
      return;
    }

    if (!availableLengths.includes(activeLength)) {
      setActiveLength(availableLengths[0]);
    }
  }, [availableLengths, activeLength]);

  const handleSelectLength = (len: ArcadeStartResponse['length']) => {
    setActiveLength(len);
    trackEvent('arcade_length_selected', {
      mode: 'arcade',
      word_length: len
    });
  };

  const handleSelectTheme = (theme: ArcadeTheme) => {
    setActiveTheme(theme);
    trackEvent('arcade_theme_selected', {
      mode: 'arcade',
      theme
    });
  };

  const handleHintIconClick = () => {
    trackEvent('arcade_hint_icon_opened', {
      mode: 'arcade',
      hint_count: session?.hintsUsed.length ?? 0
    });
    setIsHintModalOpen(true);
  };

  const handleNewGameClick = () => {
    const lastLine = lines[lines.length - 1];
    const lastResult = lastLine && lastLine.feedback.every((tile) => tile.state === 'correct') ? 'win' : 'loss';
    trackEvent('arcade_new_game_clicked', {
      mode: 'arcade',
      last_result: lastResult,
      attempts_used: lines.length
    });
    window.location.href = '/arcade';
  };

  const startArcadeMutation = useMutation({
    mutationFn: ({ length, theme }: { length: ArcadeStartResponse['length']; theme: ArcadeTheme }) => startArcade(length, theme, false),
    onSuccess: async (sessionData) => {
      setSession(sessionData);
      setHintEntitlementsRemaining(sessionData.hintEntitlementsAvailable);
      setExtraTryEntitlements(sessionData.extraTryEntitlementsAvailable);
      setLines([]);
      setCurrentGuess('');
      setSessionStartTime(Date.now());
      setIsSubmitting(false);
      sessionStartedRef.current = true;
      sessionRestoredRef.current = false;
      extraTryPromptLoggedRef.current = false;

      trackEvent('arcade_session_started', {
        mode: 'arcade',
        word_length: sessionData.length,
        theme: sessionData.theme,
        hint_entitlements: sessionData.hintEntitlementsAvailable,
        extra_try_entitlements: sessionData.extraTryEntitlementsAvailable
      });
      
      // Fetch dictionary if not cached
      const cacheKey = getDictionaryKey(sessionData.length, sessionData.theme);
      if (!dictionaryCache.has(cacheKey)) {
        try {
          const dictionary = await getDictionaryWords(sessionData.length, sessionData.theme);
          setDictionaryCache(prev => {
            const next = new Map(prev);
            next.set(cacheKey, dictionary);
            return next;
          });
        } catch {
          toast.notify('Не удалось загрузить словарь. Проверка слов недоступна.');
        }
      }

      queryClient.invalidateQueries({ queryKey: ['arcade', 'incomplete-session'] });
      queryClient.invalidateQueries({ queryKey: ['arcade', 'status'] });
    },
    onError: () => {
      toast.notify('Не удалось запустить аркаду.');
      trackEvent('arcade_session_start_failed', {
        mode: 'arcade',
        word_length: activeLength,
        theme: activeTheme
      });
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
  const { data: incompleteSession, isLoading: isIncompleteSessionLoading } = useQuery({
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
          toast.notify('Не удалось восстановить игру. Начните новую.');
          return;
        }
        
        setSession(incompleteSession.session);
        setLines(incompleteSession.lines);
        setHintEntitlementsRemaining(incompleteSession.session.hintEntitlementsAvailable);
        setExtraTryEntitlements(incompleteSession.session.extraTryEntitlementsAvailable);
        sessionStartedRef.current = true;

        if (!sessionRestoredRef.current) {
          sessionRestoredRef.current = true;
          trackEvent('arcade_session_restored', {
            mode: 'arcade',
            word_length: incompleteSession.session.length,
            lines_count: incompleteSession.lines.length,
            extra_try_entitlements: incompleteSession.session.extraTryEntitlementsAvailable
          });
        }
        
        // Check if this is a last-attempt loss that should show the extra try modal
        if (incompleteSession.lines.length > 0) {
          const lastLine = incompleteSession.lines[incompleteSession.lines.length - 1];
          const isWin = lastLine.feedback.every(f => f.state === 'correct');
          const isLastAttempt = incompleteSession.lines.length >= incompleteSession.session.maxAttempts;
          
          if (!isWin && isLastAttempt) {
            if (!extraTryPromptLoggedRef.current) {
              extraTryPromptLoggedRef.current = true;
              trackEvent('arcade_extra_try_prompt_shown', {
                mode: 'arcade',
                attempts_used: incompleteSession.lines.length,
                remaining_entitlements: incompleteSession.session.extraTryEntitlementsAvailable
              });
            }
            setShowExtraTryModal(true);
          }
        }
        
        // Set session start time
        if (incompleteSession.startedAt) {
          const startedAtMs = new Date(incompleteSession.startedAt).getTime();
          const elapsedMs = Date.now() - startedAtMs;
          setSessionStartTime(Date.now() - elapsedMs);
        } else {
          setSessionStartTime(Date.now());
        }
        
        const sessionTheme = incompleteSession.session.theme ?? defaultTheme;

        // Set active selectors to match restored session
        setActiveLength(incompleteSession.session.length);
        setActiveTheme(sessionTheme);
        
        // Fetch dictionary if not cached
        const cacheKey = getDictionaryKey(incompleteSession.session.length, sessionTheme);
        if (!dictionaryCache.has(cacheKey)) {
          getDictionaryWords(incompleteSession.session.length, sessionTheme)
            .then(dictionary => {
              setDictionaryCache(prev => {
                const next = new Map(prev);
                next.set(cacheKey, dictionary);
                return next;
              });
            })
            .catch(() => {
              toast.notify('Не удалось загрузить словарь. Проверка слов недоступна.');
            });
        }
        
      } catch {
        toast.notify('Ошибка при восстановлении игры. Начните новую.');
        // Clear the invalid session state
        setSession(null);
        setLines([]);
        setSessionStartTime(null);
        setActiveLength(defaultLength);
        setActiveTheme(defaultTheme);
      }
    }
  }, [incompleteSession, dictionaryCache, toast]);

  // Guard effect to ensure modal state stays consistent with session+lines
  useEffect(() => {
    if (session && lines.length > 0 && !showResult) {
      const lastLine = lines[lines.length - 1];
      const isWin = lastLine.feedback.every(f => f.state === 'correct');
      const isLastAttempt = lines.length >= session.maxAttempts;
      
      if (!isWin && isLastAttempt && !showExtraTryModal) {
        if (!extraTryPromptLoggedRef.current) {
          extraTryPromptLoggedRef.current = true;
          trackEvent('arcade_extra_try_prompt_shown', {
            mode: 'arcade',
            attempts_used: lines.length,
            remaining_entitlements: extraTryEntitlements
          });
        }
        setShowExtraTryModal(true);
      }
    }
  }, [session, lines, showResult, showExtraTryModal, extraTryEntitlements]);

  // Get user status for arcade solved count
  const { data: userStatus } = useQuery({
    queryKey: ['user', 'status'],
    queryFn: getUserStatus,
    staleTime: 30 * 1000,
  });

  const keyboardState = buildKeyboardState(lines);
  const length = session?.length ?? activeLength;

  if (isStatusLoading || isIncompleteSessionLoading) {
    return <LoadingFallback length={activeLength} />;
  }

  const handleUseHint = async () => {
    if (!session?.sessionId) return;
    
    setIsLoadingHint(true);
    try {
      const response = await callArcadeHint(session.sessionId);
      setSession(prev => prev ? { ...prev, hintsUsed: response.hints } : null);
      setHintEntitlementsRemaining(response.entitlementsRemaining);
      queryClient.invalidateQueries({ queryKey: ['arcade', 'incomplete-session'] });
      trackEvent('arcade_hint_used', {
        mode: 'arcade',
        remaining_entitlements: response.entitlementsRemaining,
        hint_count: response.hints.length
      });
    } catch {
      toast.notify('Не удалось использовать подсказку');
      trackEvent('arcade_hint_failed', { mode: 'arcade' });
    } finally {
      setIsLoadingHint(false);
    }
  };

  const handleHintPurchaseComplete = async () => {
    // Refresh hint entitlements after purchase
    if (session?.sessionId) {
      try {
        const sessionData = await checkArcadeSession();
        if (sessionData.hasIncomplete && sessionData.session) {
          const updatedSession = sessionData.session;
          setHintEntitlementsRemaining(updatedSession.hintEntitlementsAvailable);
          // Also update session state if needed
          setSession(prev => prev ? {
            ...prev,
            hintEntitlementsAvailable: updatedSession.hintEntitlementsAvailable
          } : null);
          queryClient.invalidateQueries({ queryKey: ['arcade', 'incomplete-session'] });
        }
      } catch {
        // If session check fails, we can't refresh entitlements
      }
    }
    queryClient.invalidateQueries({ queryKey: ['purchases'] });
    queryClient.invalidateQueries({ queryKey: ['arcade', 'incomplete-session'] });
    trackEvent('arcade_hint_purchase_flow', {
      mode: 'arcade',
      product_id: 'arcade_hint',
      stage: 'completed'
    });
  };

  const handleUnlockArcade = async () => {
    setIsConfirmingUnlock(false);
    setIsUnlocking(true);
    trackEvent('arcade_unlock_games_flow', {
      mode: 'arcade',
      product_id: 'arcade_entitlement',
      stage: 'started',
      new_game_entitlements: newGameEntitlements
    });
    try {
      const response = await unlockArcade();
      const replenishedCredits = Math.max(0, Math.min(response.arcadeCredits ?? 0, maxArcadeCredits));
      setArcadeCredits(replenishedCredits);
      setNewGameEntitlements(prev => Math.max(prev - 1, 0));
      toast.notify('Игры восстановлены!');
      queryClient.invalidateQueries({ queryKey: ['arcade', 'status'] });
      trackEvent('arcade_unlock_games_flow', {
        mode: 'arcade',
        product_id: 'arcade_entitlement',
        stage: 'completed',
        new_game_entitlements: Math.max(newGameEntitlements - 1, 0)
      });
    } catch {
      toast.notify('Не удалось разблокировать аркаду');
      trackEvent('arcade_unlock_games_flow', {
        mode: 'arcade',
        product_id: 'arcade_entitlement',
        stage: 'failed'
      });
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleBuyGames = async () => {
    const ready = await ensureTelegramReady();
    if (!ready) {
      return;
    }

    try {
      trackEvent('arcade_unlock_games_flow', {
        mode: 'arcade',
        product_id: 'arcade_new_game',
        stage: 'started'
      });
      const purchaseResult = await purchaseProduct('arcade_new_game');
      const invoiceUrl = purchaseResult.invoice_url;
      
      const result = await invoice.openUrl(invoiceUrl);
      
      if (result === 'paid') {
        toast.notify('Покупка завершена успешно!');
        const status = await getArcadeStatus();
        const credits = Math.max(0, Math.min(status.arcadeCredits ?? 0, maxArcadeCredits));
        setArcadeCredits(credits);
        setNewGameEntitlements(status.newGameEntitlements);
        queryClient.invalidateQueries({ queryKey: ['arcade', 'status'] });
        queryClient.invalidateQueries({ queryKey: ['purchases'] });
        trackEvent('arcade_unlock_games_flow', {
          mode: 'arcade',
          product_id: 'arcade_new_game',
          stage: 'completed',
          arcade_credits: credits
        });
      } else {
        try {
          await cleanupCancelledPurchase(purchaseResult.purchase_id);
        } catch {
          // Don't fail the whole operation if cleanup fails
        }
        toast.notify('Покупка отменена');
        trackEvent('arcade_unlock_games_flow', {
          mode: 'arcade',
          product_id: 'arcade_new_game',
          stage: 'cancelled'
        });
      }
    } catch {
      toast.notify('Ошибка при покупке');
      trackEvent('arcade_unlock_games_flow', {
        mode: 'arcade',
        product_id: 'arcade_new_game',
        stage: 'failed'
      });
    }
  };

  const handleUseExtraTry = async () => {
    if (!session?.sessionId) return;
    
    setIsUsingExtraTry(true);
    try {
      await callUseExtraTry(session.sessionId);
      
      setLines([]);
      setCurrentGuess('');
      setSessionStartTime(Date.now());
      pendingRecords.current = [];
      setExtraTryEntitlements(prev => Math.max(prev - 1, 0));
      setShowExtraTryModal(false);
      queryClient.invalidateQueries({ queryKey: ['arcade', 'incomplete-session'] });
      extraTryPromptLoggedRef.current = false;
      trackEvent('arcade_extra_try_used', {
        mode: 'arcade',
        remaining_entitlements_after: Math.max(extraTryEntitlements - 1, 0)
      });
      
      toast.notify('Попытка добавлена!');
    } catch {
      toast.notify('Не удалось использовать попытку');
      trackEvent('arcade_extra_try_failed', { mode: 'arcade' });
    } finally {
      setIsUsingExtraTry(false);
    }
  };

  const handleFinishGame = async () => {
    if (!session?.sessionId) return;
    
    setIsUsingExtraTry(true);
    try {
      await finishExtraTry(session.sessionId);
      setShowExtraTryModal(false);
      // Invalidate user status so the arcade count reflects the finished game
      await queryClient.invalidateQueries({ queryKey: ['user', 'status'] });
      setShowResult(true);
      queryClient.invalidateQueries({ queryKey: ['arcade', 'incomplete-session'] });
      trackEvent('arcade_session_completed', {
        mode: 'arcade',
        result: 'loss',
        attempts_used: lines.length,
        time_ms: sessionStartTime ? Date.now() - sessionStartTime : undefined,
        word_length: session?.length,
        theme: session?.theme
      });
      sessionStartedRef.current = false;
      
      // finishExtraTry already marks the session as complete, no need to call completeArcadeSession
    } catch {
      toast.notify('Ошибка завершения игры');
      trackEvent('arcade_finish_game_failed', { mode: 'arcade' });
    } finally {
      setIsUsingExtraTry(false);
    }
  };

  const handleBuyExtraTries = async () => {
    const ready = await ensureTelegramReady();
    if (!ready) {
      return;
    }

    try {
      trackEvent('arcade_extra_try_purchase_flow', {
        mode: 'arcade',
        product_id: 'arcade_extra_try',
        stage: 'started'
      });
      const purchaseResult = await purchaseProduct('arcade_extra_try');
      const invoiceUrl = purchaseResult.invoice_url;
      
      const result = await invoice.openUrl(invoiceUrl);
      
      if (result === 'paid') {
        toast.notify('Покупка завершена успешно!');
        let shouldAutoUseExtraTry = false;
        // Refresh session to get updated entitlements
        if (session?.sessionId) {
          try {
            const sessionData = await checkArcadeSession();
            if (sessionData.hasIncomplete && sessionData.session) {
              setExtraTryEntitlements(sessionData.session.extraTryEntitlementsAvailable);
              shouldAutoUseExtraTry = sessionData.session.extraTryEntitlementsAvailable > 0;
              queryClient.invalidateQueries({ queryKey: ['arcade', 'incomplete-session'] });
            }
          } catch {
            // Fallback: refresh arcade status
            try {
              const fallbackStatus = await getArcadeStatus();
              const credits = Math.max(0, Math.min(fallbackStatus.arcadeCredits ?? 0, maxArcadeCredits));
              setArcadeCredits(credits);
              setNewGameEntitlements(fallbackStatus.newGameEntitlements);
            } catch {
              // ignore fallback failures
            }
          }
        }
        queryClient.invalidateQueries({ queryKey: ['arcade', 'incomplete-session'] });
        queryClient.invalidateQueries({ queryKey: ['arcade', 'status'] });
        queryClient.invalidateQueries({ queryKey: ['purchases'] });
        if (shouldAutoUseExtraTry) {
          await handleUseExtraTry();
        }
        trackEvent('arcade_extra_try_purchase_flow', {
          mode: 'arcade',
          product_id: 'arcade_extra_try',
          stage: 'completed'
        });
      } else {
        try {
          await cleanupCancelledPurchase(purchaseResult.purchase_id);
        } catch {
          // Don't fail the whole operation if cleanup fails
        }
        toast.notify('Покупка отменена');
        trackEvent('arcade_extra_try_purchase_flow', {
          mode: 'arcade',
          product_id: 'arcade_extra_try',
          stage: 'cancelled'
        });
      }
    } catch {
      toast.notify('Ошибка при покупке');
      trackEvent('arcade_extra_try_purchase_flow', {
        mode: 'arcade',
        product_id: 'arcade_extra_try',
        stage: 'failed'
      });
    }
  };

  const handleStart = async () => {
    if (session) {
      return;
    }

    if (arcadeCredits <= 0) {
      toast.notify('Бесплатных игр не осталось. Пополните запас, чтобы продолжить.');
      return;
    }

    if (startArcadeMutation.isPending) {
      return;
    }

    try {
      trackEvent('arcade_start_clicked', {
        mode: 'arcade',
        word_length: activeLength,
        theme: activeTheme,
        credits_remaining: arcadeCredits
      });
      await startArcadeMutation.mutateAsync({ length: activeLength, theme: activeTheme });
    } catch (error) {
      // handled by mutation.onError toast
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

  const handleEnter = async () => {
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
    
    // Store guess in local variable and clear currentGuess immediately
    const submittedGuess = currentGuess;
    setCurrentGuess('');
    
    // Validate dictionary if available
    const cacheKey = getDictionaryKey(session.length, session.theme);
    const dictionary = dictionaryCache.get(cacheKey);
    if (dictionary && !validateDictionary(submittedGuess, dictionary)) {
      toast.notify('Слово не найдено в словаре.');
      return;
    }
    
    // Check for duplicate words (case-insensitive)
    const normalizedSubmittedGuess = normalizeGuess(submittedGuess, false).toLowerCase();
    const isDuplicate = lines.some(line => 
      normalizeGuess(line.guess, false).toLowerCase() === normalizedSubmittedGuess
    );
    if (isDuplicate) {
      toast.notify('Вы уже пробовали это слово');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Evaluate guess locally
      const line = evaluateGuessLocally(submittedGuess);
      const guessIndex = lines.length + 1;
      const isWin = line.feedback.every(f => f.state === 'correct');
      setLines(prev => [...prev, line]);
      trackEvent('arcade_guess_submitted', {
        mode: 'arcade',
        attempt_index: guessIndex,
        attempts_used: guessIndex,
        result: isWin ? 'correct' : 'incorrect',
        word_length: session.length,
        theme: session.theme
      });
      
      // Record guess in database
      const feedbackMask = JSON.stringify(line.feedback.map(f => f.state));
      const normalizedGuess = normalizeGuess(submittedGuess, false);
      
      // Check if this is the last attempt
      const isLastAttempt = lines.length + 1 >= session.maxAttempts;
      
      // Create the record promise
      const recordPromise = recordArcadeGuess(
        session.sessionId,
        guessIndex,
        submittedGuess, // original input
        normalizedGuess, // normalized
        feedbackMask
      ).then(() => {
        queryClient.invalidateQueries({ queryKey: ['arcade', 'incomplete-session'] });
      }).catch(() => {
        // Error recording guess (non-critical)
      }).finally(() => {
        // Remove from pending array when done
        pendingRecords.current = pendingRecords.current.filter(p => p !== recordPromise);
      });
      
      // Add to pending array
      pendingRecords.current.push(recordPromise);
      
      // If this is the last attempt, await ALL pending records before proceeding
      if (isLastAttempt) {
        try {
          await Promise.all(pendingRecords.current);
        } catch {
          // Error completing record requests (non-critical)
        }
      }
      
      // Check win/loss
      const isLost = !isWin && isLastAttempt;
      
      if (isWin) {
        triggerHaptic('success');
        // Invalidate user status to ensure the arcade count refreshes before showing the result
        await queryClient.invalidateQueries({ queryKey: ['user', 'status'] });
        setShowResult(true);
        trackEvent('arcade_session_completed', {
          mode: 'arcade',
          result: 'win',
          attempts_used: guessIndex,
          time_ms: sessionStartTime ? Date.now() - sessionStartTime : undefined,
          word_length: session.length,
          theme: session.theme
        });
        sessionStartedRef.current = false;
        extraTryPromptLoggedRef.current = false;
        
        // Record session completion in background
        if (sessionStartTime) {
          const timeMs = Date.now() - sessionStartTime;
          completeArcadeSession(session.puzzleId, 'won', lines.length + 1, timeMs)
            .then(() => {
              queryClient.invalidateQueries({ queryKey: ['user', 'status'] });
              queryClient.invalidateQueries({ queryKey: ['arcade', 'incomplete-session'] });
            })
            .catch(() => {
              // Don't show error to user - game already completed locally
            });
        }
      } else if (isLost) {
        // Always show extra try modal on last failed attempt
        if (!extraTryPromptLoggedRef.current) {
          extraTryPromptLoggedRef.current = true;
          trackEvent('arcade_extra_try_prompt_shown', {
            mode: 'arcade',
            attempts_used: guessIndex,
            remaining_entitlements: extraTryEntitlements
          });
        }
        setShowExtraTryModal(true);
        triggerHaptic('error');
      } else {
        triggerHaptic('light');
      }
    } catch (error) {
      triggerHaptic('error');
      const errorMessage = error instanceof Error ? error.message : 'Ошибка при обработке догадки';
      toast.notify(errorMessage);
      trackEvent('arcade_guess_failed', {
        mode: 'arcade',
        message: errorMessage,
        word_length: session?.length,
        theme: session?.theme
      });
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
              onPurchaseComplete={handleHintPurchaseComplete}
              purchaseDisabled={!isTelegramReady}
            />

            {/* Extra Try Modal */}
            <ExtraTryModal
              isOpen={showExtraTryModal}
              onUseTry={handleUseExtraTry}
              onFinish={handleFinishGame}
              onBuyTries={handleBuyExtraTries}
              entitlementsRemaining={extraTryEntitlements}
              isLoading={isUsingExtraTry}
              purchaseDisabled={!isTelegramReady}
            />

            {/* Hint Icon */}
            {!showResult && (
              <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none h-12">
                <TopCenterIcon 
                  onClick={handleHintIconClick}
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
                  answer={session.solution.toUpperCase()}
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
                <div className="flex items-center gap-3">
                  <Button
                    className="flex-1"
                    fullWidth
                    onClick={handleNewGameClick}
                  >
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
                    variant="icon"
                  />
                  <SaveWordButton
                    word={session.solution.toUpperCase()}
                    source="arcade"
                    puzzleId={session.puzzleId}
                    ariaLabel="Добавить слово из аркады"
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

            {startArcadeMutation.isPending ? (
              <Card padding="lg" className="text-center">
                <div className="flex justify-center">
                  <PuzzleLoader length={activeLength} />
                </div>
              </Card>
            ) : arcadeCredits <= 0 ? (
              <Card padding="lg" className="text-center">
                <Heading level={3} className="mb-4">Бесплатные игры закончились</Heading>
                <Text className="mb-6">Пополните запас, чтобы продолжить играть в аркаду.</Text>
                
                {newGameEntitlements > 0 ? (
                  <>
                    {!isConfirmingUnlock ? (
                      <Button
                        fullWidth
                        variant="primary"
                        onClick={() => setIsConfirmingUnlock(true)}
                        disabled={isUnlocking}
                      >
                        {isUnlocking ? 'Загрузка...' : `Восстановить игры (${newGameEntitlements} шт.)`}
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
                          {isUnlocking ? 'Загрузка...' : 'Восстановить'}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <Button
                    fullWidth
                    variant="primary"
                    onClick={handleBuyGames}
                    disabled={!isTelegramReady}
                  >
                    Купить игры
                  </Button>
                )}
              </Card>
            ) : (
              <div className="flex flex-col gap-4">
                <Card padding="lg" className="text-center">
                  <Text className="mb-4">Выберите длину слова</Text>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {availableLengths.map((len) => (
                      <Button
                        key={len}
                        onClick={() => handleSelectLength(len)}
                        variant={len === activeLength ? 'primary' : 'secondary'}
                        size="sm"
                        className="rounded-full"
                        disabled={startArcadeMutation.isPending}
                      >
                        {len} букв
                      </Button>
                    ))}
                  </div>
                </Card>

                <Card padding="lg" className="text-center">
                  <Text className="mb-4">Выберите тему слова</Text>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {themeOptions.map((option) => (
                      <Button
                        key={option.value}
                        onClick={() => handleSelectTheme(option.value)}
                        variant={option.value === activeTheme ? 'primary' : 'secondary'}
                        size="sm"
                        className="rounded-full"
                        disabled={startArcadeMutation.isPending}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {arcadeCredits > 0 && (
              <div className="mt-auto pt-6">
                <Button
                  fullWidth
                  variant="primary"
                  onClick={handleStart}
                  disabled={startArcadeMutation.isPending}
                >
                  Начать игру
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
