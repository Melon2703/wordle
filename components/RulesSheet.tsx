'use client';

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
    <div className="fixed inset-0 z-40 flex items-end bg-black/30">
      <div className="w-full rounded-t-3xl bg-[var(--panel)] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text)]">Как играть</h2>
          <button type="button" onClick={onClose} className="text-sm text-[var(--text)] opacity-70">
            Закрыть
          </button>
        </div>
        
        <div className="mt-4 max-h-[70vh] overflow-y-auto">
          <p className="text-base font-sans text-[var(--text)]">Угадайте слово за 6 попыток</p>

          <div className="mt-4 space-y-3">
            <p className="text-xs font-sans text-[var(--text)]">• Каждая догадка должна быть валидным словом нужной длины</p>
            <p className="text-xs font-sans text-[var(--text)]">• Цвет плиток показывает, насколько близко ваша догадка к слову</p>
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
              <p className="text-xs text-slate-600 font-sans"><span className="font-bold">С</span> находится в слове и в правильной позиции</p>
            </div>

            <div>
              <div className="flex gap-1 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  К
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-yellow-400 text-lg font-semibold text-slate-800">
                  Р
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  А
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  С
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  К
                </div>
              </div>
              <p className="text-xs text-slate-600 font-sans"><span className="font-bold">Р</span> находится в слове, но в неправильной позиции</p>
            </div>

            <div>
              <div className="flex gap-1 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  М
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  О
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  С
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-gray-300 text-lg font-semibold text-slate-800 opacity-80">
                  К
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-blue-200 bg-white text-lg font-semibold text-slate-800 opacity-60">
                  А
                </div>
              </div>
              <p className="text-xs text-slate-600 font-sans"><span className="font-bold">К</span> не находится в слове ни в какой позиции</p>
            </div>
          </div>
        </div>

        {showOnboardingButton && (
          <div className="mt-6">
            <button
              type="button"
              onClick={handleOkClick}
              className="w-full rounded-lg bg-blue-500 px-6 py-3 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
