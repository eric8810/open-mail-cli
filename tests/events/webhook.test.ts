import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebhookManager } from '../../src/events/webhook';
import { EventTypes } from '../../src/events/types';
import type { MailEvent, WebhookConfig } from '../../src/events/types';

vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../src/events/event-bus', () => ({
  default: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
}));

describe('WebhookManager', () => {
  let manager: WebhookManager;
  let fetchSpy: ReturnType<typeof vi.fn>;

  const testWebhook: WebhookConfig = {
    id: 'wh-1',
    url: 'https://example.com/hook',
    events: [EventTypes.EMAIL_SENT],
    secret: 'test-secret',
    enabled: true,
    retryCount: 2,
  };

  const testEvent: MailEvent = {
    type: EventTypes.EMAIL_SENT,
    timestamp: new Date('2025-01-01T00:00:00Z'),
    data: { to: 'user@example.com' },
  };

  beforeEach(() => {
    manager = new WebhookManager();
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delivers event to webhook URL', async () => {
    const result = await manager.deliver(testWebhook, testEvent);

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Webhook-Signature': expect.any(String),
        }),
      })
    );
  });

  it('includes correct JSON payload', async () => {
    await manager.deliver(testWebhook, testEvent);

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.type).toBe(EventTypes.EMAIL_SENT);
    expect(body.data.to).toBe('user@example.com');
    expect(body.timestamp).toBe('2025-01-01T00:00:00.000Z');
  });

  it('computes HMAC-SHA256 signature', () => {
    const sig = manager.sign('test-payload', 'secret');
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it('skips signature header when no secret', async () => {
    const noSecretWebhook = { ...testWebhook, secret: undefined };
    await manager.deliver(noSecretWebhook, testEvent);

    const headers = fetchSpy.mock.calls[0][1].headers;
    expect(headers['X-Webhook-Signature']).toBeUndefined();
  });

  it('retries on failure with exponential backoff', async () => {
    fetchSpy
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await manager.deliver(testWebhook, testEvent);

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns false after exhausting retries', async () => {
    fetchSpy.mockRejectedValue(new Error('network error'));

    const result = await manager.deliver(testWebhook, testEvent);

    expect(result).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns false on non-ok HTTP response after retries', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const result = await manager.deliver(testWebhook, testEvent);

    expect(result).toBe(false);
  });

  it('addWebhook and removeWebhook manage the list', () => {
    manager.addWebhook(testWebhook);
    expect(manager.getWebhooks()).toHaveLength(1);

    const removed = manager.removeWebhook('wh-1');
    expect(removed).toBe(true);
    expect(manager.getWebhooks()).toHaveLength(0);
  });

  it('removeWebhook returns false for unknown id', () => {
    expect(manager.removeWebhook('nonexistent')).toBe(false);
  });

  it('findWebhook returns the correct webhook', () => {
    manager.addWebhook(testWebhook);
    expect(manager.findWebhook('wh-1')).toEqual(testWebhook);
    expect(manager.findWebhook('nope')).toBeUndefined();
  });
});
