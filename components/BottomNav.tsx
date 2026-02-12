'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { CalendarCheck2, Zap, Store, CircleHelp } from 'lucide-react';
import { RulesSheet } from './RulesSheet';
import clsx from 'clsx';


interface NavItem {
  href: '/daily' | '/arcade' | '/shop';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  showForAll?: boolean;
}

const navItems: NavItem[] = [
  { href: '/daily', label: 'Ежедневная', icon: CalendarCheck2, showForAll: true },
  { href: '/arcade', label: 'Аркада', icon: Zap, showForAll: true },
  { href: '/shop', label: 'Магазин', icon: Store, showForAll: false }
];

export function BottomNav() {
  const pathname = usePathname();
  const [showShop, setShowShop] = useState(false);
  const [rulesSheetOpen, setRulesSheetOpen] = useState(false);

  // Check if user should see Shop tab
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkTelegramUser = () => {
      const tg = (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } }).Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.id === 626033046) {
        setShowShop(true);
      }
    };

    // Try immediately
    checkTelegramUser();
    
    // Also try after a delay in case Telegram isn't ready yet
    const timeout = setTimeout(checkTelegramUser, 1000);
    return () => clearTimeout(timeout);
  }, []);

  const visibleItems = navItems.filter(item => 
    item.showForAll || (item.href === '/shop' && showShop)
  );

  const handleRulesClick = () => {
    setRulesSheetOpen(true);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-blue-200 bg-white px-6 py-3">
        <div className="flex items-center justify-around gap-6">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            const IconComponent = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex h-12 w-12 items-center justify-center rounded-lg transition-colors',
                  'hover:bg-blue-50',
                  isActive && 'bg-blue-100 text-blue-600'
                )}
                aria-label={item.label}
              >
                <IconComponent className="h-5 w-5" />
              </Link>
            );
          })}
          
          {/* Rules button */}
          <button
            type="button"
            onClick={handleRulesClick}
            className={clsx(
              'flex h-12 w-12 items-center justify-center rounded-lg transition-colors',
              'hover:bg-blue-50'
            )}
            aria-label="Правила"
          >
            <CircleHelp className="h-5 w-5" />
          </button>
        </div>
      </nav>
      
      <RulesSheet
        open={rulesSheetOpen}
        onClose={() => setRulesSheetOpen(false)}
        showOnboardingButton={false}
      />
    </>
  );
}
