import { EventEmitter } from 'node:events';

import logger from '../utils/logger';
import type { MailEvent, EventType } from './types';

type EventHandler = (event: MailEvent) => void;

/**
 * Central event bus for the mail client.
 * Uses Node.js EventEmitter under the hood. Singleton.
 */
class EventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  /**
   * Emit a mail event to all registered listeners.
   */
  emit(event: MailEvent): void {
    logger.debug('Event emitted', {
      type: event.type,
      accountId: event.accountId ?? 'none',
    });
    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event);
  }

  /**
   * Register a handler for a specific event type.
   */
  on(type: EventType | string, handler: EventHandler): void {
    this.emitter.on(type, handler);
  }

  /**
   * Remove a previously registered handler.
   */
  off(type: EventType | string, handler: EventHandler): void {
    this.emitter.off(type, handler);
  }

  /**
   * Register a one-time handler for a specific event type.
   */
  once(type: EventType | string, handler: EventHandler): void {
    this.emitter.once(type, handler);
  }

  /**
   * Remove all listeners, optionally for a specific event type.
   */
  removeAllListeners(type?: EventType | string): void {
    if (type) {
      this.emitter.removeAllListeners(type);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get the number of listeners for a given event type.
   */
  listenerCount(type: EventType | string): number {
    return this.emitter.listenerCount(type);
  }
}

const eventBus = new EventBus();
export { EventBus };
export default eventBus;
