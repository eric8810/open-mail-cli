import EventEmitter from 'events';

import config from '../config';
import accountManager from './account-manager';
import IMAPSync from '../imap/sync';
import { SyncError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Sync Scheduler
 * Manages automatic email synchronization at configured intervals
 */
class SyncScheduler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = options.config || config.load();
    this.interval = options.interval || this.config.sync.syncInterval || 300000; // Default: 5 minutes
    this.folders = options.folders || this.config.sync.folders || ['INBOX'];
    this.account = options.account || null; // For multi-account support
    this.isRunning = false;
    this.timer = null;
    this.syncManager = null;
    this.lastSyncTime = null;
    this.lastSyncResult = null;
    this.stats = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      totalNewEmails: 0,
      totalErrors: 0,
    };
  }

  /**
   * Start automatic synchronization
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Scheduler already running');
      return;
    }

    logger.info('Starting sync scheduler', {
      interval: this.interval,
      folders: this.folders,
      account: this.account,
    });

    this.isRunning = true;
    this.emit('started', { interval: this.interval, folders: this.folders });

    // Run initial sync
    await this._runSync();

    // Schedule periodic syncs
    this._scheduleNextSync();
  }

  /**
   * Stop automatic synchronization
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Scheduler not running');
      return;
    }

    logger.info('Stopping sync scheduler');

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      interval: this.interval,
      folders: this.folders,
      account: this.account,
      lastSyncTime: this.lastSyncTime,
      lastSyncResult: this.lastSyncResult,
      stats: this.stats,
      nextSyncIn: this.timer ? this.interval : null,
    };
  }

  /**
   * Update sync interval
   */
  setInterval(newInterval) {
    if (newInterval < 60000) {
      // Minimum 1 minute
      throw new Error('Sync interval must be at least 60000ms (1 minute)');
    }

    logger.info('Updating sync interval', {
      old: this.interval,
      new: newInterval,
    });
    this.interval = newInterval;

    // Reschedule if running
    if (this.isRunning) {
      if (this.timer) {
        clearTimeout(this.timer);
      }
      this._scheduleNextSync();
    }
  }

  /**
   * Update folders to sync
   */
  setFolders(folders) {
    if (!Array.isArray(folders) || folders.length === 0) {
      throw new Error('Folders must be a non-empty array');
    }

    logger.info('Updating sync folders', { old: this.folders, new: folders });
    this.folders = folders;
  }

  /**
   * Run sync immediately (manual trigger)
   */
  async syncNow() {
    if (!this.isRunning) {
      throw new Error('Scheduler not running. Start it first with start()');
    }

    logger.info('Manual sync triggered');
    await this._runSync();
  }

  /**
   * Schedule next sync
   * @private
   */
  _scheduleNextSync() {
    this.timer = setTimeout(async () => {
      await this._runSync();
      if (this.isRunning) {
        this._scheduleNextSync();
      }
    }, this.interval);
  }

  /**
   * Run synchronization
   * @private
   */
  async _runSync() {
    const syncStartTime = Date.now();
    this.stats.totalSyncs++;

    try {
      logger.info('Running scheduled sync', {
        folders: this.folders,
        account: this.account,
      });

      this.emit('sync-start', { folders: this.folders, account: this.account });

      // Create sync manager if not exists
      if (!this.syncManager) {
        const imapConfig = this.account
          ? this._getAccountConfig(this.account)
          : this.config.imap;
        this.syncManager = new IMAPSync(imapConfig);
      }

      // Run sync
      const results = await this.syncManager.syncFolders(this.folders);

      // Update stats
      this.stats.successfulSyncs++;
      this.stats.totalNewEmails += results.totalNew || 0;
      this.stats.totalErrors += results.totalErrors || 0;

      // Store results
      this.lastSyncTime = new Date().toISOString();
      this.lastSyncResult = {
        success: true,
        ...results,
        duration: Date.now() - syncStartTime,
      };

      logger.info('Scheduled sync completed', {
        duration: Date.now() - syncStartTime,
        newEmails: results.totalNew,
        errors: results.totalErrors,
      });

      this.emit('sync-complete', this.lastSyncResult);
    } catch (error) {
      this.stats.failedSyncs++;

      this.lastSyncTime = new Date().toISOString();
      this.lastSyncResult = {
        success: false,
        error: error.message,
        duration: Date.now() - syncStartTime,
      };

      logger.error('Scheduled sync failed', {
        error: error.message,
        duration: Date.now() - syncStartTime,
      });

      this.emit('sync-error', { error: error.message });
    }
  }

  /**
   * Get account-specific IMAP config
   * @private
   */
  _getAccountConfig(accountId) {
    // Try to get account from database if accounts table exists
    if (accountManager.accountsTableExists()) {
      const imapConfig = accountManager.getImapConfig(accountId);
      if (imapConfig) {
        logger.info('Using account-specific IMAP config', { accountId });
        return imapConfig;
      }
    }

    // Fallback to default config
    logger.warn(
      'Account not found or accounts table not available, using default config',
      { accountId }
    );
    return this.config.imap;
  }
}

module.exports = SyncScheduler;
