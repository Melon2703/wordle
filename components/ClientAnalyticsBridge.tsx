'use client';
import { useEffect, useRef, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getModeFromPath, isAnalyticsEnabled, trackPageView } from '@/lib/analytics';

function AnalyticsContent() {
  const rawPathname = usePathname();
  const pathname = rawPathname ?? '/';
  const searchParams = useSearchParams();
  const lastPathRef = useRef<string | null>(null);
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    if (!isAnalyticsEnabled()) {
      return;
    }
    const search = searchParams ? searchParams.toString() : '';
    const path = search ? `${pathname}?${search}` : pathname;
    if (!path || lastPathRef.current === path) {
      return;
    }
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      lastPathRef.current = path;
      return;
    }
    lastPathRef.current = path;
    const title = document?.title ?? 'RU Word Puzzle';
    trackPageView(path, title, { mode: getModeFromPath(pathname) });
  }, [pathname, searchParams]);

  return null;
}

export function ClientAnalyticsBridge() {
  return (
    <Suspense fallback={null}>
      <AnalyticsContent />
    </Suspense>
  );
}
