import { spawn } from 'node:child_process';

import logger from '../utils/logger';
import eventBus from './event-bus';
import type { MailEvent, ScriptTriggerConfig } from './types';

/**
 * Executes shell commands in response to mail events.
 * Event data is passed as JSON via stdin.
 */
class ScriptTrigger {
  private triggers: ScriptTriggerConfig[];

  constructor() {
    this.triggers = [];
  }

  /**
   * Load trigger configs and register event listeners.
   */
  init(triggers: ScriptTriggerConfig[]): void {
    this.triggers = triggers;
    eventBus.on('*', (event: MailEvent) => this.handleEvent(event));
    logger.info('ScriptTrigger initialized', {
      count: triggers.length,
    });
  }

  /**
   * Handle an incoming event by running matching scripts.
   */
  private handleEvent(event: MailEvent): void {
    for (const trigger of this.triggers) {
      if (!trigger.enabled) continue;
      if (!trigger.events.includes(event.type)) continue;
      void this.execute(trigger, event);
    }
  }

  /**
   * Execute a shell command, piping event data as JSON to stdin.
   */
  execute(trigger: ScriptTriggerConfig, event: MailEvent): Promise<number> {
    const timeout = trigger.timeout ?? 30_000;

    return new Promise((resolve) => {
      const child = spawn(trigger.command, {
        shell: true,
        timeout,
        env: {
          ...process.env,
          MAIL_EVENT_TYPE: event.type,
          MAIL_EVENT_ACCOUNT: event.accountId ?? '',
        },
      });

      const payload = JSON.stringify({
        type: event.type,
        timestamp: event.timestamp.toISOString(),
        data: event.data,
        accountId: event.accountId,
      });

      child.stdin.on('error', () => {
        // Ignore EPIPE — child may exit before stdin is consumed
      });
      child.stdin.write(payload);
      child.stdin.end();

      child.on('close', (code) => {
        const exitCode = code ?? 1;
        if (exitCode !== 0) {
          logger.error('Script trigger exited with error', {
            command: trigger.command,
            event: event.type,
            exitCode,
          });
        } else {
          logger.info('Script trigger completed', {
            command: trigger.command,
            event: event.type,
          });
        }
        resolve(exitCode);
      });

      child.on('error', (err) => {
        logger.error('Script trigger failed to start', {
          command: trigger.command,
          error: err.message,
        });
        resolve(1);
      });
    });
  }

  /**
   * Get current trigger configs.
   */
  getTriggers(): ScriptTriggerConfig[] {
    return this.triggers;
  }
}

const scriptTrigger = new ScriptTrigger();
export { ScriptTrigger };
export default scriptTrigger;
