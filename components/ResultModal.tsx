'use client';

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
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
            <span className="text-2xl">⭐</span>
          </div>
              <h2 className="text-2xl font-bold text-slate-800 font-sans">{resultCopy}</h2>
          <p className="mt-2 text-sm text-slate-600 font-sans">
            {status === 'won'
              ? `Решено за ${attemptsUsed} попыток.`
              : 'Можете потренироваться в режиме Аркада.'}
          </p>
          {status === 'lost' && answer ? (
                <p className="mt-3 text-sm text-slate-600 font-sans">Сегодняшнее слово: {answer}</p>
          ) : null}
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
