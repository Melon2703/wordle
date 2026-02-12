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
  disabled?: boolean;
}

const stateClassName: Record<Exclude<KeyState, undefined>, string> = {
  correct: 'bg-green-500 text-white',
  present: 'bg-yellow-400 text-slate-800',
  absent: 'bg-gray-300 text-slate-800 opacity-80'
};

export function KeyboardCyr({ onKey, onEnter, onBackspace, keyStates = {}, disabled = false }: KeyboardCyrProps) {
  const handlePress = (value: string) => {
    if (disabled) return;
    
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
                disabled={disabled}
                className={clsx(
                  'flex-1 rounded-xl bg-blue-100 px-2 py-3 text-sm font-semibold text-slate-800 shadow-sm transition active:scale-95',
                  label.length > 1 && 'flex-[1.5]',
                  state ? stateClassName[state] : null,
                  disabled && 'opacity-50 cursor-not-allowed'
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
