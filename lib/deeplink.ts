// Deep link utilities for Telegram Mini App share feature
// why: Decodes tgWebAppStartParam to route users to shared results (docs/backend/Backend_Documentation.md §A.2)

import type { SharePayload } from './types';

/**
 * Encodes share data into a base64url-safe string for Telegram deep links.
 * Format: share_v1_<base64url-encoded-payload>
 */
export function encodeShareParam(payload: SharePayload): string {
  try {
    const json = JSON.stringify(payload);
    const base64 = Buffer.from(json, 'utf-8').toString('base64');
    // Make base64 URL-safe: replace + with -, / with _, and remove padding
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return `share_v1_${base64url}`;
  } catch (error) {
    console.error('Failed to encode share param:', error);
    throw new Error('Invalid share payload');
  }
}

/**
 * Decodes a Telegram start_param into share data.
 * Throws if the param is not a valid share link.
 */
export function decodeShareParam(startParam: string): SharePayload | null {
  try {
    if (!startParam.startsWith('share_v1_')) {
      return null;
    }

    const base64url = startParam.slice(9); // Remove 'share_v1_' prefix
    // Restore base64 padding and characters
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - base64url.length % 4) % 4);
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    const payload = JSON.parse(json) as SharePayload;

    // Validate schema version
    if (payload.v !== 1) {
      console.warn('Unsupported share payload version:', payload.v);
      return null;
    }

    // Validate required fields
    if (!payload.mode || !payload.ref || typeof payload.attempts !== 'number') {
      console.warn('Invalid share payload structure:', payload);
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Failed to decode share param:', error);
    return null;
  }
}

/**
 * Extracts tgWebAppStartParam from window.Telegram.WebApp.initDataUnsafe
 */
export function getTelegramStartParam(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const telegram = (window as { Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } } }).Telegram;
  return telegram?.WebApp?.initDataUnsafe?.start_param ?? null;
}

/**
 * Checks if current app was opened via a share deep link
 */
export function isShareDeepLink(): boolean {
  const startParam = getTelegramStartParam();
  return startParam !== null && startParam.startsWith('share_v1_');
}

