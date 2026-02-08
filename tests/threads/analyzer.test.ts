import { describe, expect, it } from 'vitest';

const analyzer = require('../../src/threads/analyzer.ts');

describe('thread analyzer', () => {
  it('normalizes common reply and forward prefixes', () => {
    expect(analyzer.normalizeSubject('Re: Project Update')).toBe(
      'project update'
    );
    expect(analyzer.normalizeSubject('Fwd: Project Update')).toBe(
      'project update'
    );
    expect(analyzer.normalizeSubject('')).toBe('');
  });

  it('builds relationships via in-reply-to and references', () => {
    const emails = [
      {
        id: 1,
        messageId: '<a@example.com>',
        inReplyTo: null,
        references: null,
        subject: 'Project Update',
        date: '2026-02-07T08:00:00.000Z',
      },
      {
        id: 2,
        messageId: '<b@example.com>',
        inReplyTo: '<a@example.com>',
        references: null,
        subject: 'Re: Project Update',
        date: '2026-02-07T09:00:00.000Z',
      },
      {
        id: 3,
        messageId: '<c@example.com>',
        inReplyTo: null,
        references: '<a@example.com> <b@example.com>',
        subject: 'Re: Project Update',
        date: '2026-02-07T10:00:00.000Z',
      },
    ];

    const relationships = analyzer.analyzeRelationships(emails);
    const second = relationships.find(
      (item: { emailId: number }) => item.emailId === 2
    );
    const third = relationships.find(
      (item: { emailId: number }) => item.emailId === 3
    );

    expect(second?.parentId).toBe(1);
    expect(second?.method).toBe('in-reply-to');
    expect(third?.parentId).toBe(2);
    expect(third?.method).toBe('references');
  });

  it('finds thread root from relationships', () => {
    const email = { id: 3 };
    const relationships = [
      { emailId: 1, parentId: null },
      { emailId: 2, parentId: 1 },
      { emailId: 3, parentId: 2 },
    ];

    const root = analyzer.findThreadRoot(email, relationships);

    expect(root).toEqual({ id: 1 });
  });
});
