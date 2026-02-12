'use client';

import { useState, useEffect } from 'react';

/**
 * Consolidates the countdown-timer logic duplicated in
 * app/page.tsx and formerly components/StateStrip.tsx.
 *
 * @param targetIso  ISO-8601 timestamp to count down to (e.g. `nextPuzzleAt`).
 *                   Pass `undefined`/`null` to disable the timer.
 * @param intervalMs How often to recalculate the remaining time (default: 60 000 ms).
 * @returns A human-readable countdown string, or an empty string when no target is set.
 */
export function useCountdown(targetIso: string | undefined | null, intervalMs = 60_000): string {
    const [text, setText] = useState('');

    useEffect(() => {
        if (!targetIso) {
            setText('');
            return;
        }

        const update = () => {
            const now = Date.now();
            const target = new Date(targetIso).getTime();
            const diff = target - now;

            if (diff <= 0) {
                setText('Новая загадка готова!');
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            if (hours > 0) {
                setText(`${hours} ч ${minutes} м`);
            } else {
                setText(`${minutes} м`);
            }
        };

        update();
        const id = setInterval(update, intervalMs);
        return () => clearInterval(id);
    }, [targetIso, intervalMs]);

    return text;
}
