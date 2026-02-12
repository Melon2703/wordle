'use client';

import clsx from 'clsx';

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

  const resultCopy = status === 'won' ? 'Победа!' : 'Попробуйте снова';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[var(--panel)] p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-[var(--text)]">{resultCopy}</h2>
        <p className="mt-2 text-sm text-[var(--text)] opacity-80">
          {status === 'won'
            ? `Решено за ${attemptsUsed} попыток.`
            : 'Можете потренироваться в режиме Аркада.'}
        </p>
        {status === 'lost' && answer ? (
          <p className="mt-3 text-sm text-[var(--text)]">Сегодняшнее слово: {answer}</p>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className={clsx(
            'mt-6 w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90'
          )}
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
