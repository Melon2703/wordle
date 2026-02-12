import { NextResponse, type NextRequest } from 'next/server';
import {
  isSupportedResource,
  isRelevantIssueAction,
  mapIssueAlertPayload,
  verifySentrySignature,
  computeSentrySignature,
  computeSentrySignatureWithTimestamp,
  buildHtmlTelegramMessage,
  deriveSecretKeys,
  escapeHtml
} from '@/lib/server/sentryWebhook';
import { sendSentryTelegramMessage, SentryTelegramError } from '@/lib/server/sentryTelegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const dedupeCache = new Map<string, number>();

export async function POST(request: NextRequest): Promise<Response> {
  const contentType = request.headers.get('content-type');
  if (!isJsonContentType(contentType)) {
    console.warn('Sentry webhook rejected: unsupported content type', { contentType });
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 });
  }

  const resource = (request.headers.get('sentry-hook-resource') ?? '').toLowerCase();
  if (!isSupportedResource(resource)) {
    console.warn('Sentry webhook rejected: unsupported resource', { resource });
    return NextResponse.json({ error: 'Unsupported resource' }, { status: 400 });
  }

  const rawBuffer = Buffer.from(await request.arrayBuffer());
  const rawBody = rawBuffer.toString('utf8');
  const signature = request.headers.get('sentry-hook-signature');
  const timestamp = request.headers.get('sentry-hook-timestamp');
  const secrets = parseSecrets(process.env.SENTRY_CLIENT_SECRET);

  if (secrets.length === 0) {
    console.error('Missing SENTRY_CLIENT_SECRET environment variable');
    return NextResponse.json({ error: 'Misconfigured webhook' }, { status: 500 });
  }

  let signatureMatch: { secretIndex: number; keyVariantIndex: number; method: 'body' | 'timestamp' } | null =
    null;

  for (let index = 0; index < secrets.length; index += 1) {
    const secret = secrets[index];
    const match = verifySentrySignature(rawBuffer, signature, secret, timestamp);
    if (match) {
      signatureMatch = { secretIndex: index, keyVariantIndex: match.keyVariantIndex, method: match.method };
      break;
    }
  }

  if (!signatureMatch) {
    const previews = secrets.map((secret, secretIndex) => {
      const keys = deriveSecretKeys(secret);
      return keys.map((key, keyVariantIndex) => ({
        secretIndex,
        keyVariantIndex,
        body: truncate(computeSentrySignature(rawBuffer, key).toString('hex'), 16),
        timestamp:
          timestamp && timestamp.length > 0
            ? truncate(
                computeSentrySignatureWithTimestamp(rawBuffer, timestamp, key).toString('hex'),
                16
              )
            : null
      }));
    });
    console.warn('Sentry webhook rejected: signature mismatch', {
      hasSignature: Boolean(signature),
      signaturePreview: signature ? truncate(signature, 16) : null,
      expectedPreviews: previews,
      signatureLength: signature?.length ?? 0,
      bodyLength: rawBuffer.length,
      clientSecretLengths: secrets.map((secret) => secret.length),
      timestamp,
      bodyPreview: truncate(rawBody, 160)
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.info('Sentry webhook signature verified', {
    resource,
    hasTimestamp: Boolean(timestamp),
    matchedSecretIndex: signatureMatch.secretIndex,
    keyVariantIndex: signatureMatch.keyVariantIndex,
    method: signatureMatch.method
  });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    console.error('Failed to parse Sentry payload', { error });
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isRelevantIssueAction((payload as { action?: string }).action)) {
    console.log('Sentry webhook ignored due to irrelevant action', {
      action: (payload as { action?: string }).action
    });
    return NextResponse.json({ ok: true, ignored: 'irrelevant_action' }, { status: 202 });
  }

  let alert;
  try {
    alert = mapIssueAlertPayload(payload);
  } catch (error) {
    console.error('Failed to map Sentry payload', { error, payloadPreview: truncate(rawBody, 500) });
    return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
  }

  if (alert.action === 'test') {
    const testMessage = `🧪 Sentry Test Notification – ${escapeHtml(alert.project)} : ${escapeHtml(alert.title)}`;
    try {
      await sendSentryTelegramMessage(testMessage);
      console.info('Sentry test notification forwarded to Telegram', {
        project: alert.project,
        title: alert.title
      });
      return NextResponse.json({ ok: true, test: true });
    } catch (error) {
      console.error('Failed to forward Sentry test alert to Telegram', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ...(error instanceof SentryTelegramError
          ? {
              status: error.status,
              description: error.description,
              errorCode: error.errorCode
            }
          : {})
      });
      return NextResponse.json({ error: 'Failed to deliver test alert' }, { status: 502 });
    }
  }

  const dedupeKey = `${alert.issueId}:${alert.eventId ?? 'unknown'}`;
  const now = Date.now();
  pruneDedupeCache(now);
  if (isDuplicate(dedupeKey, now)) {
    console.info('Sentry webhook ignored: duplicate event', { dedupeKey });
    return NextResponse.json({ ok: true, ignored: 'duplicate' }, { status: 202 });
  }

  const message = buildHtmlTelegramMessage(alert);

  try {
    await sendSentryTelegramMessage(message);
  } catch (error) {
    console.error('Failed to forward Sentry alert to Telegram', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ...(error instanceof SentryTelegramError
        ? {
            status: error.status,
            description: error.description,
            errorCode: error.errorCode
          }
        : {})
    });
    return NextResponse.json({ error: 'Failed to deliver alert' }, { status: 502 });
  }

  rememberKey(dedupeKey, now);

  console.info('Sentry webhook forwarded to Telegram', {
    action: alert.action,
    project: alert.project,
    environment: alert.environment,
    issueId: alert.issueId,
    eventId: alert.eventId ?? null
  });

  return NextResponse.json({ ok: true });
}

function isJsonContentType(headerValue: string | null): boolean {
  if (!headerValue) {
    return false;
  }
  return headerValue.toLowerCase().startsWith('application/json');
}

function pruneDedupeCache(now: number): void {
  for (const [key, expiresAt] of dedupeCache.entries()) {
    if (expiresAt <= now) {
      dedupeCache.delete(key);
    }
  }
}

function isDuplicate(key: string, now: number): boolean {
  const expiresAt = dedupeCache.get(key);
  if (!expiresAt) {
    return false;
  }
  if (expiresAt <= now) {
    dedupeCache.delete(key);
    return false;
  }
  return true;
}

function rememberKey(key: string, now: number): void {
  dedupeCache.set(key, now + DEDUPE_WINDOW_MS);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}…`;
}

function parseSecrets(value: string | undefined | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
