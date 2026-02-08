import { describe, expect, it } from 'vitest';

const matcher = require('../../src/filters/matcher.ts');

describe('filter matcher', () => {
  const sampleEmail = {
    from: 'Alice <alice@example.com>',
    to: 'bob@example.com',
    cc: '',
    subject: 'Weekly Report',
    bodyText: 'Please review this week report.',
    bodyHtml: '',
    hasAttachments: true,
    folder: 'INBOX',
    date: '2026-02-08T10:00:00.000Z',
  };

  it('matches string conditions case-insensitively', () => {
    expect(
      matcher.matchCondition(sampleEmail, {
        field: 'subject',
        operator: 'contains',
        value: 'weekly',
      })
    ).toBe(true);

    expect(
      matcher.matchCondition(sampleEmail, {
        field: 'from',
        operator: 'starts_with',
        value: 'alice',
      })
    ).toBe(true);
  });

  it('supports numeric and boolean operators', () => {
    expect(
      matcher.matchCondition(sampleEmail, {
        field: 'has_attachments',
        operator: 'equals',
        value: 'true',
      })
    ).toBe(true);

    expect(
      matcher.matchCondition(sampleEmail, {
        field: 'size',
        operator: 'greater_than',
        value: '10',
      })
    ).toBe(true);
  });

  it('handles invalid regex gracefully', () => {
    expect(
      matcher.matchCondition(sampleEmail, {
        field: 'subject',
        operator: 'matches_regex',
        value: '[',
      })
    ).toBe(false);
  });

  it('supports all/any condition sets', () => {
    const conditions = [
      { field: 'folder', operator: 'equals', value: 'INBOX' },
      { field: 'subject', operator: 'contains', value: 'Report' },
    ];

    expect(matcher.matchAll(sampleEmail, conditions)).toBe(true);
    expect(matcher.matchAny(sampleEmail, conditions)).toBe(true);
    expect(
      matcher.matchAll(sampleEmail, [
        { field: 'folder', operator: 'equals', value: 'Spam' },
      ])
    ).toBe(false);
  });
});
