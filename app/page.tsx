'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { Banner } from '@/components/Banner';
import { LoadingFallback } from '@/components/LoadingFallback';
import { Button, Card, Heading, Text } from '@/components/ui';
import { getUserStatus, getActiveBanners, getDailyPuzzle, getSavedWords } from '@/lib/api';
import { CircleDashed, CheckCircle2, XCircle, Play, Flame, Clock, BookMarked, CalendarCheck2, Zap } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { useCountdown } from '@/lib/hooks/useCountdown';
import { pluralizeRu } from '@/lib/pluralize';

export default function HomePage() {
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set());
  const prefersReducedMotion = usePrefersReducedMotion();
  const savedWordsLoggedRef = useRef(false);



  // Load dismissed banners from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dismissed-banners');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDismissedBanners(new Set(parsed));
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);



  // Fetch user status
  const { data: userStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['user', 'status'],
    queryFn: getUserStatus,
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: savedWords, isLoading: savedWordsLoading } = useQuery({
    queryKey: ['savedWords'],
    queryFn: getSavedWords,
    staleTime: 60 * 1000
  });

  useEffect(() => {
    if (savedWordsLoggedRef.current) {
      return;
    }
    if (savedWordsLoading) {
      return;
    }
    if (savedWords === undefined) {
      return;
    }
    savedWordsLoggedRef.current = true;
    trackEvent('saved_words_preview_loaded', {
      mode: 'home',
      count: savedWords.length
    });
  }, [savedWords, savedWordsLoading]);

  const timeUntilNext = useCountdown(userStatus?.nextPuzzleAt);

  // Fetch banners
  const { data: banners = [], isLoading: bannersLoading } = useQuery({
    queryKey: ['banners'],
    queryFn: getActiveBanners,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Prefetch daily puzzle for instant entry
  useQuery({
    queryKey: ['puzzle', 'daily'],
    queryFn: getDailyPuzzle,
    staleTime: 30 * 1000,
    enabled: false, // Don't fetch automatically, just prefetch
  });

  const handleBannerDismiss = (bannerId: string) => {
    const newDismissed = new Set(dismissedBanners);
    newDismissed.add(bannerId);
    setDismissedBanners(newDismissed);
    localStorage.setItem('dismissed-banners', JSON.stringify([...newDismissed]));
  };

  const savedWordsCount = savedWords?.length ?? 0;

  const handleCardTap = (destination: 'daily' | 'arcade' | 'dictionary') => {
    trackEvent('home_card_tapped', {
      mode: 'home',
      destination_mode: destination,
      daily_status: userStatus?.dailyStatus,
      streak: userStatus?.streak,
      saved_words_count: savedWordsCount,
      arcade_solved: userStatus?.arcadeSolved
    });
  };

  if (statusLoading || bannersLoading) {
    return <LoadingFallback length={5} />;
  }


  // Filter out dismissed banners
  const activeBanners = banners.filter(banner => !dismissedBanners.has(banner.id));

  // Determine smart badges
  const isFirstTime = userStatus?.streak === 0 && userStatus?.dailyStatus === 'not_started';
  const isNearMidnight = userStatus?.nextPuzzleAt ?
    new Date(userStatus.nextPuzzleAt).getTime() - Date.now() < 30 * 60 * 1000 : false;

  // Status helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'not_started': return <CircleDashed className="w-4 h-4" />;
      case 'playing': return <Play className="w-4 h-4" />;
      case 'won': return <CheckCircle2 className="w-4 h-4" />;
      case 'lost': return <XCircle className="w-4 h-4" />;
      default: return <CircleDashed className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'not_started': return 'Не решено';
      case 'playing': return 'В процессе';
      case 'won': return 'Решено';
      case 'lost': return 'Не решено';
      default: return 'Не решено';
    }
  };

  const getSavedWordsText = () => {
    if (savedWordsLoading) {
      return 'Загружаем словарь…';
    }
    const count = savedWords?.length ?? 0;
    if (count === 0) {
      return 'Пока нет сохраненных слов';
    }
    return pluralizeRu(count, 'слово', 'слова', 'слов');
  };

  const getArcadeSolvedText = () => {
    if (statusLoading) {
      return 'Загружаем…';
    }
    const count = userStatus?.arcadeSolved ?? 0;
    if (count === 0) {
      return 'Пока нет решенных';
    }
    return pluralizeRu(count, 'решена', 'решены', 'решено');
  };

  return (
    <main className="page-container px-4 pt-20">
      {/* Banner */}
      {activeBanners.length > 0 && (
        <div className="mb-6 card-gap">
          {activeBanners.map((banner) => (
            <Banner
              key={banner.id}
              banner={banner}
              onDismiss={handleBannerDismiss}
            />
          ))}
        </div>
      )}

      {/* Primary Cards */}
      <section className="section-gap">
        {/* Daily Card */}
        <Link
          href="/daily"
          onClick={() => handleCardTap('daily')}
          className={`block ${prefersReducedMotion ? '' : 'hover:-translate-y-0.5'} ${isFirstTime ? 'ring-2 ring-blue-300 ring-opacity-50' : ''
            }`}
          aria-label="Ежедневная загадка - одна загадка в день"
        >
          <Card padding="lg" interactive className="text-center">
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-3">
                <CalendarCheck2 className="h-8 w-8 text-blue-600" />
                <Heading level={2}>Ежедневная загадка</Heading>
                <Text className="mt-1">Отгадывайте новое слово каждый день</Text>
              </div>

              {/* Status Row */}
              {!statusLoading && userStatus && (
                <div className="flex items-center justify-center gap-4 text-caption">
                  {/* Status */}
                  <div className="flex items-center gap-1">
                    {getStatusIcon(userStatus.dailyStatus)}
                    <span>{getStatusText(userStatus.dailyStatus)}</span>
                  </div>

                  {/* Streak */}
                  <div className="flex items-center gap-1">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span>{userStatus.streak}</span>
                  </div>

                  {/* Countdown */}
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{timeUntilNext}</span>
                  </div>
                </div>
              )}

              {isNearMidnight && (
                <div className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                  Скоро!
                </div>
              )}
              <Button fullWidth>
                {userStatus?.dailyStatus === 'won' || userStatus?.dailyStatus === 'lost' ? 'Открыть' : 'Играть'}
              </Button>
            </div>
          </Card>
        </Link>

        {/* Arcade Card */}
        <Link
          href="/arcade"
          onClick={() => handleCardTap('arcade')}
          className={`block ${prefersReducedMotion ? '' : 'hover:-translate-y-0.5'}`}
          aria-label="Аркада - тренируйтесь без ограничений"
        >
          <Card padding="lg" interactive className="text-center">
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-3">
                <Zap className="h-8 w-8 text-blue-600" />
                <Heading level={2}>Аркада</Heading>
                <Text className="mt-1">Тренируйтесь без ограничений</Text>
              </div>
              <Text variant="caption" className="text-slate-500">
                {getArcadeSolvedText()}
              </Text>
              <Button fullWidth>Играть</Button>
            </div>
          </Card>
        </Link>

        {/* Dictionary Card */}
        <Link
          href="/dictionary"
          onClick={() => handleCardTap('dictionary')}
          className={`block ${prefersReducedMotion ? '' : 'hover:-translate-y-0.5'}`}
          aria-label="Личный словарь - сохраненные слова"
        >
          <Card padding="lg" interactive className="text-center">
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-3">
                <BookMarked className="h-8 w-8 text-blue-600" />
                <Heading level={2}>Личный словарь</Heading>
                <Text className="mt-1">Собирайте понравившиеся слова</Text>
              </div>
              <Text variant="caption" className="text-slate-500">
                {getSavedWordsText()}
              </Text>
              <Button fullWidth>Открыть</Button>
            </div>
          </Card>
        </Link>
      </section>
    </main>
  );
}
