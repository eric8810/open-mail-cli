import { describe, expect, it } from 'vitest';

import { getFormatter } from '../../src/cli/formatters';
import { HTMLFormatter } from '../../src/cli/formatters/html';
import { MarkdownFormatter } from '../../src/cli/formatters/markdown';
import { JSONFormatter } from '../../src/cli/formatters/json';
import type { FormatMeta } from '../../src/cli/formatters/types';
import type { EmailData } from '../../src/cli/formatters/email-data';

const sampleEmails: EmailData[] = [
  {
    id: 1,
    from: 'alice@example.com',
    subject: 'Test Email',
    date: '2024-01-15T10:30:00Z',
    isRead: false,
  },
  {
    id: 2,
    from: 'bob@example.com',
    subject: 'Another Email',
    date: '2024-01-16T14:00:00Z',
    isRead: true,
  },
];

const meta: FormatMeta = {
  total: 2,
  unread: 1,
  folder: 'INBOX',
};

describe('formatter factory', () => {
  it('returns HTMLFormatter for html format', () => {
    expect(getFormatter('html')).toBeInstanceOf(HTMLFormatter);
  });

  it('returns MarkdownFormatter for markdown format', () => {
    expect(getFormatter('markdown')).toBeInstanceOf(MarkdownFormatter);
  });

  it('returns JSONFormatter for json format', () => {
    expect(getFormatter('json')).toBeInstanceOf(JSONFormatter);
  });
});

describe('--fields integration across formatters', () => {
  const formatters = [
    { name: 'markdown', instance: new MarkdownFormatter() },
    { name: 'json', instance: new JSONFormatter() },
    { name: 'html', instance: new HTMLFormatter() },
  ];

  for (const { name, instance } of formatters) {
    describe(`${name} formatter`, () => {
      it('uses default fields when --fields is not specified', () => {
        const output = instance.formatList(sampleEmails, meta, {});
        expect(output).toBeTruthy();
        expect(output.length).toBeGreaterThan(0);
      });

      it('selects specific fields with --fields', () => {
        const output = instance.formatList(sampleEmails, meta, {
          fields: 'id,subject',
        });
        expect(output).toBeTruthy();
        // Should contain subject data
        expect(output).toContain('Test Email');
        // Should not contain from field data (not selected)
        expect(output).not.toContain('alice@example.com');
      });

      it('supports field exclusion with ^', () => {
        const output = instance.formatList(sampleEmails, meta, {
          fields: '^from,*',
        });
        expect(output).toBeTruthy();
        expect(output).not.toContain('alice@example.com');
      });

      it('applies field selection to detail view', () => {
        const email: EmailData = {
          id: 1,
          from: 'test@example.com',
          subject: 'Detail Test',
          date: '2024-01-15T10:30:00Z',
          isRead: true,
          bodyText: 'Email body content',
        };
        const output = instance.formatDetail(email, {
          fields: 'id,subject',
        });
        expect(output).toBeTruthy();
        expect(output).toContain('Detail Test');
        expect(output).not.toContain('test@example.com');
      });
    });
  }
});
