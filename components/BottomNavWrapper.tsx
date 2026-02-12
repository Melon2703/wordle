'use client';

import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';

export function BottomNavWrapper() {
  const pathname = usePathname();
  
  // Don't show bottom nav on home page
  if (pathname === '/') {
    return null;
  }
  
  return <BottomNav />;
}
