import { checkKeywords, checkSuspiciousLinks, checkHeaders } from './rules';
import emailModel from '../storage/models/email';
import spamModel from '../storage/models/spam';
import logger from '../utils/logger';

/**
 * Spam Filter Engine
 * Detects and filters spam emails
 */
class SpamFilter {
  constructor() {
    this.threshold = 50; // Spam score threshold
    this.rules = [];
  }

  /**
   * Initialize spam filter with rules from database
   */
  async initialize() {
    try {
      this.rules = await spamModel.findAllRules(true);
      logger.info('Spam filter initialized', { rulesCount: this.rules.length });
    } catch (error) {
      logger.error('Failed to initialize spam filter', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Detect if an email is spam
   * @param {Object} email - Email object to check
   * @returns {Object} - { isSpam: boolean, score: number, reasons: string[] }
   */
  async detectSpam(email) {
    const result = {
      isSpam: false,
      score: 0,
      reasons: [],
    };

    try {
      // 1. Whitelist check (highest priority - always pass)
      if (await spamModel.isWhitelisted(email.from)) {
        logger.debug('Email from whitelisted sender', { from: email.from });
        return result;
      }

      // 2. Blacklist check (immediate spam)
      if (await spamModel.isBlacklisted(email.from)) {
        result.isSpam = true;
        result.score = 100;
        result.reasons.push('Sender is blacklisted');
        logger.debug('Email from blacklisted sender', { from: email.from });
        return result;
      }

      // 3. Apply spam detection rules
      for (const rule of this.rules) {
        const ruleResult = this._applyRule(rule, email);
        if (ruleResult.matched) {
          result.score += this._getRuleWeight(rule);
          result.reasons.push(ruleResult.reason);
        }
      }

      // 4. Determine if spam based on threshold
      result.isSpam = result.score >= this.threshold;

      logger.debug('Spam detection completed', {
        emailId: email.id,
        from: email.from,
        score: result.score,
        isSpam: result.isSpam,
      });

      return result;
    } catch (error) {
      logger.error('Spam detection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Apply a single spam rule to an email
   */
  _applyRule(rule, email) {
    try {
      switch (rule.ruleType) {
        case 'keyword':
          return checkKeywords(rule.pattern, email);
        case 'link':
          return checkSuspiciousLinks(rule.pattern, email);
        case 'header':
          return checkHeaders(rule.pattern, email);
        default:
          return { matched: false };
      }
    } catch (error) {
      logger.error('Failed to apply spam rule', {
        ruleId: rule.id,
        error: error.message,
      });
      return { matched: false };
    }
  }

  /**
   * Get weight for a spam rule based on priority
   */
  _getRuleWeight(rule) {
    // Priority maps to weight
    // Higher priority = higher weight
    return rule.priority || 10;
  }

  /**
   * Filter a single email
   * Marks as spam if detected
   */
  async filterEmail(emailId) {
    try {
      const email = await emailModel.findById(emailId);
      if (!email) {
        throw new Error(`Email not found: ${emailId}`);
      }

      const detection = await this.detectSpam(email);

      if (detection.isSpam) {
        await emailModel.markAsSpam(emailId);
        logger.info('Email marked as spam', {
          emailId,
          score: detection.score,
          reasons: detection.reasons,
        });
      }

      return detection;
    } catch (error) {
      logger.error('Failed to filter email', { emailId, error: error.message });
      throw error;
    }
  }

  /**
   * Filter multiple emails
   */
  async filterEmails(emailIds) {
    const results = [];
    for (const emailId of emailIds) {
      try {
        const result = await this.filterEmail(emailId);
        results.push({ emailId, ...result });
      } catch (error) {
        results.push({ emailId, error: error.message });
      }
    }
    return results;
  }

  /**
   * Learn from user feedback
   * Updates rules based on user marking emails as spam/not spam
   */
  async learnFromFeedback(emailId, isSpam) {
    try {
      const email = await emailModel.findById(emailId);
      if (!email) {
        throw new Error(`Email not found: ${emailId}`);
      }

      if (isSpam) {
        // User marked as spam - extract patterns
        await this._learnSpamPatterns(email);
      } else {
        // User marked as not spam - could be false positive
        await this._learnHamPatterns(email);
      }

      logger.info('Learned from user feedback', { emailId, isSpam });
    } catch (error) {
      logger.error('Failed to learn from feedback', {
        emailId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Extract and learn spam patterns from email
   */
  async _learnSpamPatterns(email) {
    // Extract common spam keywords from subject
    const subject = email.subject.toLowerCase();
    const spamKeywords = [
      'free',
      'winner',
      'prize',
      'click here',
      'act now',
      'limited time',
    ];

    for (const keyword of spamKeywords) {
      if (subject.includes(keyword)) {
        // Check if rule already exists
        const existingRules = await spamModel.findAllRules();
        const hasRule = existingRules.some(
          (r) => r.ruleType === 'keyword' && r.pattern.includes(keyword)
        );

        if (!hasRule) {
          await spamModel.createRule({
            ruleType: 'keyword',
            pattern: keyword,
            action: 'mark_spam',
            priority: 5,
          });
          logger.debug('Created new spam keyword rule', { keyword });
        }
      }
    }
  }

  /**
   * Learn from ham (non-spam) patterns
   */
  async _learnHamPatterns(email) {
    // If email was marked as not spam but was detected as spam,
    // we might want to reduce rule weights or add to whitelist
    // For now, just log it
    logger.debug('Learning from ham email', { from: email.from });
  }

  /**
   * Get spam statistics
   */
  async getStatistics() {
    try {
      const spamCount = await emailModel.countSpam();
      const blacklistCount = (await spamModel.getBlacklist()).length;
      const whitelistCount = (await spamModel.getWhitelist()).length;
      const rulesCount = (await spamModel.findAllRules()).length;

      return {
        spamCount,
        blacklistCount,
        whitelistCount,
        rulesCount,
        threshold: this.threshold,
      };
    } catch (error) {
      logger.error('Failed to get spam statistics', { error: error.message });
      throw error;
    }
  }
}

module.exports = new SpamFilter();
