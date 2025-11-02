'use client';

import clsx from 'clsx';
import { triggerHaptic } from './HapticsBridge';
import type { LetterState } from '@/lib/contracts';

type KeyState = LetterState | undefined;

const layout: string[][] = [
  ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х'],
  ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
  ['Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю']
];

interface KeyboardCyrProps {
  onKey(letter: string): void;
  onEnter?(): void;
  onBackspace?(): void;
  keyStates?: Record<string, KeyState>;
  disabled?: boolean;
  disableEnter?: boolean;
}

const stateClassName: Record<Exclude<KeyState, undefined>, string> = {
  correct: 'bg-green-500 text-white',
  present: 'bg-yellow-400 text-slate-800',
  absent: 'bg-gray-300 text-slate-800 opacity-80'
};

export function KeyboardCyr({ onKey, onEnter, onBackspace, keyStates = {}, disabled = false, disableEnter = false }: KeyboardCyrProps) {
  const handlePress = (value: string) => {
    if (disabled) return;
    
    triggerHaptic('light');
    
    if (value === 'ENTER') {
      onEnter?.();
      return;
    }
    if (value === 'DELETE') {
      onBackspace?.();
      return;
    }
    onKey(value);
  };

  return (
    <div className="flex flex-col gap-2 justify-center">
      {/* Letter keys */}
      {layout.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1">
          {row.map((label) => {
            const state = keyStates[label];
            
            // Render letter buttons
            return (
              <button
                key={label}
                type="button"
                onClick={() => handlePress(label)}
                disabled={disabled}
                className={clsx(
                  'flex-1 rounded-md bg-blue-100 h-12 text-sm font-semibold text-slate-800 shadow-sm transition active:scale-95 font-sans',
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
      
      {/* Action buttons row */}
      <div className="flex justify-center gap-1">
        <button
          type="button"
          onClick={() => handlePress('ENTER')}
          disabled={disabled || disableEnter}
          className={clsx(
            'flex-1 rounded-md bg-green-200 h-12 text-slate-800 shadow-sm transition active:scale-95 hover:bg-green-300 font-sans flex items-center justify-center text-sm font-semibold',
            (disabled || disableEnter) && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Отправить"
        >
          Отправить
        </button>
        <button
          type="button"
          onClick={() => handlePress('DELETE')}
          disabled={disabled}
          className={clsx(
            'flex-1 rounded-md bg-red-200 h-12 text-slate-800 shadow-sm transition active:scale-95 hover:bg-red-300 font-sans flex items-center justify-center text-sm font-semibold',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Очистить"
        >
          Очистить
        </button>
      </div>
    </div>
  );
}
