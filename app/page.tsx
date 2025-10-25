'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Banner } from '@/components/Banner';
import { RulesSheet } from '@/components/RulesSheet';
import { Button, Card, Heading, Text } from '@/components/ui';
import { getUserStatus, getActiveBanners, getDailyPuzzle } from '@/lib/api';
import { CircleDashed, CheckCircle2, XCircle, Play, Flame, Clock } from 'lucide-react';

export default function HomePage() {
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('');
  const [rulesSheetOpen, setRulesSheetOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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

  // Check for onboarding completion
  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('wordle-onboarding-completed');
    if (!onboardingCompleted) {
      setShowOnboarding(true);
      setRulesSheetOpen(true);
    }
  }, []);

  // Fetch user status
  const { data: userStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['user', 'status'],
    queryFn: getUserStatus,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Update countdown timer
  useEffect(() => {
    if (!userStatus?.nextPuzzleAt) return;

    const updateCountdown = () => {
      const now = new Date();
      const nextPuzzle = new Date(userStatus.nextPuzzleAt);
      const diff = nextPuzzle.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilNext('Новая загадка готова!');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeUntilNext(`${hours}ч ${minutes}м`);
      } else {
        setTimeUntilNext(`${minutes}м`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [userStatus?.nextPuzzleAt]);

  // Fetch banners
  const { data: banners = [] } = useQuery({
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

  const handleRulesClick = () => {
    setShowOnboarding(false);
    setRulesSheetOpen(true);
  };

  const handleRulesSheetClose = () => {
    setRulesSheetOpen(false);
    setShowOnboarding(false);
  };

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

  return (
    <main className="page-container px-4 pt-12">
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

      {/* Header */}
      <div className="mb-8 text-center">
        <Heading level={1}>Выберите режим</Heading>
      </div>

      {/* Primary Cards */}
      <section className="section-gap">
        {/* Daily Card */}
        <Link
          href="/daily"
          className={`block ${prefersReducedMotion ? '' : 'hover:-translate-y-0.5'} ${
            isFirstTime ? 'ring-2 ring-blue-300 ring-opacity-50' : ''
          }`}
          aria-label="Ежедневная загадка - одна загадка в день"
        >
          <Card padding="lg" interactive className="text-center">
            <div className="space-y-4">
              <div>
                <Heading level={2}>Ежедневная загадка</Heading>
                <Text className="mt-2">Одна загадка в день</Text>
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
              <Button fullWidth>Играть</Button>
            </div>
          </Card>
        </Link>

        {/* Arcade Card */}
        <Link
          href="/arcade"
          className={`block ${prefersReducedMotion ? '' : 'hover:-translate-y-0.5'}`}
          aria-label="Аркада - тренируйтесь без ограничений"
        >
          <Card padding="lg" interactive className="text-center">
            <div className="space-y-4">
              <div>
                <Heading level={2}>Аркада</Heading>
                <Text className="mt-2">Тренируйтесь без ограничений</Text>
              </div>
              <Button fullWidth>Открыть аркаду</Button>
            </div>
          </Card>
        </Link>
      </section>

      {/* Rules Button */}
      <div className="mt-16 text-center">
        <Button variant="secondary" onClick={handleRulesClick}>
          Правила
        </Button>
      </div>

      {/* Rules Sheet */}
      <RulesSheet
        open={rulesSheetOpen}
        onClose={handleRulesSheetClose}
        showOnboardingButton={showOnboarding}
      />
    </main>
  );
}
