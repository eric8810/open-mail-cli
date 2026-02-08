import { describe, expect, it } from 'vitest';

const IMAPClient = require('../../src/imap/client.ts');

describe('imap client', () => {
  const baseConfig = {
    user: 'demo@example.com',
    password: 'secret',
    host: 'imap.example.com',
    port: 993,
    secure: true,
  };

  it('flattens nested folder boxes', () => {
    const client = new IMAPClient(baseConfig);
    const folders = client._flattenBoxes({
      INBOX: {
        delimiter: '/',
        attribs: ['\\HasNoChildren'],
      },
      Archive: {
        delimiter: '/',
        attribs: ['\\HasChildren'],
        children: {
          '2026': {
            delimiter: '/',
            attribs: ['\\HasNoChildren'],
          },
        },
      },
    });

    expect(folders).toEqual([
      {
        name: 'INBOX',
        delimiter: '/',
        flags: ['\\HasNoChildren'],
      },
      {
        name: 'Archive',
        delimiter: '/',
        flags: ['\\HasChildren'],
      },
      {
        name: 'Archive/2026',
        delimiter: '/',
        flags: ['\\HasNoChildren'],
      },
    ]);
  });

  it('rejects list operation when client is not connected', async () => {
    const client = new IMAPClient(baseConfig);

    await expect(client.listFolders()).rejects.toThrow(
      'Not connected to IMAP server'
    );
  });
});
