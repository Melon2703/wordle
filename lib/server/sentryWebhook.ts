import crypto from 'crypto';

export type SupportedSentryResource = 'issue' | 'event_alert';

export const SUPPORTED_RESOURCES: ReadonlySet<SupportedSentryResource> = new Set([
  'issue',
  'event_alert'
]);

export function isSupportedResource(value: string): value is SupportedSentryResource {
  return SUPPORTED_RESOURCES.has(value as SupportedSentryResource);
}

export type SentryIssueAlert = {
  action: string;
  project: string;
  environment: string;
  level: string;
  title: string;
  culprit?: string;
  issueUrl: string;
  issueId: string;
  eventId?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
};

const RELEVANT_ACTIONS = new Set(['created', 'regressed', 'escalating', 'triggered']);

export function isRelevantIssueAction(action: string | undefined | null): boolean {
  return action !== undefined && action !== null && RELEVANT_ACTIONS.has(action);
}

export type SignatureMatch = {
  keyVariantIndex: number;
  method: 'body' | 'timestamp';
};

export function verifySentrySignature(
  rawBody: string | Buffer,
  providedSignature: string | null | undefined,
  clientSecret: string,
  timestamp: string | null | undefined
): SignatureMatch | null {
  if (!providedSignature) {
    return null;
  }

  const extracted = extractSignatureValue(providedSignature);
  if (!extracted) {
    return null;
  }

  let given: Buffer;
  try {
    given = Buffer.from(extracted, 'hex');
  } catch {
    return null;
  }

  const bodyBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;

  const secretKeys = deriveSecretKeys(clientSecret);

  for (let index = 0; index < secretKeys.length; index += 1) {
    const key = secretKeys[index];

    const bodySignature = computeSentrySignature(bodyBuffer, key);
    if (given.length === bodySignature.length && crypto.timingSafeEqual(given, bodySignature)) {
      return { keyVariantIndex: index, method: 'body' };
    }

    if (timestamp) {
      const timestampSignature = computeSentrySignatureWithTimestamp(bodyBuffer, timestamp, key);
      if (
        given.length === timestampSignature.length &&
        crypto.timingSafeEqual(given, timestampSignature)
      ) {
        return { keyVariantIndex: index, method: 'timestamp' };
      }
    }
  }

  return null;
}

export function computeSentrySignature(rawBody: string | Buffer, key: Buffer): Buffer {
  const bodyBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  return crypto.createHmac('sha256', key).update(bodyBuffer).digest();
}

export function computeSentrySignatureWithTimestamp(
  rawBody: string | Buffer,
  timestamp: string,
  key: Buffer
): Buffer {
  const bodyBuffer = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const payload = Buffer.concat([Buffer.from(timestamp, 'utf8'), Buffer.from('.', 'utf8'), bodyBuffer]);
  return crypto.createHmac('sha256', key).update(payload).digest();
}

export function deriveSecretKeys(clientSecret: string): Buffer[] {
  const keys: Buffer[] = [];

  const trimmed = clientSecret.trim();
  if (trimmed.length === 0) {
    return keys;
  }

  keys.push(Buffer.from(trimmed, 'utf8'));

  const isHex = /^[a-f0-9]+$/i.test(trimmed) && trimmed.length % 2 === 0;
  if (isHex) {
    try {
      keys.push(Buffer.from(trimmed, 'hex'));
    } catch {
      // ignore invalid hex
    }
  }

  const isBase64 =
    /^[a-z0-9+/]+=*$/i.test(trimmed) && (trimmed.length % 4 === 0 || trimmed.endsWith('=='));
  if (isBase64) {
    try {
      keys.push(Buffer.from(trimmed, 'base64'));
    } catch {
      // ignore invalid base64
    }
  }

  return dedupeBuffers(keys);
}

function dedupeBuffers(buffers: Buffer[]): Buffer[] {
  const seen = new Set<string>();
  const result: Buffer[] = [];
  for (const buffer of buffers) {
    const key = buffer.toString('base64');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(buffer);
    }
  }
  return result;
}

export function extractSignatureValue(headerValue: string): string | null {
  const trimmed = headerValue.trim();
  if (!trimmed) {
    return null;
  }

  const commaParts = trimmed.split(',');
  if (commaParts.length > 1) {
    for (const part of commaParts) {
      const [rawKey, rawValue] = part.split('=').map((value) => value?.trim());
      if (!rawKey || !rawValue) {
        continue;
      }
      if (rawKey === 'v0' || rawKey === 'v1') {
        return rawValue;
      }
    }
  }

  const parts = trimmed.split('=');
  if (parts.length === 2 && parts[1]) {
    return parts[1];
  }

  if (/^[a-f0-9]+$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function mapIssueAlertPayload(payload: unknown): SentryIssueAlert {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload: expected object');
  }

  const record = payload as Record<string, unknown>;
  const action = typeof record.action === 'string' ? record.action : '';
  const data = (record.data as Record<string, unknown>) ?? {};
  const issue = (data.issue as Record<string, unknown>) ?? {};
  const event = (data.event as Record<string, unknown>) ?? {};
  const project = (data.project as Record<string, unknown>) ?? {};

  const projectSlug =
    (typeof issue.project === 'object' && issue.project && 'slug' in issue.project
      ? (issue.project as { slug?: string }).slug
      : undefined) ??
    (typeof project.slug === 'string' ? project.slug : undefined) ??
    'unknown';

  const environment =
    (typeof event.environment === 'string' && event.environment) ||
    (typeof issue.environment === 'string' && issue.environment) ||
    (typeof project.environment === 'string' && project.environment) ||
    (Array.isArray(event.tags)
      ? findTagValue(event.tags as Array<{ key?: string; value?: string }>, 'environment')
      : undefined) ||
    'unknown';

  const level =
    (typeof event.level === 'string' && event.level) ||
    (typeof issue.level === 'string' && issue.level) ||
    'error';

  const title =
    (typeof event.title === 'string' && event.title) ||
    (typeof issue.title === 'string' && issue.title) ||
    'Sentry issue';

  const culprit =
    (typeof event.culprit === 'string' && event.culprit) ||
    (typeof issue.culprit === 'string' && issue.culprit) ||
    (typeof event.url === 'string' && event.url) ||
    undefined;

  const issueUrl =
    (typeof issue.permalink === 'string' && issue.permalink) ||
    (typeof issue.webUrl === 'string' && issue.webUrl) ||
    (typeof event.web_url === 'string' && event.web_url) ||
    (typeof event.url === 'string' && event.url) ||
    'https://sentry.io';

  const issueIdRaw =
    issue.id ??
    (typeof event.issue_id === 'string' ? event.issue_id : undefined) ??
    (typeof event.group_id === 'string' ? event.group_id : undefined) ??
    (typeof event.groupID === 'string' ? event.groupID : undefined);

  const eventId =
    typeof event.event_id === 'string'
      ? event.event_id
      : typeof event.id === 'string'
        ? event.id
        : undefined;

  const issueId =
    issueIdRaw !== undefined && issueIdRaw !== null
      ? typeof issueIdRaw === 'string'
        ? issueIdRaw
        : String(issueIdRaw)
      : eventId;

  if (!issueId) {
    throw new Error('Invalid payload: missing identifiers');
  }

  return {
    action,
    project: projectSlug,
    environment,
    level,
    title,
    culprit,
    issueUrl,
    issueId,
    eventId,
    firstSeenAt: typeof issue.firstSeen === 'string' ? issue.firstSeen : undefined,
    lastSeenAt: typeof issue.lastSeen === 'string' ? issue.lastSeen : undefined
  };
}

function findTagValue(
  tags: Array<{ key?: string; value?: string } | [unknown, unknown]>,
  key: string
): string | undefined {
  for (const tag of tags) {
    if (tag && typeof tag === 'object' && !Array.isArray(tag)) {
      if ('key' in tag && 'value' in tag && tag.key === key && typeof tag.value === 'string') {
        if (tag.value) {
          return tag.value;
        }
      }
    } else if (Array.isArray(tag)) {
      const [tupleKey, tupleValue] = tag;
      if (tupleKey === key && typeof tupleValue === 'string' && tupleValue) {
        return tupleValue;
      }
    }
  }
  return undefined;
}

export function buildTelegramAlertMessage(alert: SentryIssueAlert, maxLength = 350): string {
  const header = `🟣 Sentry • ${alert.project} • ${alert.environment}/${alert.level}`;
  const footer = `View: ${alert.issueUrl}`;
  const maxBodyLength = Math.max(maxLength - footer.length - 1, 0); // account for trailing newline

  let titleLine = alert.title;
  let culpritLine = alert.culprit ?? '';

  let bodyLines = composeBodyLines(header, titleLine, culpritLine);
  let body = bodyLines.join('\n');

  if (body.length > maxBodyLength && culpritLine) {
    const overflow = body.length - maxBodyLength;
    const targetLength = Math.max(culpritLine.length - overflow, Math.ceil(maxBodyLength * 0.25));
    culpritLine =
      targetLength > 0 ? truncateWithEllipsis(alert.culprit!, targetLength) : '';
    bodyLines = composeBodyLines(header, titleLine, culpritLine);
    body = bodyLines.join('\n');
  }

  if (body.length > maxBodyLength) {
    const overflow = body.length - maxBodyLength;
    const targetLength = Math.max(titleLine.length - overflow, Math.ceil(maxBodyLength * 0.4));
    titleLine = truncateWithEllipsis(alert.title, Math.max(targetLength, 24));
    bodyLines = composeBodyLines(header, titleLine, culpritLine);
    body = bodyLines.join('\n');
  }

  if (body.length > maxBodyLength && culpritLine) {
    culpritLine = '';
    bodyLines = composeBodyLines(header, titleLine, culpritLine);
    body = bodyLines.join('\n');
  }

  if (body.length > maxBodyLength) {
    body = truncateWithEllipsis(body, maxBodyLength);
  }

  return `${body}\n${footer}`;
}

function composeBodyLines(header: string, title: string, culprit: string): string[] {
  const lines = [header, title];
  if (culprit) {
    lines.push(culprit);
  }
  return lines;
}

function truncateWithEllipsis(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  if (maxLength <= 1) {
    return value.slice(0, maxLength);
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

const HTML_ESCAPE_REGEXP = /[&<>"']/g;
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

export function escapeHtml(input: string): string {
  return input.replace(HTML_ESCAPE_REGEXP, (char) => HTML_ESCAPES[char] ?? char);
}

export function buildHtmlTelegramMessage(alert: SentryIssueAlert): string {
  const message = buildTelegramAlertMessage(alert);
  return message
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('\n');
}
