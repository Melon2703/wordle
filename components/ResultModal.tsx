'use client';

import { RisingStar } from './FiringStarAnimations';

interface ResultModalProps {
  open: boolean;
  status: 'playing' | 'won' | 'lost';
  attemptsUsed: number;
  answer?: string;
  onClose(): void;
}

export function ResultModal({ open, status, attemptsUsed, answer, onClose }: ResultModalProps) {
  if (!open) {
    return null;
  }

  const resultCopy = status === 'won' ? 'Победа!' : 'Получится в следующий раз!';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="text-center">
          {status === 'won' ? (
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
              <RisingStar size={64} />
            </div>
          ) : (
            // For loss: show answer block instead of icon (same size as star)
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center">
              <div className="px-3 py-2 bg-slate-100 rounded-lg text-center">
                <p className="text-[10px] text-slate-600 font-sans leading-tight mb-0.5">Слово дня</p>
                <p className="font-bold text-sm text-slate-800 uppercase font-sans leading-tight">{answer}</p>
              </div>
            </div>
          )}
          
          <h2 className="text-2xl font-bold text-slate-800 font-sans">{resultCopy}</h2>
          
          <p className="mt-2 text-sm text-slate-600 font-sans">
            {status === 'won'
              ? `Решено за ${attemptsUsed} попыток.`
              : 'Можете потренироваться в режиме Аркада.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-green-600"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
