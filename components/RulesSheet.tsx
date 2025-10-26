'use client';

import { Button, Heading, Text } from '@/components/ui';
import { X } from 'lucide-react';

interface RulesSheetProps {
  open: boolean;
  onClose(): void;
  showOnboardingButton?: boolean;
}

export function RulesSheet({ open, onClose, showOnboardingButton = false }: RulesSheetProps) {
  if (!open) {
    return null;
  }

  const handleOkClick = () => {
    if (showOnboardingButton) {
      localStorage.setItem('wordle-onboarding-completed', 'true');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/30 pointer-events-auto">
      <div className="w-full rounded-t-3xl bg-[var(--panel)] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <Heading level={2}>Как играть</Heading>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5 text-[var(--text)]" />
          </button>
        </div>
        
        <div className="mt-4 max-h-[70vh] overflow-y-auto">
          <Text>Угадайте слово за 6 попыток</Text>

          <div className="mt-4 space-y-3">
            <Text variant="caption">• Каждая догадка должна быть валидным словом нужной длины</Text>
            <Text variant="caption">• Цвет плиток показывает, насколько близко ваша догадка к слову</Text>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <div className="flex gap-1 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-green-500 text-lg font-semibold text-white">
                  С
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  Л
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  О
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  В
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  О
                </div>
              </div>
              <Text variant="caption"><span className="font-bold">С</span> находится в слове и в правильной позиции</Text>
            </div>

            <div>
              <div className="flex gap-1 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  Р
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-yellow-400 text-lg font-semibold text-slate-800">
                  А
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  М
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  К
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  А
                </div>
              </div>
              <Text variant="caption"><span className="font-bold">А</span> находится в слове, но в неправильной позиции</Text>
            </div>

            <div>
              <div className="flex gap-1 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  М
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  Е
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  С
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-gray-300 text-lg font-semibold text-slate-800 opacity-80">
                  Т
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  О
                </div>
              </div>
              <Text variant="caption"><span className="font-bold">Т</span> не находится в слове ни в какой позиции</Text>
            </div>
          </div>
        </div>

        {showOnboardingButton && (
          <div className="mt-6">
            <Button fullWidth onClick={handleOkClick}>
              OK
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
