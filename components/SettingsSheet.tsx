'use client';

interface SettingsState {
  highContrast: boolean;
  haptics: boolean;
  showTimer: boolean;
  treatYoAsYe: boolean;
}

interface SettingsSheetProps {
  open: boolean;
  state: SettingsState;
  onChange(state: SettingsState): void;
  onClose(): void;
}

export function SettingsSheet({ open, state, onChange, onClose }: SettingsSheetProps) {
  if (!open) {
    return null;
  }

  const toggle = (key: keyof SettingsState) => {
    const next: SettingsState = { ...state, [key]: !state[key] };
    onChange(next);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/30">
      <div className="w-full rounded-t-3xl bg-[var(--panel)] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text)]">Настройки</h2>
          <button type="button" onClick={onClose} className="text-sm text-[var(--text)] opacity-70">
            Закрыть
          </button>
        </div>
        <div className="mt-4 space-y-4">
          <ToggleRow
            label="Высокий контраст"
            description="Рекомендуется для читаемости"
            active={state.highContrast}
            onToggle={() => toggle('highContrast')}
          />
          <ToggleRow
            label="Гаптика"
            description="Лёгкая вибрация при действиях"
            active={state.haptics}
            onToggle={() => toggle('haptics')}
          />
          <ToggleRow
            label="Показывать таймер"
            description="Таймер влияет только на рейтинг"
            active={state.showTimer}
            onToggle={() => toggle('showTimer')}
          />
          <ToggleRow
            label="Считать “ё” как “е”"
            description="Влияет только на проверку ввода"
            active={state.treatYoAsYe}
            onToggle={() => toggle('treatYoAsYe')}
          />
        </div>
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  active: boolean;
  onToggle(): void;
}

function ToggleRow({ label, description, active, onToggle }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--tile-border)] bg-[var(--panel)] px-4 py-3 text-left"
    >
      <span>
        <span className="block text-sm font-medium text-[var(--text)]">{label}</span>
        <span className="mt-1 block text-xs text-[var(--text)] opacity-70">{description}</span>
      </span>
      <span
        className={`inline-flex h-6 w-11 items-center rounded-full bg-[var(--key-bg)] p-1 transition ${active ? 'justify-end bg-[var(--accent)]' : 'justify-start'}`}
      >
        <span className="h-4 w-4 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}
