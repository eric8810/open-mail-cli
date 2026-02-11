import { randomUUID } from 'node:crypto';

import chalk from 'chalk';

import config from '../../config';
import { eventBus, webhookManager, EventTypes } from '../../events';
import type { WebhookConfig, MailEvent } from '../../events';
import logger from '../../utils/logger';

/**
 * Webhook command - Manage webhook integrations
 */
async function webhookCommand(
  action: string,
  args: string[],
  options: Record<string, unknown>
): Promise<void> {
  try {
    switch (action) {
      case 'add':
        return addWebhook(args[0] as string, options);
      case 'list':
        return listWebhooks();
      case 'remove':
        return removeWebhook(args[0] as string);
      case 'test':
        return testWebhook(args[0] as string);
      default:
        console.error(
          chalk.red(
            `Unknown webhook action: ${action}. Use: add|list|remove|test`
          )
        );
        process.exit(1);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('Error:'), msg);
    logger.error('Webhook command failed', { action, error: msg });
    process.exit(1);
  }
}

function loadWebhooks(): WebhookConfig[] {
  const cfg = config.load();
  return ((cfg as Record<string, unknown>).webhooks as WebhookConfig[]) ?? [];
}

function saveWebhooks(webhooks: WebhookConfig[]): void {
  const cfg = config.load();
  (cfg as Record<string, unknown>).webhooks = webhooks;
  config.save(cfg);
}

function addWebhook(url: string, options: Record<string, unknown>): void {
  if (!url) {
    console.error(chalk.red('Error: URL is required'));
    process.exit(1);
  }

  const eventsStr = (options.events as string) ?? '';
  const events = eventsStr
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (events.length === 0) {
    console.error(
      chalk.red(
        'Error: At least one event type is required (--events "email:received,email:sent")'
      )
    );
    process.exit(1);
  }

  const webhook: WebhookConfig = {
    id: randomUUID().slice(0, 8),
    url,
    events,
    secret: (options.secret as string) ?? undefined,
    enabled: true,
    retryCount: 3,
  };

  const webhooks = loadWebhooks();
  webhooks.push(webhook);
  saveWebhooks(webhooks);

  console.log(chalk.green('Webhook added'));
  console.log(chalk.gray(`  ID:     ${webhook.id}`));
  console.log(chalk.gray(`  URL:    ${webhook.url}`));
  console.log(chalk.gray(`  Events: ${webhook.events.join(', ')}`));
}

function listWebhooks(): void {
  const webhooks = loadWebhooks();

  if (webhooks.length === 0) {
    console.log(chalk.yellow('No webhooks configured'));
    return;
  }

  console.log(chalk.blue('Configured Webhooks:'));
  console.log();

  for (const wh of webhooks) {
    const status = wh.enabled ? chalk.green('enabled') : chalk.red('disabled');
    console.log(`  ${chalk.bold(wh.id)}  ${status}`);
    console.log(chalk.gray(`    URL:    ${wh.url}`));
    console.log(chalk.gray(`    Events: ${wh.events.join(', ')}`));
    console.log();
  }
}

function removeWebhook(id: string): void {
  if (!id) {
    console.error(chalk.red('Error: Webhook ID is required'));
    process.exit(1);
  }

  const webhooks = loadWebhooks();
  const idx = webhooks.findIndex((w) => w.id === id);

  if (idx === -1) {
    console.error(chalk.red(`Error: Webhook ${id} not found`));
    process.exit(1);
  }

  webhooks.splice(idx, 1);
  saveWebhooks(webhooks);
  console.log(chalk.green(`Webhook ${id} removed`));
}

async function testWebhook(id: string): Promise<void> {
  if (!id) {
    console.error(chalk.red('Error: Webhook ID is required'));
    process.exit(1);
  }

  const webhooks = loadWebhooks();
  const webhook = webhooks.find((w) => w.id === id);

  if (!webhook) {
    console.error(chalk.red(`Error: Webhook ${id} not found`));
    process.exit(1);
  }

  console.log(chalk.blue(`Testing webhook ${id}...`));

  const testEvent: MailEvent = {
    type: EventTypes.SYNC_COMPLETED,
    timestamp: new Date(),
    data: { test: true, message: 'Webhook test event' },
  };

  webhookManager.addWebhook(webhook);
  const success = await webhookManager.deliver(webhook, testEvent);

  if (success) {
    console.log(chalk.green('Webhook test successful'));
  } else {
    console.log(chalk.red('Webhook test failed'));
  }
}

export default webhookCommand;
