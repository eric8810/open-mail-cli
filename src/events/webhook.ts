import { createHmac } from 'node:crypto';

import logger from '../utils/logger';
import eventBus from './event-bus';
import type { MailEvent, WebhookConfig } from './types';

/**
 * Manages webhook delivery for mail events.
 * Sends HTTP POST requests with JSON payloads and optional HMAC signatures.
 */
class WebhookManager {
  private webhooks: WebhookConfig[];

  constructor() {
    this.webhooks = [];
  }

  /**
   * Load webhook configs and register event listeners.
   */
  init(webhooks: WebhookConfig[]): void {
    this.webhooks = webhooks;
    eventBus.on('*', (event: MailEvent) => this.handleEvent(event));
    logger.info('WebhookManager initialized', {
      count: webhooks.length,
    });
  }

  /**
   * Handle an incoming event by dispatching to matching webhooks.
   */
  private handleEvent(event: MailEvent): void {
    for (const webhook of this.webhooks) {
      if (!webhook.enabled) continue;
      if (!webhook.events.includes(event.type)) continue;
      void this.deliver(webhook, event);
    }
  }

  /**
   * Deliver an event payload to a webhook URL with retries.
   */
  async deliver(
    webhook: WebhookConfig,
    event: MailEvent,
    attempt = 1
  ): Promise<boolean> {
    const maxRetries = webhook.retryCount ?? 3;
    const body = JSON.stringify({
      type: event.type,
      timestamp: event.timestamp.toISOString(),
      data: event.data,
      accountId: event.accountId,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'open-mail-cli/webhook',
    };

    if (webhook.secret) {
      headers['X-Webhook-Signature'] = this.sign(body, webhook.secret);
    }

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      logger.info('Webhook delivered', {
        url: webhook.url,
        event: event.type,
      });
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Webhook delivery failed', {
        url: webhook.url,
        event: event.type,
        attempt,
        error: msg,
      });

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        await this.sleep(delay);
        return this.deliver(webhook, event, attempt + 1);
      }

      return false;
    }
  }

  /**
   * Compute HMAC-SHA256 signature for a payload.
   */
  sign(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Get current webhook configs.
   */
  getWebhooks(): WebhookConfig[] {
    return this.webhooks;
  }

  /**
   * Add a webhook config.
   */
  addWebhook(webhook: WebhookConfig): void {
    this.webhooks.push(webhook);
  }

  /**
   * Remove a webhook by ID.
   */
  removeWebhook(id: string): boolean {
    const idx = this.webhooks.findIndex((w) => w.id === id);
    if (idx === -1) return false;
    this.webhooks.splice(idx, 1);
    return true;
  }

  /**
   * Find a webhook by ID.
   */
  findWebhook(id: string): WebhookConfig | undefined {
    return this.webhooks.find((w) => w.id === id);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const webhookManager = new WebhookManager();
export { WebhookManager };
export default webhookManager;
