import { describe, expect, it } from 'vitest';

import {
  formatEmailAddress,
  parseEmailAddress,
  parseEmailList,
} from '../../src/utils/email-parser.ts';

describe('email-parser', () => {
  it('parses bare email address', () => {
    expect(parseEmailAddress('user@example.com')).toEqual({
      name: null,
      address: 'user@example.com',
    });
  });

  it('parses named email address', () => {
    expect(parseEmailAddress('"Alice" <alice@example.com>')).toEqual({
      name: 'Alice',
      address: 'alice@example.com',
    });
  });

  it('returns null for invalid input', () => {
    expect(parseEmailAddress('not-an-email')).toBeNull();
    expect(parseEmailAddress(undefined)).toBeNull();
  });

  it('formats email address', () => {
    expect(formatEmailAddress('alice@example.com', 'Alice')).toBe(
      'Alice <alice@example.com>'
    );
    expect(formatEmailAddress('alice@example.com')).toBe('alice@example.com');
    expect(formatEmailAddress('')).toBe('');
  });

  it('parses email list with mixed separators', () => {
    expect(
      parseEmailList('alice@example.com; Bob <bob@example.com>,invalid')
    ).toEqual([
      { name: null, address: 'alice@example.com' },
      { name: 'Bob', address: 'bob@example.com' },
    ]);
  });
});
