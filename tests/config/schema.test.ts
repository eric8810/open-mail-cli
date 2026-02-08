import { describe, expect, it } from 'vitest';

import { validateConfig } from '../../src/config/schema.ts';

describe('config schema', () => {
  it('validates a correct config object', () => {
    const result = validateConfig({
      imap: {
        host: 'imap.example.com',
        user: 'user@example.com',
        password: 'secret',
        port: 993,
      },
      smtp: {
        host: 'smtp.example.com',
        user: 'user@example.com',
        password: 'secret',
        port: 465,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports missing required fields and invalid ports', () => {
    const result = validateConfig({
      imap: {
        host: '',
        user: '',
        password: '',
        port: 0,
      },
      smtp: {
        host: '',
        user: '',
        password: '',
        port: 99999,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('IMAP host is required');
    expect(result.errors).toContain('SMTP port must be between 1 and 65535');
  });
});
