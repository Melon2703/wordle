'use client';

import { TopRightIcons } from './TopRightIcons';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none h-12 w-full">
      <TopRightIcons />
    </header>
  );
}
