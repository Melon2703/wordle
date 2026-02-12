'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Calendar, Gamepad2, Trophy, HelpCircle, ShoppingCart, Settings } from 'lucide-react';
import { SettingsSheet } from './SettingsSheet';
import clsx from 'clsx';

interface SettingsState {
  highContrast: boolean;
  haptics: boolean;
  showTimer: boolean;
  treatYoAsYe: boolean;
}

const initialSettings: SettingsState = {
  highContrast: true,
  haptics: true,
  showTimer: false,
  treatYoAsYe: false
};

interface NavItem {
  href: '/daily' | '/arcade' | '/leaders' | '/help' | '/shop';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  showForAll?: boolean;
}

const navItems: NavItem[] = [
  { href: '/daily', label: 'Ежедневная', icon: Calendar, showForAll: true },
  { href: '/arcade', label: 'Аркада', icon: Gamepad2, showForAll: true },
  { href: '/leaders', label: 'Рейтинги', icon: Trophy, showForAll: true },
  { href: '/help', label: 'Помощь', icon: HelpCircle, showForAll: true },
  { href: '/shop', label: 'Магазин', icon: ShoppingCart, showForAll: false }
];

export function BottomNav() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [showShop, setShowShop] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wordle-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...initialSettings, ...parsed });
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  // Check if user should see Shop tab
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkTelegramUser = () => {
      const tg = (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } }).Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.id === 626033046) {
        setShowShop(true);
        setShowSettings(true);
      }
    };

    // Try immediately
    checkTelegramUser();
    
    // Also try after a delay in case Telegram isn't ready yet
    const timeout = setTimeout(checkTelegramUser, 1000);
    return () => clearTimeout(timeout);
  }, []);

  // Save settings to localStorage
  const updateSettings = (newSettings: SettingsState) => {
    setSettings(newSettings);
    localStorage.setItem('wordle-settings', JSON.stringify(newSettings));
  };

  // Apply high contrast setting
  useEffect(() => {
    document.documentElement.setAttribute('data-contrast', settings.highContrast ? 'high' : 'normal');
  }, [settings.highContrast]);

  const handleSettingsClick = () => {
    setSettingsOpen(true);
  };

  const visibleItems = navItems.filter(item => 
    item.showForAll || (item.href === '/shop' && showShop)
  );

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
                <IconComponent className="h-6 w-6" />
              </Link>
            );
          })}
          
          {/* Settings button - only show for specific user */}
          {showSettings && (
            <button
              type="button"
              onClick={handleSettingsClick}
              className={clsx(
                'flex h-12 w-12 items-center justify-center rounded-lg transition-colors',
                'hover:bg-blue-50'
              )}
              aria-label="Настройки"
            >
              <Settings className="h-6 w-6" />
            </button>
          )}
        </div>
      </nav>
      
      <SettingsSheet
        open={settingsOpen}
        state={settings}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
