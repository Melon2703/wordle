import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifySentrySignature,
  mapIssueAlertPayload,
  buildTelegramAlertMessage,
  buildHtmlTelegramMessage,
  computeSentrySignatureWithTimestamp,
  computeSentrySignature,
  deriveSecretKeys
} from '@/lib/server/sentryWebhook';

test('verifySentrySignature accepts valid signatures and rejects invalid ones', () => {
  const secret = 'super-secret';
  const payload = JSON.stringify({ hello: 'world' });
  const [key] = deriveSecretKeys(secret);
  const signature = computeSentrySignature(payload, key).toString('hex');

  assert.deepEqual(verifySentrySignature(payload, signature, secret, null), {
    keyVariantIndex: 0,
    method: 'body'
  });
  assert.deepEqual(verifySentrySignature(payload, `v0=${signature}`, secret, null), {
    keyVariantIndex: 0,
    method: 'body'
  });
  assert.equal(verifySentrySignature(payload, 'invalid-signature', secret, null), null);
  assert.equal(verifySentrySignature(payload, null, secret, null), null);
});

test('verifySentrySignature accepts timestamp-prefixed signatures', () => {
  const secret = 'super-secret';
  const payload = JSON.stringify({ hello: 'world' });
  const timestamp = '1730700000';
  const [key] = deriveSecretKeys(secret);
  const signature = computeSentrySignatureWithTimestamp(payload, timestamp, key).toString('hex');

  assert.deepEqual(verifySentrySignature(payload, signature, secret, timestamp), {
    keyVariantIndex: 0,
    method: 'timestamp'
  });
});

test('mapIssueAlertPayload extracts core fields from an issue payload', () => {
  const payload = {
    action: 'created',
    data: {
      issue: {
        id: '12345',
        title: 'TypeError: Cannot read property',
        culprit: 'MyService.doThing',
        firstSeen: '2024-07-01T10:00:00Z',
        lastSeen: '2024-07-01T10:05:00Z',
        project: { slug: 'example-project' },
        permalink: 'https://sentry.io/issues/12345'
      },
      event: {
        event_id: 'abcdef1234567890',
        environment: 'production',
        level: 'error',
        title: 'TypeError: Cannot read property of undefined',
        culprit: 'MyService.doThing',
        url: 'https://sentry.io/events/abcdef1234567890',
        tags: [
          { key: 'environment', value: 'production' },
          { key: 'release', value: '1.0.0' }
        ]
      },
      project: { slug: 'ignored-project' }
    }
  };

  const alert = mapIssueAlertPayload(payload);

  assert.equal(alert.project, 'example-project');
  assert.equal(alert.environment, 'production');
  assert.equal(alert.level, 'error');
  assert.equal(alert.title, 'TypeError: Cannot read property of undefined');
  assert.equal(alert.culprit, 'MyService.doThing');
  assert.equal(alert.issueUrl, 'https://sentry.io/issues/12345');
  assert.equal(alert.issueId, '12345');
  assert.equal(alert.eventId, 'abcdef1234567890');
  assert.equal(alert.firstSeenAt, '2024-07-01T10:00:00Z');
  assert.equal(alert.lastSeenAt, '2024-07-01T10:05:00Z');
});

test('buildTelegramAlertMessage enforces the character budget', () => {
  const alert = {
    action: 'created',
    project: 'very-long-project-name-to-test-truncation-behaviour',
    environment: 'production',
    level: 'error',
    title: 'A'.repeat(400),
    culprit: 'B'.repeat(250),
    issueUrl: 'https://sentry.io/issues/12345',
    issueId: '12345'
  };

  const message = buildTelegramAlertMessage(alert);

  assert.ok(message.length <= 350);
  assert.ok(message.includes('…'));
});

test('buildHtmlTelegramMessage escapes reserved characters', () => {
  const alert = {
    action: 'created',
    project: 'proj',
    environment: 'production',
    level: 'error',
    title: '<script>alert("xss")</script>',
    culprit: 'doWork & fail',
    issueUrl: 'https://sentry.io/issues/12345?query=<bad>',
    issueId: '12345'
  };

  const html = buildHtmlTelegramMessage(alert);

  assert(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
  assert.ok(html.includes('doWork &amp; fail'));
});
