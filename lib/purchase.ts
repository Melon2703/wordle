'use client';

import { purchaseProduct, cleanupCancelledPurchase } from '@/lib/api';
import { invoice } from '@tma.js/sdk';
import { trackEvent } from '@/lib/analytics';

export type PurchaseOutcome = 'paid' | 'cancelled' | 'failed';

export interface PurchaseFlowOptions {
    /** Analytics event name prefix (e.g. 'arcade_hint_purchase_flow', 'shop_purchase_result'). */
    eventName: string;
    /** Extra params merged into every analytics event. */
    eventParams?: Record<string, unknown>;
    /** Called after a successful payment (before the function returns). */
    onPaid?: () => void | Promise<void>;
    /** Called after the user cancels the invoice. */
    onCancelled?: () => void;
}

/**
 * Shared purchase flow: create purchase → open Telegram invoice → handle result.
 *
 * Consolidates the identical pattern from:
 *   - app/arcade/page.tsx  (handleBuyGames, handleBuyExtraTries)
 *   - app/shop/page.tsx    (handlePurchase)
 *   - components/HintModal.tsx (handlePurchase)
 */
export async function executePurchaseFlow(
    productId: string,
    options: PurchaseFlowOptions
): Promise<PurchaseOutcome> {
    const { eventName, eventParams = {}, onPaid, onCancelled } = options;

    try {
        trackEvent(eventName, { ...eventParams, product_id: productId, stage: 'started' });

        const purchaseResult = await purchaseProduct(productId);
        const result = await invoice.openUrl(purchaseResult.invoice_url);

        if (result === 'paid') {
            await onPaid?.();
            trackEvent(eventName, { ...eventParams, product_id: productId, stage: 'completed' });
            return 'paid';
        }

        // Payment was cancelled — clean up the pending purchase
        try {
            await cleanupCancelledPurchase(purchaseResult.purchase_id);
        } catch {
            // Don't fail the whole operation if cleanup fails
        }
        onCancelled?.();
        trackEvent(eventName, { ...eventParams, product_id: productId, stage: 'cancelled' });
        return 'cancelled';

    } catch {
        trackEvent(eventName, { ...eventParams, product_id: productId, stage: 'failed' });
        return 'failed';
    }
}
