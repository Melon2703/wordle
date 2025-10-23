'use client';

import clsx from 'clsx';
import { triggerHaptic } from './HapticsBridge';
import type { LetterState } from '@/lib/contracts';

type KeyState = LetterState | undefined;

const layout: string[][] = [
  ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х'],
  ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
  ['ENTER', 'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', '⌫']
];

interface KeyboardCyrProps {
  onKey(letter: string): void;
  onEnter?(): void;
  onBackspace?(): void;
  keyStates?: Record<string, KeyState>;
}

const stateClassName: Record<Exclude<KeyState, undefined>, string> = {
  correct: 'bg-[var(--state-correct)] text-white',
  present: 'bg-[var(--state-present)] text-[var(--text)]',
  absent: 'bg-[var(--state-absent)] text-[var(--text)] opacity-80'
};

export function KeyboardCyr({ onKey, onEnter, onBackspace, keyStates = {} }: KeyboardCyrProps) {
  const handlePress = (value: string) => {
    triggerHaptic('light');
    
    if (value === 'ENTER') {
      onEnter?.();
      return;
    }
    if (value === '⌫') {
      onBackspace?.();
      return;
    }
    onKey(value);
  };

  return (
    <div className="flex flex-col gap-2">
      {layout.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-2">
          {row.map((label) => {
            const normalized = label.length === 1 ? label : label;
            const state = keyStates[normalized];
            return (
              <button
                key={label}
                type="button"
                onClick={() => handlePress(label)}
                className={clsx(
                  'flex-1 rounded-xl bg-[var(--key-bg)] px-2 py-3 text-sm font-semibold text-[var(--text)] shadow-sm transition active:scale-95',
                  label.length > 1 && 'flex-[1.5]',
                  state ? stateClassName[state] : null
                )}
                aria-label={`key ${label}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
