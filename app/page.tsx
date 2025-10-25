'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Banner } from '@/components/Banner';
import { getUserStatus, getActiveBanners, getDailyPuzzle } from '@/lib/api';
import { CircleDashed, CheckCircle2, XCircle, Play, Flame, Clock } from 'lucide-react';

export default function HomePage() {
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState<string>('');

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

  // Filter out dismissed banners
  const activeBanners = banners.filter(banner => !dismissedBanners.has(banner.id));

  // Determine smart badges
  const isFirstTime = userStatus?.streak === 0 && userStatus?.dailyStatus === 'not_started';
  const justCompletedDaily = userStatus?.dailyStatus === 'won';
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
    <main className="flex min-h-screen flex-col bg-blue-50 px-4 pb-24 pt-12 text-slate-800">
      {/* Banner */}
      {activeBanners.length > 0 && (
        <div className="mb-6 space-y-3">
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
        <h1 className="text-3xl font-semibold sm:text-4xl">Выберите режим</h1>
      </div>

      {/* Primary Cards */}
      <section className="space-y-6">
        {/* Daily Card */}
        <Link
          href="/daily"
          className={`block rounded-2xl border border-blue-200 bg-white p-8 shadow-sm transition-all duration-200 hover:shadow-md ${
            prefersReducedMotion ? '' : 'hover:-translate-y-0.5'
          } ${
            isFirstTime ? 'ring-2 ring-blue-300 ring-opacity-50' : ''
          }`}
          aria-label="Ежедневная загадка - одна загадка в день"
        >
          <div className="text-center space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Ежедневная загадка</h2>
              <p className="mt-2 text-slate-600">Одна загадка в день</p>
            </div>
            
            {/* Status Row */}
            {!statusLoading && userStatus && (
              <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
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
            <div className="w-full rounded-lg bg-blue-500 px-6 py-3 text-sm font-medium text-white">
              Играть
            </div>
          </div>
        </Link>

        {/* Arcade Card */}
        <Link
          href="/arcade"
          className={`block rounded-2xl border border-blue-200 bg-white p-8 shadow-sm transition-all duration-200 hover:shadow-md ${
            prefersReducedMotion ? '' : 'hover:-translate-y-0.5'
          } ${
            justCompletedDaily ? 'ring-2 ring-green-300 ring-opacity-50' : ''
          }`}
          aria-label="Аркада - тренируйтесь без ограничений"
        >
          <div className="text-center space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Аркада</h2>
              <p className="mt-2 text-slate-600">Тренируйтесь без ограничений</p>
            </div>
            {justCompletedDaily && (
              <div className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Попробуйте!
              </div>
            )}
            <div className="w-full rounded-lg bg-blue-500 px-6 py-3 text-sm font-medium text-white">
              Открыть аркаду
            </div>
          </div>
        </Link>
      </section>

      {/* Footer Link */}
      <div className="mt-16 text-center">
        <Link
          href="/help"
          className="text-sm font-medium text-blue-500 underline-offset-4 hover:underline"
        >
          Как играть и подсказки по орфографии
        </Link>
      </div>
    </main>
  );
}
