import path from 'path';

import notifier from 'node-notifier';

import config from '../config';
import logger from '../utils/logger';

/**
 * Notification Manager
 * Manages email notifications with filtering and configuration
 */
class NotificationManager {
  constructor() {
    this.enabled = false;
    this.config = {
      enabled: false,
      filters: {
        senders: [], // Filter by sender email
        tags: [], // Filter by tags
        importantOnly: false, // Only notify for important emails
      },
      sound: true,
      desktop: true,
    };
    this.loadConfig();
  }

  /**
   * Load notification configuration
   */
  loadConfig() {
    try {
      const cfg = config.load();
      if (cfg.notifications) {
        this.config = { ...this.config, ...cfg.notifications };
        this.enabled = this.config.enabled;
      }
    } catch (error) {
      logger.error('Failed to load notification config', {
        error: error.message,
      });
    }
  }

  /**
   * Save notification configuration
   */
  saveConfig() {
    try {
      const cfg = config.load();
      cfg.notifications = this.config;
      config.save(cfg);
      logger.info('Notification config saved');
    } catch (error) {
      logger.error('Failed to save notification config', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Enable notifications
   */
  enable() {
    this.enabled = true;
    this.config.enabled = true;
    this.saveConfig();
    logger.info('Notifications enabled');
    return true;
  }

  /**
   * Disable notifications
   */
  disable() {
    this.enabled = false;
    this.config.enabled = false;
    this.saveConfig();
    logger.info('Notifications disabled');
    return true;
  }

  /**
   * Update notification filters
   */
  updateFilters(filters) {
    if (filters.senders !== undefined) {
      this.config.filters.senders = Array.isArray(filters.senders)
        ? filters.senders
        : [filters.senders];
    }

    if (filters.tags !== undefined) {
      this.config.filters.tags = Array.isArray(filters.tags)
        ? filters.tags
        : [filters.tags];
    }

    if (filters.importantOnly !== undefined) {
      this.config.filters.importantOnly = filters.importantOnly;
    }

    this.saveConfig();
    logger.info('Notification filters updated', {
      filters: this.config.filters,
    });
    return this.config.filters;
  }

  /**
   * Update notification settings
   */
  updateSettings(settings) {
    if (settings.sound !== undefined) {
      this.config.sound = settings.sound;
    }

    if (settings.desktop !== undefined) {
      this.config.desktop = settings.desktop;
    }

    this.saveConfig();
    logger.info('Notification settings updated', { settings });
    return this.config;
  }

  /**
   * Check if email should trigger notification
   */
  shouldNotify(email) {
    if (!this.enabled) {
      return false;
    }

    // Check important only filter
    if (this.config.filters.importantOnly && !email.isImportant) {
      return false;
    }

    // Check sender filter
    if (this.config.filters.senders.length > 0) {
      const senderEmail = email.from?.address || email.from;
      const matchesSender = this.config.filters.senders.some((sender) =>
        senderEmail.toLowerCase().includes(sender.toLowerCase())
      );
      if (!matchesSender) {
        return false;
      }
    }

    // Check tag filter
    if (this.config.filters.tags.length > 0 && email.tags) {
      const emailTags = Array.isArray(email.tags) ? email.tags : [email.tags];
      const matchesTag = this.config.filters.tags.some((tag) =>
        emailTags.includes(tag)
      );
      if (!matchesTag) {
        return false;
      }
    }

    return true;
  }

  /**
   * Send desktop notification
   */
  async sendDesktopNotification(email) {
    if (!this.config.desktop) {
      return;
    }

    try {
      const from = email.from?.address || email.from || 'Unknown';
      const subject = email.subject || '(No subject)';
      const preview = this.getEmailPreview(email);

      notifier.notify({
        title: `New Email from ${from}`,
        message: `${subject}\n\n${preview}`,
        sound: this.config.sound,
        wait: false,
        icon: path.join(__dirname, '../../assets/mail-icon.png'),
        timeout: 10,
      });

      logger.info('Desktop notification sent', { from, subject });
    } catch (error) {
      logger.error('Failed to send desktop notification', {
        error: error.message,
      });
    }
  }

  /**
   * Get email preview text
   */
  getEmailPreview(email, maxLength = 100) {
    let text = email.text || email.textAsHtml || '';

    // Remove extra whitespace and newlines
    text = text.replace(/\s+/g, ' ').trim();

    // Truncate if too long
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...';
    }

    return text || '(No preview available)';
  }

  /**
   * Log notification
   */
  logNotification(email) {
    const from = email.from?.address || email.from || 'Unknown';
    const subject = email.subject || '(No subject)';

    logger.info('Email notification', {
      from,
      subject,
      date: email.date,
      isImportant: email.isImportant,
    });
  }

  /**
   * Notify about new email
   */
  async notify(email) {
    if (!this.shouldNotify(email)) {
      return false;
    }

    try {
      // Send desktop notification
      await this.sendDesktopNotification(email);

      // Log notification
      this.logNotification(email);

      return true;
    } catch (error) {
      logger.error('Failed to send notification', { error: error.message });
      return false;
    }
  }

  /**
   * Notify about multiple new emails
   */
  async notifyBatch(emails) {
    if (!this.enabled || !Array.isArray(emails) || emails.length === 0) {
      return 0;
    }

    let notifiedCount = 0;

    for (const email of emails) {
      const notified = await this.notify(email);
      if (notified) {
        notifiedCount++;
      }
    }

    // Send summary notification if multiple emails
    if (notifiedCount > 1 && this.config.desktop) {
      try {
        notifier.notify({
          title: 'New Emails',
          message: `You have ${notifiedCount} new emails`,
          sound: this.config.sound,
          wait: false,
          timeout: 5,
        });
      } catch (error) {
        logger.error('Failed to send batch notification', {
          error: error.message,
        });
      }
    }

    return notifiedCount;
  }

  /**
   * Test notification
   */
  async test() {
    try {
      notifier.notify({
        title: 'Mail Client - Test Notification',
        message: 'Notifications are working correctly!',
        sound: this.config.sound,
        wait: false,
        timeout: 5,
      });

      logger.info('Test notification sent');
      return true;
    } catch (error) {
      logger.error('Failed to send test notification', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      enabled: this.enabled,
      ...this.config,
    };
  }

  /**
   * Get filter statistics
   */
  getFilterStats() {
    return {
      senderCount: this.config.filters.senders.length,
      tagCount: this.config.filters.tags.length,
      importantOnly: this.config.filters.importantOnly,
    };
  }
}

module.exports = new NotificationManager();
