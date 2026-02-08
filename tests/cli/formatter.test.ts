import { describe, expect, it } from 'vitest';

const formatter = require('../../src/cli/utils/formatter.ts');

describe('cli formatter', () => {
  it('formats file sizes with readable units', () => {
    expect(formatter.formatFileSize(256)).toBe('256 B');
    expect(formatter.formatFileSize(2_048)).toBe('2.0 KB');
    expect(formatter.formatFileSize(2_097_152)).toBe('2.0 MB');
  });

  it('formats empty email list message', () => {
    const output = formatter.formatEmailList([]);

    expect(output).toContain('No emails found.');
  });

  it('formats sync result summary', () => {
    const output = formatter.formatSyncResults({
      folders: {
        INBOX: { newEmails: 3 },
        Spam: { error: 'Permission denied' },
      },
      totalNew: 3,
      totalErrors: 1,
    });

    expect(output).toContain('INBOX');
    expect(output).toContain('3 new emails');
    expect(output).toContain('Permission denied');
    expect(output).toContain('Total new emails:');
  });
});
