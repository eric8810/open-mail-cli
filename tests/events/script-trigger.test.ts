import { describe, expect, it, vi } from 'vitest';

import { ScriptTrigger } from '../../src/events/script-trigger';
import { EventTypes } from '../../src/events/types';
import type { MailEvent, ScriptTriggerConfig } from '../../src/events/types';

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

describe('ScriptTrigger', () => {
  const testEvent: MailEvent = {
    type: EventTypes.EMAIL_RECEIVED,
    timestamp: new Date('2025-01-01T00:00:00Z'),
    data: { from: 'sender@example.com', subject: 'Test' },
    accountId: 'acc-1',
  };

  it('executes a command and returns exit code 0', async () => {
    const trigger = new ScriptTrigger();
    const config: ScriptTriggerConfig = {
      id: 'tr-1',
      command: 'cat > /dev/null',
      events: [EventTypes.EMAIL_RECEIVED],
      enabled: true,
      timeout: 5000,
    };

    const code = await trigger.execute(config, testEvent);
    expect(code).toBe(0);
  });

  it('returns non-zero for failing command', async () => {
    const trigger = new ScriptTrigger();
    const config: ScriptTriggerConfig = {
      id: 'tr-2',
      command: 'exit 42',
      events: [EventTypes.EMAIL_RECEIVED],
      enabled: true,
      timeout: 5000,
    };

    const code = await trigger.execute(config, testEvent);
    expect(code).toBe(42);
  });

  it('returns 1 for non-existent command', async () => {
    const trigger = new ScriptTrigger();
    const config: ScriptTriggerConfig = {
      id: 'tr-3',
      command: '/nonexistent/binary/xyz',
      events: [EventTypes.EMAIL_RECEIVED],
      enabled: true,
      timeout: 5000,
    };

    const code = await trigger.execute(config, testEvent);
    expect(code).toBeGreaterThan(0);
  });

  it('passes event data as JSON via stdin', async () => {
    const trigger = new ScriptTrigger();
    const config: ScriptTriggerConfig = {
      id: 'tr-4',
      command:
        "python3 -c \"import sys,json; d=json.load(sys.stdin); assert d['type']=='email:received'\"",
      events: [EventTypes.EMAIL_RECEIVED],
      enabled: true,
      timeout: 5000,
    };

    const code = await trigger.execute(config, testEvent);
    expect(code).toBe(0);
  });

  it('getTriggers returns configured triggers', () => {
    const trigger = new ScriptTrigger();
    expect(trigger.getTriggers()).toEqual([]);

    trigger.init([
      {
        id: 'tr-5',
        command: 'echo hi',
        events: [EventTypes.EMAIL_SENT],
        enabled: true,
      },
    ]);

    expect(trigger.getTriggers()).toHaveLength(1);
  });
});
