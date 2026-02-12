import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuthContext } from '@/lib/auth/validateInitData';

// Simple in-memory banner storage (can be replaced with database later)
const banners: Array<{
  id: string;
  variant: 'success' | 'info' | 'warning' | 'promo';
  message: string;
  ctaText?: string;
  ctaLink?: string;
  dismissible: boolean;
  expiresAt?: string;
}> = [
  // Example banners - remove or modify as needed
  {
    id: 'welcome-banner',
    variant: 'info',
    message: 'Добро пожаловать в RU Word Puzzle!',
    ctaText: 'Подробнее',
    ctaLink: '/help',
    dismissible: true,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  },
  // Add more banners as needed
];

export async function GET(request: NextRequest) {
  try {
    // Validate Telegram init data
    requireAuthContext(request);
    const now = new Date();

    // Filter active banners (not expired)
    const activeBanners = banners.filter(banner => {
      if (banner.expiresAt) {
        return new Date(banner.expiresAt) > now;
      }
      return true;
    });

    // TODO: In the future, check user's dismissed banners from database
    // For now, we'll rely on client-side localStorage dismissal

    return NextResponse.json(activeBanners);
  } catch (error) {
    console.error('Error in banners endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
