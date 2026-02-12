'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ToastCenter';
import type { PrepareShareRequest, GuessLine } from '@/lib/types';

interface ShareButtonProps {
  mode: 'daily' | 'arcade';
  puzzleId: string;
  status: 'won' | 'lost';
  attemptsUsed: number;
  timeMs?: number;
  lines: GuessLine[];
  streak?: number;
  arcadeSolved?: number;
}

export function ShareButton({ mode, puzzleId, status, attemptsUsed, timeMs, lines, streak, arcadeSolved }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const { notify } = useToast();

  const handleShare = async () => {
    if (isSharing) return;

    setIsSharing(true);

    try {
      // Get Telegram init data for authentication
      const tg = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram;
      const initData = tg?.WebApp?.initData;

      if (!initData) {
        notify('Не удалось получить данные Telegram');
        setIsSharing(false);
        return;
      }

      // why: Prepare shareable message via bot savePreparedInlineMessage (docs/backend/Backend_Documentation.md §A.2)
      const response = await fetch('/api/share/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData,
        },
        body: JSON.stringify({
          mode,
          puzzleId,
          status,
          attemptsUsed,
          timeMs,
          lines,
          streak,
          arcadeSolved,
        } satisfies PrepareShareRequest),
      });

      if (!response.ok) {
        throw new Error('Failed to prepare share');
      }

      const data = await response.json();

      // Use Telegram WebApp shareMessage
      const telegram = (window as { Telegram?: { WebApp?: { shareMessage?: (id: string) => Promise<void>; openTelegramLink?: (url: string) => void } } }).Telegram;
      
      if (telegram?.WebApp?.shareMessage) {
        await telegram.WebApp.shareMessage(data.preparedMessageId);
        notify('Результат подготовлен для отправки!');
      } else if (telegram?.WebApp?.openTelegramLink) {
        // Fallback: open share URL
        const shareUrl = `https://t.me/share/url?text=Закрыл%20${mode === 'daily' ? 'ежедневку' : 'аркаду'}%20за%20${attemptsUsed}/6.%20Сможешь%20лучше?&url=${encodeURIComponent(window.location.href)}`;
        telegram.WebApp.openTelegramLink(shareUrl);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        notify('Ссылка скопирована!');
      }
    } catch (error) {
      console.error('Share failed:', error);
      notify('Не удалось подготовить результат');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button
      fullWidth
      onClick={handleShare}
      disabled={isSharing}
    >
      {isSharing ? 'Подготовка...' : 'Поделиться результатом'}
    </Button>
  );
}

