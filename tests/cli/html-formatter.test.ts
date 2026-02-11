import { describe, expect, it } from 'vitest';

import { HTMLFormatter } from '../../src/cli/formatters/html';
import type { FormatMeta, FormatOptions } from '../../src/cli/formatters/types';
import type { EmailData } from '../../src/cli/formatters/email-data';

const sampleEmails: EmailData[] = [
  {
    id: 1,
    from: 'alice@example.com',
    to: 'bob@example.com',
    subject: 'Hello World',
    date: '2024-01-15T10:30:00Z',
    isRead: false,
    isStarred: true,
    isFlagged: false,
    hasAttachments: false,
  },
  {
    id: 2,
    from: 'charlie@example.com',
    to: 'bob@example.com',
    subject: 'Meeting Tomorrow',
    date: '2024-01-16T14:00:00Z',
    isRead: true,
    isStarred: false,
    isFlagged: true,
    hasAttachments: true,
  },
];

const sampleMeta: FormatMeta = {
  total: 2,
  unread: 1,
  folder: 'INBOX',
  page: 1,
  totalPages: 1,
};

describe('HTMLFormatter', () => {
  const formatter = new HTMLFormatter();

  describe('formatList', () => {
    it('returns no-results message for empty data', () => {
      const output = formatter.formatList([], sampleMeta, {});
      expect(output).toBe('<p>No results found.</p>');
    });

    it('renders an HTML table with default fields', () => {
      const output = formatter.formatList(sampleEmails, sampleMeta, {});
      expect(output).toContain('<table>');
      expect(output).toContain('<th>ID</th>');
      expect(output).toContain('<th>From</th>');
      expect(output).toContain('<th>Subject</th>');
      expect(output).toContain('<th>Date</th>');
      expect(output).toContain('<th>Status</th>');
      expect(output).toContain('<td>1</td>');
      expect(output).toContain('<td>alice@example.com</td>');
      expect(output).toContain('</table>');
    });

    it('respects custom field selection', () => {
      const output = formatter.formatList(sampleEmails, sampleMeta, {
        fields: 'id,subject',
      });
      expect(output).toContain('<th>ID</th>');
      expect(output).toContain('<th>Subject</th>');
      expect(output).not.toContain('<th>From</th>');
      expect(output).not.toContain('<th>Date</th>');
    });

    it('supports field exclusion', () => {
      const output = formatter.formatList(sampleEmails, sampleMeta, {
        fields: '^isRead,^isStarred,^isFlagged,^hasAttachments,*',
      });
      expect(output).toContain('<th>ID</th>');
      expect(output).toContain('<th>From</th>');
      expect(output).not.toContain('<th>Status</th>');
    });

    it('includes pagination info', () => {
      const meta = { ...sampleMeta, totalPages: 3, page: 2, total: 30 };
      const output = formatter.formatList(sampleEmails, meta, {});
      expect(output).toContain('Page 2 of 3');
    });

    it('escapes HTML entities in data', () => {
      const emails: EmailData[] = [
        {
          id: 1,
          from: '<script>alert("xss")</script>',
          subject: 'Test & "Quotes"',
          date: '2024-01-15T10:30:00Z',
          isRead: true,
        },
      ];
      const output = formatter.formatList(emails, sampleMeta, {});
      expect(output).toContain('&lt;script&gt;');
      expect(output).toContain('&amp;');
      expect(output).toContain('&quot;Quotes&quot;');
      expect(output).not.toContain('<script>');
    });

    it('renders folder title in header', () => {
      const output = formatter.formatList(sampleEmails, sampleMeta, {});
      expect(output).toContain('<h2>INBOX');
    });
  });

  describe('formatDetail', () => {
    const detailEmail: EmailData = {
      id: 42,
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Detailed Email',
      date: '2024-03-20T09:00:00Z',
      isRead: false,
      isStarred: true,
      isFlagged: false,
      bodyText: 'Hello, this is the email body.',
      bodyHtml: '<p>Hello, this is the <b>email</b> body.</p>',
      attachments: [{ filename: 'doc.pdf', size: 1024 }],
    };

    it('renders email detail as HTML', () => {
      const output = formatter.formatDetail(detailEmail, {});
      expect(output).toContain('<div class="email-detail">');
      expect(output).toContain('<h2>Email Details</h2>');
      expect(output).toContain('<dt>ID</dt>');
      expect(output).toContain('<dd>42</dd>');
      expect(output).toContain('<dt>From</dt>');
      expect(output).toContain('<dd>sender@example.com</dd>');
      expect(output).toContain('<dt>Subject</dt>');
      expect(output).toContain('<dd>Detailed Email</dd>');
    });

    it('renders HTML body directly when available', () => {
      const output = formatter.formatDetail(detailEmail, {});
      expect(output).toContain('<div class="email-body">');
      expect(output).toContain('<p>Hello, this is the <b>email</b> body.</p>');
    });

    it('renders text body in pre tag when no HTML body', () => {
      const textOnly = { ...detailEmail, bodyHtml: undefined };
      const output = formatter.formatDetail(textOnly, {});
      expect(output).toContain('<pre>Hello, this is the email body.</pre>');
    });

    it('respects field selection in detail view', () => {
      const output = formatter.formatDetail(detailEmail, {
        fields: 'id,subject',
      });
      expect(output).toContain('<dd>42</dd>');
      expect(output).toContain('<dd>Detailed Email</dd>');
      expect(output).not.toContain('sender@example.com');
      expect(output).not.toContain('email-body');
    });

    it('shows attachment count', () => {
      const output = formatter.formatDetail(detailEmail, {});
      expect(output).toContain('1 attachment(s)');
    });

    it('shows unread status', () => {
      const output = formatter.formatDetail(detailEmail, {});
      expect(output).toContain('<dt>Status</dt>');
      expect(output).toContain('<dd>Unread</dd>');
    });
  });
});
