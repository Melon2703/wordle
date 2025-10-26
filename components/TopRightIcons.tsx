'use client';

import { useState, useEffect } from 'react';
import { CircleHelp, Settings } from 'lucide-react';
import { SettingsSheet } from './SettingsSheet';
import { RulesSheet } from './RulesSheet';
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

export function TopRightIcons() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rulesSheetOpen, setRulesSheetOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
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

  // Check if user should see Settings icon
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkTelegramUser = () => {
      const tg = (window as { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: number } } } } }).Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.id === 626033046) {
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

  const handleRulesClick = () => {
    setRulesSheetOpen(true);
  };

  return (
    <>
      {/* Settings button - top left */}
      {showSettings && (
        <div className="absolute top-0 left-0">
          <button
            type="button"
            onClick={handleSettingsClick}
            className={clsx(
              'flex h-12 w-12 items-center justify-center rounded-lg transition-colors pointer-events-auto',
              'hover:bg-blue-50'
            )}
            aria-label="Настройки"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      )}
      
      {/* Rules button - top right */}
      <div className="absolute top-0 right-0">
        <button
          type="button"
          onClick={handleRulesClick}
          className={clsx(
            'flex h-12 w-12 items-center justify-center rounded-lg transition-colors pointer-events-auto',
            'hover:bg-blue-50'
          )}
          aria-label="Правила"
        >
          <CircleHelp className="h-5 w-5" />
        </button>
      </div>
      
      <SettingsSheet
        open={settingsOpen}
        state={settings}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />
      
      <RulesSheet
        open={rulesSheetOpen}
        onClose={() => setRulesSheetOpen(false)}
        showOnboardingButton={false}
      />
    </>
  );
}
