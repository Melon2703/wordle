'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Heading, Text } from '@/components/ui';
import { X } from 'lucide-react';
import { Tile } from '@/components/PuzzleGrid/Tile';
import type { Hint } from '@/lib/types';
import { purchaseProduct, cleanupCancelledPurchase } from '@/lib/api';
import { invoice } from '@tma.js/sdk';
import { useToast } from '@/components/ToastCenter';
import { waitForTelegramInitData } from '@/lib/telegram';
import { trackEvent } from '@/lib/analytics';

interface HintModalProps {
  isOpen: boolean;
  onClose: () => void;
  hints: Hint[];
  entitlementsRemaining: number;
  onUseHint: () => Promise<void>;
  isLoading: boolean;
  onPurchaseComplete?: () => Promise<void>;
  purchaseDisabled?: boolean;
}

export function HintModal({
  isOpen,
  onClose,
  hints,
  entitlementsRemaining,
  onUseHint,
  isLoading,
  onPurchaseComplete,
  purchaseDisabled = false
}: HintModalProps) {
  const [confirming, setConfirming] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const { notify } = useToast();
  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const handleUseHint = async () => {
    setConfirming(false);
    await onUseHint();
  };

  const handlePurchase = async () => {
    if (purchaseDisabled) {
      notify('Телеграм еще загружается, попробуйте чуть позже');
      return;
    }

    setIsPurchasing(true);
    try {
      trackEvent('arcade_hint_purchase_flow', {
        mode: 'arcade',
        product_id: 'arcade_hint',
        stage: 'started'
      });
      const ready = await waitForTelegramInitData();
      if (!ready) {
        notify('Телеграм еще загружается, попробуйте чуть позже');
        return;
      }

      const purchaseResult = await purchaseProduct('arcade_hint');
      const invoiceUrl = purchaseResult.invoice_url;
      
      const result = await invoice.openUrl(invoiceUrl);
      
      if (result === 'paid') {
        notify('Покупка завершена успешно!');
        queryClient.invalidateQueries({ queryKey: ['purchases'] });
        setConfirming(false);
        if (onPurchaseComplete) {
          await onPurchaseComplete();
        }
      } else {
        try {
          await cleanupCancelledPurchase(purchaseResult.purchase_id);
        } catch {
          // Don't fail the whole operation if cleanup fails
        }
        notify('Покупка отменена');
        trackEvent('arcade_hint_purchase_flow', {
          mode: 'arcade',
          product_id: 'arcade_hint',
          stage: 'cancelled'
        });
      }
    } catch {
      notify('Ошибка при покупке');
      trackEvent('arcade_hint_purchase_flow', {
        mode: 'arcade',
        product_id: 'arcade_hint',
        stage: 'failed'
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  const canShowHintButton = hints.length < 5 && entitlementsRemaining > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/30 pointer-events-auto">
      <div className="w-full rounded-t-3xl bg-[var(--panel)] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <Heading level={3}>Подсказки</Heading>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5 text-[var(--text)]" />
          </button>
        </div>

        {hints.length === 0 && (
          <div className="text-center py-6">
            <Text className="text-gray-500">Подсказки не использованы</Text>
          </div>
        )}

        {hints.length > 0 && (
          <div className="flex gap-2 mb-6">
            {hints.map((hint, idx) => (
              <Tile key={idx} letter={hint.letter.toUpperCase()} state="present" />
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {canShowHintButton && (
            <>
              {!confirming ? (
                <Button
                  fullWidth
                  variant="primary"
                  onClick={() => setConfirming(true)}
                  disabled={isLoading}
                >
                  {isLoading ? 'Загрузка...' : `Использовать подсказку (${entitlementsRemaining} шт.)`}
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirming(false)}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    Отмена
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleUseHint}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? 'Загрузка...' : 'Подтвердить'}
                  </Button>
                </>
              )}
            </>
          )}

          {hints.length >= 5 && (
            <Text className="text-center text-gray-500 flex-1 py-2">
              Максимум подсказок использовано
            </Text>
          )}

          {!canShowHintButton && hints.length < 5 && entitlementsRemaining === 0 && (
            <Button
              fullWidth
              variant="secondary"
              onClick={handlePurchase}
              disabled={isPurchasing || isLoading || purchaseDisabled}
            >
              {isPurchasing ? 'Покупка...' : 'Купить подсказки'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
