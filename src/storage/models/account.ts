import type { SQLiteDatabase } from '../../types/database';

import { StorageError } from '../../utils/errors';
import { decrypt, encrypt } from '../../utils/helpers';
import logger from '../../utils/logger';
import database from '../database';

interface AccountInput {
  email: string;
  displayName?: string;
  imapHost: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  username?: string;
  password: string;
  isDefault?: boolean;
  isEnabled?: boolean;
  syncInterval?: number;
}

type AccountUpdateInput = Partial<AccountInput>;

interface AccountFindOptions {
  enabledOnly?: boolean;
}

interface AccountRow {
  id: number;
  email: string;
  display_name: string;
  imap_host: string;
  imap_port: number;
  imap_secure: number;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: number;
  username: string;
  password: string;
  is_default: number;
  is_enabled: number;
  sync_interval: number;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

interface CountRow {
  count: number;
}

interface DefaultFlagRow {
  is_default: number;
}

export interface AccountRecord {
  id: number;
  email: string;
  displayName: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  username: string;
  isDefault: boolean;
  isEnabled: boolean;
  syncInterval: number;
  lastSync: string | null;
  createdAt: string;
  updatedAt: string;
  password?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * Account model.
 */
export class AccountModel {
  private db: SQLiteDatabase | null;

  constructor() {
    this.db = null;
  }

  private getDb(): SQLiteDatabase {
    if (!this.db) {
      this.db = database.getDb();
    }
    return this.db;
  }

  create(accountData: AccountInput): number {
    try {
      const db = this.getDb();
      const encryptedPassword = encrypt(accountData.password);

      const stmt = db.prepare(`
        INSERT INTO accounts (
          email, display_name, imap_host, imap_port, imap_secure,
          smtp_host, smtp_port, smtp_secure, username, password,
          is_default, is_enabled, sync_interval
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        accountData.email,
        accountData.displayName ?? accountData.email,
        accountData.imapHost,
        accountData.imapPort ?? 993,
        accountData.imapSecure !== false ? 1 : 0,
        accountData.smtpHost,
        accountData.smtpPort ?? 465,
        accountData.smtpSecure !== false ? 1 : 0,
        accountData.username ?? accountData.email,
        encryptedPassword,
        accountData.isDefault ? 1 : 0,
        accountData.isEnabled !== false ? 1 : 0,
        accountData.syncInterval ?? 300
      );

      const insertId = toNumber(result.lastInsertRowid);
      logger.info('Account created', {
        id: insertId,
        email: accountData.email,
      });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to create account', { error: errorMessage });
      throw new StorageError(`Failed to create account: ${errorMessage}`);
    }
  }

  findById(id: number): AccountRecord | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], AccountRow>(
        'SELECT * FROM accounts WHERE id = ?'
      );
      const account = stmt.get(id);
      return account ? this.formatAccount(account) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find account by ID', { id, error: errorMessage });
      throw new StorageError(`Failed to find account: ${errorMessage}`);
    }
  }

  findByEmail(email: string): AccountRecord | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[string], AccountRow>(
        'SELECT * FROM accounts WHERE email = ?'
      );
      const account = stmt.get(email);
      return account ? this.formatAccount(account) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find account by email', {
        email,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find account: ${errorMessage}`);
    }
  }

  findAll(options: AccountFindOptions = {}): AccountRecord[] {
    try {
      const db = this.getDb();
      const { enabledOnly = false } = options;

      let query = 'SELECT * FROM accounts';
      if (enabledOnly) {
        query += ' WHERE is_enabled = 1';
      }
      query += ' ORDER BY is_default DESC, email ASC';

      const stmt = db.prepare<[], AccountRow>(query);
      const accounts = stmt.all();
      return accounts.map((account) => this.formatAccount(account));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find accounts', { error: errorMessage });
      throw new StorageError(`Failed to find accounts: ${errorMessage}`);
    }
  }

  getDefault(): AccountRecord | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[], AccountRow>(
        'SELECT * FROM accounts WHERE is_default = 1 AND is_enabled = 1 LIMIT 1'
      );
      const account = stmt.get();
      return account ? this.formatAccount(account) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to get default account', { error: errorMessage });
      throw new StorageError(`Failed to get default account: ${errorMessage}`);
    }
  }

  setDefault(id: number): boolean {
    try {
      const db = this.getDb();

      const transaction = db.transaction((): void => {
        db.prepare('UPDATE accounts SET is_default = 0').run();

        const stmt = db.prepare(
          'UPDATE accounts SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        );
        const result = stmt.run(id);

        if (result.changes === 0) {
          throw new StorageError('Account not found');
        }
      });

      transaction();
      logger.info('Default account set', { id });
      return true;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to set default account', {
        id,
        error: errorMessage,
      });
      throw new StorageError(`Failed to set default account: ${errorMessage}`);
    }
  }

  update(id: number, data: AccountUpdateInput): boolean {
    try {
      const db = this.getDb();
      const fields: string[] = [];
      const params: Array<string | number> = [];

      if (data.email !== undefined) {
        fields.push('email = ?');
        params.push(data.email);
      }

      if (data.displayName !== undefined) {
        fields.push('display_name = ?');
        params.push(data.displayName);
      }

      if (data.imapHost !== undefined) {
        fields.push('imap_host = ?');
        params.push(data.imapHost);
      }

      if (data.imapPort !== undefined) {
        fields.push('imap_port = ?');
        params.push(data.imapPort);
      }

      if (data.imapSecure !== undefined) {
        fields.push('imap_secure = ?');
        params.push(data.imapSecure ? 1 : 0);
      }

      if (data.smtpHost !== undefined) {
        fields.push('smtp_host = ?');
        params.push(data.smtpHost);
      }

      if (data.smtpPort !== undefined) {
        fields.push('smtp_port = ?');
        params.push(data.smtpPort);
      }

      if (data.smtpSecure !== undefined) {
        fields.push('smtp_secure = ?');
        params.push(data.smtpSecure ? 1 : 0);
      }

      if (data.username !== undefined) {
        fields.push('username = ?');
        params.push(data.username);
      }

      if (data.password !== undefined) {
        fields.push('password = ?');
        params.push(encrypt(data.password));
      }

      if (data.isEnabled !== undefined) {
        fields.push('is_enabled = ?');
        params.push(data.isEnabled ? 1 : 0);
      }

      if (data.syncInterval !== undefined) {
        fields.push('sync_interval = ?');
        params.push(data.syncInterval);
      }

      if (fields.length === 0) {
        return false;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      logger.info('Account updated', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to update account', { id, error: errorMessage });
      throw new StorageError(`Failed to update account: ${errorMessage}`);
    }
  }

  updateLastSync(id: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare(
        'UPDATE accounts SET last_sync = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      );
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to update last sync', { id, error: errorMessage });
      throw new StorageError(`Failed to update last sync: ${errorMessage}`);
    }
  }

  delete(id: number): boolean {
    try {
      const db = this.getDb();

      const countStmt = db.prepare<[], CountRow>(
        'SELECT COUNT(*) as count FROM accounts'
      );
      const countResult = countStmt.get();
      const totalCount = countResult?.count ?? 0;

      if (totalCount === 1) {
        throw new StorageError('Cannot delete the only account');
      }

      const accountStmt = db.prepare<[number], DefaultFlagRow>(
        'SELECT is_default FROM accounts WHERE id = ?'
      );
      const account = accountStmt.get(id);

      if (!account) {
        throw new StorageError('Account not found');
      }

      const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
      const result = stmt.run(id);

      if (account.is_default === 1) {
        const newDefaultStmt = db.prepare(
          'UPDATE accounts SET is_default = 1 WHERE id = (SELECT id FROM accounts LIMIT 1)'
        );
        newDefaultStmt.run();
      }

      logger.info('Account deleted', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete account', { id, error: errorMessage });
      throw new StorageError(`Failed to delete account: ${errorMessage}`);
    }
  }

  count(): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[], CountRow>(
        'SELECT COUNT(*) as count FROM accounts'
      );
      const result = stmt.get();
      return result?.count ?? 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to count accounts', { error: errorMessage });
      throw new StorageError(`Failed to count accounts: ${errorMessage}`);
    }
  }

  getWithPassword(id: number): AccountRecord | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], AccountRow>(
        'SELECT * FROM accounts WHERE id = ?'
      );
      const account = stmt.get(id);
      return account ? this.formatAccount(account, true) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to get account with password', {
        id,
        error: errorMessage,
      });
      throw new StorageError(`Failed to get account: ${errorMessage}`);
    }
  }

  private formatAccount(
    account: AccountRow,
    includePassword = false
  ): AccountRecord {
    const formatted: AccountRecord = {
      id: account.id,
      email: account.email,
      displayName: account.display_name,
      imapHost: account.imap_host,
      imapPort: account.imap_port,
      imapSecure: account.imap_secure === 1,
      smtpHost: account.smtp_host,
      smtpPort: account.smtp_port,
      smtpSecure: account.smtp_secure === 1,
      username: account.username,
      isDefault: account.is_default === 1,
      isEnabled: account.is_enabled === 1,
      syncInterval: account.sync_interval,
      lastSync: account.last_sync,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
    };

    if (includePassword) {
      formatted.password = decrypt(account.password);
    }

    return formatted;
  }
}

const accountModel = new AccountModel();
export default accountModel;
