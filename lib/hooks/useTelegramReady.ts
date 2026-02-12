'use client';

import { useState, useEffect, useCallback } from 'react';
import { hasTelegramInitData, waitForTelegramInitData } from '@/lib/telegram';

/**
 * Consolidates the Telegram-ready polling pattern used across arcade, shop, and purchases pages.
 * Returns a boolean state tracking whether Telegram init data is available, and an async
 * helper to await readiness before performing operations that require it.
 */
export function useTelegramReady() {
    const [isTelegramReady, setIsTelegramReady] = useState(() => hasTelegramInitData());

    useEffect(() => {
        if (isTelegramReady) {
            return;
        }

        let isMounted = true;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const poll = () => {
            if (!isMounted) {
                return;
            }

            if (hasTelegramInitData()) {
                setIsTelegramReady(true);
                return;
            }

            timeoutId = setTimeout(poll, 100);
        };

        poll();

        return () => {
            isMounted = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [isTelegramReady]);

    const ensureTelegramReady = useCallback(async (): Promise<boolean> => {
        if (isTelegramReady) {
            return true;
        }

        const ready = await waitForTelegramInitData({ timeoutMs: 4000, intervalMs: 100 });
        if (ready) {
            setIsTelegramReady(true);
        }
        return ready;
    }, [isTelegramReady]);

    return { isTelegramReady, ensureTelegramReady } as const;
}
