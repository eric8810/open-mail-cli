import { describe, expect, it } from 'vitest';

const EmailComposer = require('../../src/smtp/composer.ts');

describe('smtp composer', () => {
  it('composes mail payload with signature', () => {
    const composer = new EmailComposer();
    const payload = composer
      .setFrom('demo@example.com')
      .setTo(['alice@example.com'])
      .setSubject('Status')
      .setBody('Plain text body', '<p>Plain text body</p>')
      .addSignature({ text: 'Best regards', html: '<p>Best regards</p>' })
      .compose();

    expect(payload.from).toBe('demo@example.com');
    expect(payload.to).toEqual(['alice@example.com']);
    expect(payload.subject).toBe('Status');
    expect(payload.text).toContain('Best regards');
    expect(payload.html).toContain('<p>Best regards</p>');
  });

  it('builds reply-all recipient list without duplicates or self', () => {
    const composer = new EmailComposer();
    const recipients = composer.getAllRecipients(
      {
        from: 'alice@example.com',
        to: 'bob@example.com, me@example.com',
        cc: 'carol@example.com, bob@example.com',
      },
      'me@example.com'
    );

    expect(recipients).toEqual([
      'alice@example.com',
      'bob@example.com',
      'carol@example.com',
    ]);
  });

  it('validates required compose fields', () => {
    const composer = new EmailComposer();

    expect(() => composer.compose()).toThrow('Recipient (to) is required');

    expect(() => {
      composer.setTo('alice@example.com').compose();
    }).toThrow('Subject is required');

    expect(() => {
      composer.setSubject('No body').compose();
    }).toThrow('Email body (text or html) is required');
  });
});
