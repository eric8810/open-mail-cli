import { describe, expect, it } from 'vitest';

import {
  AuthenticationError,
  ConfigError,
  ConnectionError,
  MailClientError,
  StorageError,
  SyncError,
} from '../../src/utils/errors.ts';

describe('errors', () => {
  it('creates base error with code', () => {
    const error = new MailClientError('Base error', 'BASE_ERROR');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MailClientError);
    expect(error.name).toBe('MailClientError');
    expect(error.message).toBe('Base error');
    expect(error.code).toBe('BASE_ERROR');
  });

  it('creates typed subclass errors with default codes', () => {
    const configError = new ConfigError('Config issue');
    const connectionError = new ConnectionError('Connection issue');
    const authError = new AuthenticationError('Auth issue');
    const syncError = new SyncError('Sync issue');
    const storageError = new StorageError('Storage issue');

    expect(configError).toBeInstanceOf(MailClientError);
    expect(configError.code).toBe('CONFIG_ERROR');

    expect(connectionError).toBeInstanceOf(MailClientError);
    expect(connectionError.code).toBe('CONNECTION_ERROR');

    expect(authError).toBeInstanceOf(MailClientError);
    expect(authError.code).toBe('AUTH_ERROR');

    expect(syncError).toBeInstanceOf(MailClientError);
    expect(syncError.code).toBe('SYNC_ERROR');

    expect(storageError).toBeInstanceOf(MailClientError);
    expect(storageError.code).toBe('STORAGE_ERROR');
  });
});
