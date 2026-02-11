import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EventBus } from '../../src/events/event-bus';
import { EventTypes } from '../../src/events/types';
import type { MailEvent } from '../../src/events/types';

vi.mock('../../src/utils/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  afterEach(() => {
    bus.removeAllListeners();
  });

  it('emits events to registered handlers', () => {
    const handler = vi.fn();
    bus.on(EventTypes.EMAIL_SENT, handler);

    const event: MailEvent = {
      type: EventTypes.EMAIL_SENT,
      timestamp: new Date(),
      data: { to: 'test@example.com' },
    };

    bus.emit(event);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('does not call handler for unrelated event types', () => {
    const handler = vi.fn();
    bus.on(EventTypes.EMAIL_SENT, handler);

    bus.emit({
      type: EventTypes.EMAIL_DELETED,
      timestamp: new Date(),
      data: {},
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('wildcard listener receives all events', () => {
    const handler = vi.fn();
    bus.on('*', handler);

    bus.emit({
      type: EventTypes.EMAIL_SENT,
      timestamp: new Date(),
      data: {},
    });

    bus.emit({
      type: EventTypes.SYNC_COMPLETED,
      timestamp: new Date(),
      data: {},
    });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('once handler fires only once', () => {
    const handler = vi.fn();
    bus.once(EventTypes.EMAIL_SENT, handler);

    const event: MailEvent = {
      type: EventTypes.EMAIL_SENT,
      timestamp: new Date(),
      data: {},
    };

    bus.emit(event);
    bus.emit(event);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('off removes a handler', () => {
    const handler = vi.fn();
    bus.on(EventTypes.EMAIL_SENT, handler);
    bus.off(EventTypes.EMAIL_SENT, handler);

    bus.emit({
      type: EventTypes.EMAIL_SENT,
      timestamp: new Date(),
      data: {},
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('removeAllListeners clears all handlers', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on(EventTypes.EMAIL_SENT, h1);
    bus.on(EventTypes.EMAIL_DELETED, h2);

    bus.removeAllListeners();

    bus.emit({
      type: EventTypes.EMAIL_SENT,
      timestamp: new Date(),
      data: {},
    });

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it('listenerCount returns correct count', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on(EventTypes.EMAIL_SENT, h1);
    bus.on(EventTypes.EMAIL_SENT, h2);

    expect(bus.listenerCount(EventTypes.EMAIL_SENT)).toBe(2);
    expect(bus.listenerCount(EventTypes.EMAIL_DELETED)).toBe(0);
  });

  it('includes accountId in emitted events', () => {
    const handler = vi.fn();
    bus.on(EventTypes.SYNC_COMPLETED, handler);

    const event: MailEvent = {
      type: EventTypes.SYNC_COMPLETED,
      timestamp: new Date(),
      data: { folders: ['INBOX'] },
      accountId: 'acc-1',
    };

    bus.emit(event);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'acc-1' })
    );
  });
});
