'use client';

import { useState } from 'react';
import { Button, Heading, Text } from '@/components/ui';

interface ExtraTryModalProps {
  isOpen: boolean;
  onUseTry: () => Promise<void>;
  onFinish: () => void;
  onBuyTries: () => void;
  entitlementsRemaining: number;
  isLoading: boolean;
}

export function ExtraTryModal({
  isOpen,
  onUseTry,
  onFinish,
  onBuyTries,
  entitlementsRemaining,
  isLoading
}: ExtraTryModalProps) {
  const [confirming, setConfirming] = useState(false);

  if (!isOpen) return null;

  const handleUseTry = async () => {
    setConfirming(false);
    await onUseTry();
  };

  const canUseTry = entitlementsRemaining > 0 && !isLoading;

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/30 pointer-events-auto">
      <div className="w-full rounded-t-3xl bg-[var(--panel)] p-6 shadow-2xl">
        <div className="mb-4">
          <Heading level={3}>Попытки закончились</Heading>
        </div>

        <div className="mb-6">
          <Text>Хотите попробовать эту же головоломку еще раз?</Text>
        </div>

        <div className="flex gap-2">
          {canUseTry ? (
            <>
              {!confirming ? (
                <Button
                  fullWidth
                  variant="primary"
                  onClick={() => setConfirming(true)}
                  disabled={isLoading}
                >
                  {isLoading ? 'Загрузка...' : `Попробовать снова (${entitlementsRemaining} шт.)`}
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
                    onClick={handleUseTry}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? 'Загрузка...' : 'Начать заново'}
                  </Button>
                </>
              )}
            </>
          ) : (
            <Button
              fullWidth
              variant="primary"
              onClick={onBuyTries}
              disabled={isLoading}
            >
              Купить попытки
            </Button>
          )}
        </div>

        <div className="mt-4">
          <Button
            variant="secondary"
            fullWidth
            onClick={onFinish}
            disabled={isLoading}
          >
            Завершить
          </Button>
        </div>
      </div>
    </div>
  );
}
