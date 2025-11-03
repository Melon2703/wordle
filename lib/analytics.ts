'use client';

type AnalyticsEventParams = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: {
            id?: number;
          };
        };
      };
    };
  }
}

const DEFAULT_MEASUREMENT_ID = 'G-J25T6N5ZQ1';
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? DEFAULT_MEASUREMENT_ID;

const isDev = process.env.NODE_ENV !== 'production';

function canTrack(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  if (!GA_MEASUREMENT_ID) {
    if (isDev) {
      console.debug('[analytics] Skipping event: GA measurement ID missing.');
    }
    return false;
  }
  if (typeof window.gtag !== 'function') {
    if (isDev) {
      console.debug('[analytics] Skipping event: gtag not ready yet.');
    }
    return false;
  }
  return true;
}

export function isAnalyticsEnabled(): boolean {
  return Boolean(GA_MEASUREMENT_ID);
}

export function trackEvent(eventName: string, params: AnalyticsEventParams = {}): void {
  if (!canTrack()) {
    return;
  }
  try {
    const defaultParams = params.user_cohort
      ? params
      : { ...params, user_cohort: getUserCohort() };
    window.gtag?.('event', eventName, defaultParams);
  } catch (error) {
    if (isDev) {
      console.debug('[analytics] Failed to send event', eventName, error);
    }
  }
}

export function trackPageView(
  path: string,
  title: string,
  params: AnalyticsEventParams = {}
): void {
  if (!canTrack()) {
    return;
  }
  try {
    window.gtag?.('event', 'page_view', {
      page_path: path,
      page_title: title,
      ...params,
      user_cohort: params.user_cohort ?? getUserCohort()
    });
  } catch (error) {
    if (isDev) {
      console.debug('[analytics] Failed to send page_view', error);
    }
  }
}

export function getModeFromPath(pathname: string): string {
  if (!pathname || pathname === '/') {
    return 'home';
  }
  if (pathname.startsWith('/daily')) {
    return 'daily';
  }
  if (pathname.startsWith('/arcade')) {
    return 'arcade';
  }
  if (pathname.startsWith('/dictionary')) {
    return 'dictionary';
  }
  if (pathname.startsWith('/shop')) {
    return 'shop';
  }
  if (pathname.startsWith('/purchases')) {
    return 'purchases';
  }
  return pathname.replace(/^\//, '') || 'unknown';
}

export function getUserCohort(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  if (!userId) {
    return undefined;
  }
  // Bucket Telegram IDs into coarse cohorts to avoid sending raw identifiers.
  const cohort = Math.floor(userId / 1000) * 1000;
  return `${cohort}-${cohort + 999}`;
}
