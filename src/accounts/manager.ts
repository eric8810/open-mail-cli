import configManager from '../config';
import ImapClient from '../imap/client';
import SmtpClient from '../smtp/client';
import database from '../storage/database';
import accountModel from '../storage/models/account';
import { ConfigError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Account Manager
 * High-level account management operations
 */
class AccountManager {
  /**
   * Add a new account
   */
  async addAccount(accountData) {
    try {
      // Validate required fields
      this._validateAccountData(accountData);

      // Check if account already exists
      const existing = accountModel.findByEmail(accountData.email);
      if (existing) {
        throw new ConfigError(
          `Account with email ${accountData.email} already exists`
        );
      }

      // If this is the first account, make it default
      const accountCount = accountModel.count();
      if (accountCount === 0) {
        accountData.isDefault = true;
      }

      // Create account
      const accountId = accountModel.create(accountData);
      logger.info('Account added successfully', {
        id: accountId,
        email: accountData.email,
      });

      return accountModel.findById(accountId);
    } catch (error) {
      logger.error('Failed to add account', { error: error.message });
      throw error;
    }
  }

  /**
   * Get account by ID
   */
  getAccount(id) {
    return accountModel.findById(id);
  }

  /**
   * Get account with password (for connections)
   */
  getAccountWithPassword(id) {
    return accountModel.getWithPassword(id);
  }

  /**
   * Get all accounts
   */
  getAllAccounts(enabledOnly = false) {
    return accountModel.findAll({ enabledOnly });
  }

  /**
   * Get default account
   */
  getDefaultAccount() {
    return accountModel.getDefault();
  }

  /**
   * Set account as default
   */
  setDefaultAccount(id) {
    const account = accountModel.findById(id);
    if (!account) {
      throw new ConfigError('Account not found');
    }

    accountModel.setDefault(id);
    logger.info('Default account changed', { id, email: account.email });
    return true;
  }

  /**
   * Update account
   */
  updateAccount(id, data) {
    const account = accountModel.findById(id);
    if (!account) {
      throw new ConfigError('Account not found');
    }

    // Validate if email is being changed
    if (data.email && data.email !== account.email) {
      const existing = accountModel.findByEmail(data.email);
      if (existing) {
        throw new ConfigError(
          `Account with email ${data.email} already exists`
        );
      }
    }

    accountModel.update(id, data);
    logger.info('Account updated', { id });
    return accountModel.findById(id);
  }

  /**
   * Delete account
   */
  deleteAccount(id) {
    const account = accountModel.findById(id);
    if (!account) {
      throw new ConfigError('Account not found');
    }

    accountModel.delete(id);
    logger.info('Account deleted', { id, email: account.email });
    return true;
  }

  /**
   * Enable account
   */
  enableAccount(id) {
    return accountModel.update(id, { isEnabled: true });
  }

  /**
   * Disable account
   */
  disableAccount(id) {
    return accountModel.update(id, { isEnabled: false });
  }

  /**
   * Migrate legacy single-account config to multi-account
   */
  migrateLegacyConfig() {
    try {
      // Check if accounts already exist
      const accountCount = accountModel.count();
      if (accountCount > 0) {
        logger.info('Accounts already exist, skipping migration');
        return false;
      }

      // Load legacy config
      const config = configManager.load();
      if (!config.imap || !config.smtp) {
        logger.info('No legacy config found, skipping migration');
        return false;
      }

      // Create account from legacy config
      const accountData = {
        email: config.imap.user || config.smtp.user,
        displayName: config.imap.user || config.smtp.user,
        imapHost: config.imap.host,
        imapPort: config.imap.port,
        imapSecure: config.imap.secure !== false,
        smtpHost: config.smtp.host,
        smtpPort: config.smtp.port,
        smtpSecure: config.smtp.secure !== false,
        username: config.imap.user,
        password: config.imap.password,
        isDefault: true,
        isEnabled: true,
        syncInterval: 300,
      };

      const accountId = accountModel.create(accountData);
      logger.info('Legacy config migrated to account', { id: accountId });

      // Update all existing emails to associate with this account
      const db = database.getDb();
      const updateStmt = db.prepare(
        'UPDATE emails SET account_id = ? WHERE account_id IS NULL'
      );
      const result = updateStmt.run(accountId);
      logger.info('Associated existing emails with migrated account', {
        count: result.changes,
      });

      // Update all existing folders to associate with this account
      const updateFoldersStmt = db.prepare(
        'UPDATE folders SET account_id = ? WHERE account_id IS NULL'
      );
      const foldersResult = updateFoldersStmt.run(accountId);
      logger.info('Associated existing folders with migrated account', {
        count: foldersResult.changes,
      });

      return true;
    } catch (error) {
      logger.error('Failed to migrate legacy config', { error: error.message });
      throw new ConfigError(
        `Failed to migrate legacy config: ${error.message}`
      );
    }
  }

  /**
   * Test account connection
   */
  async testAccount(id) {
    const account = accountModel.getWithPassword(id);
    if (!account) {
      throw new ConfigError('Account not found');
    }

    const errors = [];

    // Test IMAP connection
    try {
      const imapClient = new ImapClient({
        host: account.imapHost,
        port: account.imapPort,
        secure: account.imapSecure,
        user: account.username,
        password: account.password,
      });
      await imapClient.connect();
      await imapClient.disconnect();
      logger.info('IMAP connection test successful', { accountId: id });
    } catch (error) {
      errors.push({ type: 'IMAP', message: error.message });
      logger.error('IMAP connection test failed', {
        accountId: id,
        error: error.message,
      });
    }

    // Test SMTP connection
    try {
      const smtpClient = new SmtpClient({
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        user: account.username,
        password: account.password,
      });
      await smtpClient.connect();
      await smtpClient.disconnect();
      logger.info('SMTP connection test successful', { accountId: id });
    } catch (error) {
      errors.push({ type: 'SMTP', message: error.message });
      logger.error('SMTP connection test failed', {
        accountId: id,
        error: error.message,
      });
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate account data
   */
  _validateAccountData(data) {
    const required = ['email', 'imapHost', 'smtpHost', 'username', 'password'];
    const missing = required.filter((field) => !data[field]);

    if (missing.length > 0) {
      throw new ConfigError(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new ConfigError('Invalid email format');
    }

    return true;
  }
}

module.exports = new AccountManager();
