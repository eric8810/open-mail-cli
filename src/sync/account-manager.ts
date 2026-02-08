import database from '../storage/database';
import logger from '../utils/logger';

/**
 * Account Manager for Sync
 * Handles account-specific sync configuration
 */
class AccountManager {
  constructor() {
    this.db = null;
  }

  _getDb() {
    if (!this.db) {
      this.db = database.getDb();
    }
    return this.db;
  }

  /**
   * Get account by ID or email
   */
  getAccount(identifier) {
    try {
      const db = this._getDb();
      let query;
      if (typeof identifier === 'number') {
        query = db.prepare(
          'SELECT * FROM accounts WHERE id = ? AND is_enabled = 1'
        );
      } else {
        query = db.prepare(
          'SELECT * FROM accounts WHERE email = ? AND is_enabled = 1'
        );
      }

      const account = query.get(identifier);
      return account || null;
    } catch (error) {
      logger.error('Failed to get account', {
        identifier,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get all enabled accounts
   */
  getAllAccounts() {
    try {
      const db = this._getDb();
      const query = db.prepare(
        'SELECT * FROM accounts WHERE is_enabled = 1 ORDER BY is_default DESC, email ASC'
      );
      return query.all();
    } catch (error) {
      logger.error('Failed to get all accounts', { error: error.message });
      return [];
    }
  }

  /**
   * Get default account
   */
  getDefaultAccount() {
    try {
      const db = this._getDb();
      const query = db.prepare(
        'SELECT * FROM accounts WHERE is_default = 1 AND is_enabled = 1 LIMIT 1'
      );
      return query.get() || null;
    } catch (error) {
      logger.error('Failed to get default account', { error: error.message });
      return null;
    }
  }

  /**
   * Get IMAP config for account
   */
  getImapConfig(accountId) {
    const account = this.getAccount(accountId);
    if (!account) {
      return null;
    }

    return {
      host: account.imap_host,
      port: account.imap_port,
      secure: account.imap_secure === 1,
      user: account.username,
      password: account.password,
      accountId: account.id,
      accountEmail: account.email,
    };
  }

  /**
   * Get sync interval for account
   */
  getSyncInterval(accountId) {
    const account = this.getAccount(accountId);
    if (!account || !account.sync_interval) {
      return 300000; // Default 5 minutes
    }
    return account.sync_interval * 1000; // Convert seconds to milliseconds
  }

  /**
   * Update last sync time for account
   */
  updateLastSync(accountId) {
    try {
      const db = this._getDb();
      const query = db.prepare(
        'UPDATE accounts SET last_sync = CURRENT_TIMESTAMP WHERE id = ?'
      );
      query.run(accountId);
      logger.debug('Updated last sync time', { accountId });
    } catch (error) {
      logger.error('Failed to update last sync time', {
        accountId,
        error: error.message,
      });
    }
  }

  /**
   * Check if accounts table exists
   */
  accountsTableExists() {
    try {
      const db = this._getDb();
      const query = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'"
      );
      const result = query.get();
      return !!result;
    } catch (error) {
      logger.error('Failed to check accounts table', { error: error.message });
      return false;
    }
  }

  /**
   * Get account-specific folders
   */
  getAccountFolders(accountId) {
    try {
      const db = this._getDb();
      const query = db.prepare(
        'SELECT name FROM folders WHERE account_id = ? OR account_id IS NULL ORDER BY name'
      );
      const folders = query.all(accountId);
      return folders.map((f) => f.name);
    } catch (error) {
      logger.error('Failed to get account folders', {
        accountId,
        error: error.message,
      });
      return ['INBOX']; // Default fallback
    }
  }
}

module.exports = new AccountManager();
