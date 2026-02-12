'use client';

import clsx from 'clsx';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { triggerHaptic } from './HapticsBridge';
import type { LetterState } from '@/lib/types';

type KeyState = LetterState | undefined;

const layout: string[][] = [
  ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х'],
  ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
  ['ENTER', 'Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', 'DELETE']
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
      if (!disableEnter) {
        onEnter?.();
      }
      return;
    }
    if (value === 'DELETE') {
      onBackspace?.();
      return;
    }
    onKey(value);
  };

  return (
    <div className="flex flex-col gap-2 justify-center select-none touch-manipulation">
      {layout.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1">
          {row.map((label) => {
            const isEnter = label === 'ENTER';
            const isDelete = label === 'DELETE';
            const isSpecial = isEnter || isDelete;
            const state = !isSpecial ? keyStates[label] : undefined;

            const baseClasses = "relative flex-1 rounded-md h-12 flex items-center justify-center text-sm font-semibold shadow-sm transition-all active:scale-95 font-sans";

            let colorClasses = "bg-blue-100 text-slate-800";
            if (state) {
              colorClasses = stateClassName[state];
            } else if (isEnter) {
              colorClasses = "bg-green-200 hover:bg-green-300 text-slate-800";
              if (disabled || disableEnter) colorClasses += " opacity-50 cursor-not-allowed";
            } else if (isDelete) {
              colorClasses = "bg-red-200 hover:bg-red-300 text-slate-800";
              if (disabled) colorClasses += " opacity-50 cursor-not-allowed";
            } else if (disabled) {
              colorClasses += " opacity-50 cursor-not-allowed";
            }

            return (
              <button
                key={label}
                type="button"
                onClick={() => handlePress(label)}
                disabled={disabled || (isEnter && disableEnter)}
                className={clsx(baseClasses, colorClasses, "group overflow-visible active:z-10")}
                aria-label={isEnter ? "Отправить" : isDelete ? "Очистить" : `key ${label}`}
              >
                {isEnter ? (
                  <ArrowRight className="w-6 h-6" />
                ) : isDelete ? (
                  <ArrowLeft className="w-6 h-6" />
                ) : (
                  <>
                    <span className="relative z-10">{label}</span>
                    {/* iOS Pop-up Bubble */}
                    {!disabled && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-active:flex flex-col items-center pointer-events-none z-50">
                        <div className={clsx(
                          "w-16 h-16 rounded-lg flex items-center justify-center text-3xl font-bold shadow-xl mb-[-10px]",
                          state ? stateClassName[state] : "bg-blue-100 text-slate-800"
                        )}>
                          {label}
                        </div>
                        <div className={clsx(
                          "w-4 h-4 rotate-45 transform",
                          state ? stateClassName[state] : "bg-blue-100"
                        )} />
                      </div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
