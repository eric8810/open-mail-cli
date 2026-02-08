import {
  checkKeywords,
  checkSuspiciousLinks,
  checkHeaders,
  checkSenderReputation,
  checkExcessiveCaps,
  checkExcessivePunctuation,
  checkPhishingPatterns,
} from './rules';
import logger from '../utils/logger';

/**
 * Spam Detector
 * Provides various spam detection methods
 */
class SpamDetector {
  constructor() {
    this.detectionMethods = [
      { name: 'keywords', check: checkKeywords, weight: 15 },
      { name: 'suspicious_links', check: checkSuspiciousLinks, weight: 20 },
      { name: 'headers', check: checkHeaders, weight: 25 },
      { name: 'sender_reputation', check: checkSenderReputation, weight: 10 },
      { name: 'excessive_caps', check: checkExcessiveCaps, weight: 10 },
      {
        name: 'excessive_punctuation',
        check: checkExcessivePunctuation,
        weight: 5,
      },
      { name: 'phishing_patterns', check: checkPhishingPatterns, weight: 30 },
    ];
  }

  /**
   * Run all detection methods on an email
   * @param {Object} email - Email object to analyze
   * @returns {Object} - Detection results with score and reasons
   */
  async detect(email) {
    const results = {
      score: 0,
      reasons: [],
      detections: {},
    };

    try {
      for (const method of this.detectionMethods) {
        try {
          let detection;

          // Handle different method signatures
          if (
            method.name === 'keywords' ||
            method.name === 'suspicious_links' ||
            method.name === 'headers'
          ) {
            // These methods expect a pattern parameter
            detection = method.check('', email);
          } else if (method.name === 'sender_reputation') {
            // This method expects sender email
            detection = method.check(email.from);
          } else {
            // Other methods just need the email object
            detection = method.check(email);
          }

          if (detection.matched) {
            results.score += method.weight;
            results.reasons.push(`[${method.name}] ${detection.reason}`);
            results.detections[method.name] = {
              matched: true,
              reason: detection.reason,
              weight: method.weight,
            };

            logger.debug('Spam detection method matched', {
              method: method.name,
              weight: method.weight,
              reason: detection.reason,
            });
          } else {
            results.detections[method.name] = {
              matched: false,
              weight: 0,
            };
          }
        } catch (error) {
          logger.error('Detection method failed', {
            method: method.name,
            error: error.message,
          });
          results.detections[method.name] = {
            matched: false,
            error: error.message,
          };
        }
      }

      logger.debug('Spam detection completed', {
        emailId: email.id,
        score: results.score,
        matchedMethods: Object.keys(results.detections).filter(
          (k) => results.detections[k].matched
        ).length,
      });

      return results;
    } catch (error) {
      logger.error('Spam detection failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Quick spam check (only high-priority methods)
   * @param {Object} email - Email object to analyze
   * @returns {Object} - Quick detection results
   */
  async quickCheck(email) {
    const results = {
      score: 0,
      reasons: [],
      detections: {},
    };

    // Only run high-priority checks
    const quickMethods = this.detectionMethods.filter((m) => m.weight >= 20);

    for (const method of quickMethods) {
      try {
        let detection;

        if (method.name === 'suspicious_links' || method.name === 'headers') {
          detection = method.check('', email);
        } else {
          detection = method.check(email);
        }

        if (detection.matched) {
          results.score += method.weight;
          results.reasons.push(`[${method.name}] ${detection.reason}`);
          results.detections[method.name] = {
            matched: true,
            reason: detection.reason,
            weight: method.weight,
          };
        }
      } catch (error) {
        logger.error('Quick check method failed', {
          method: method.name,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Analyze email content for spam characteristics
   * @param {Object} email - Email object
   * @returns {Object} - Analysis results
   */
  analyzeContent(email) {
    const analysis = {
      subject: {
        length: (email.subject || '').length,
        hasCaps: false,
        hasPunctuation: false,
        hasNumbers: false,
      },
      body: {
        length: (email.bodyText || '').length,
        hasLinks: false,
        linkCount: 0,
        hasImages: false,
      },
      sender: {
        email: email.from,
        domain: this._extractDomain(email.from),
        isSuspicious: false,
      },
    };

    // Analyze subject
    const subject = email.subject || '';
    analysis.subject.hasCaps = /[A-Z]/.test(subject);
    analysis.subject.hasPunctuation = /[!?]/.test(subject);
    analysis.subject.hasNumbers = /\d/.test(subject);

    // Analyze body
    const body = email.bodyText || '';
    const urlRegex = /https?:\/\/[^\s]+/gi;
    const urls = body.match(urlRegex);
    analysis.body.hasLinks = urls !== null;
    analysis.body.linkCount = urls ? urls.length : 0;

    // Check HTML for images
    if (email.bodyHtml) {
      analysis.body.hasImages = /<img/i.test(email.bodyHtml);
    }

    // Analyze sender
    const senderCheck = checkSenderReputation(email.from);
    analysis.sender.isSuspicious = senderCheck.matched;

    return analysis;
  }

  /**
   * Extract domain from email address
   */
  _extractDomain(emailAddress) {
    const match = emailAddress.match(/@(.+)$/);
    return match ? match[1] : null;
  }

  /**
   * Get detection statistics
   */
  getStatistics() {
    return {
      totalMethods: this.detectionMethods.length,
      methods: this.detectionMethods.map((m) => ({
        name: m.name,
        weight: m.weight,
      })),
      totalWeight: this.detectionMethods.reduce((sum, m) => sum + m.weight, 0),
    };
  }

  /**
   * Add custom detection method
   */
  addDetectionMethod(name, checkFunction, weight) {
    this.detectionMethods.push({
      name,
      check: checkFunction,
      weight,
    });
    logger.info('Custom detection method added', { name, weight });
  }

  /**
   * Remove detection method
   */
  removeDetectionMethod(name) {
    const index = this.detectionMethods.findIndex((m) => m.name === name);
    if (index !== -1) {
      this.detectionMethods.splice(index, 1);
      logger.info('Detection method removed', { name });
      return true;
    }
    return false;
  }

  /**
   * Update detection method weight
   */
  updateMethodWeight(name, newWeight) {
    const method = this.detectionMethods.find((m) => m.name === name);
    if (method) {
      const oldWeight = method.weight;
      method.weight = newWeight;
      logger.info('Detection method weight updated', {
        name,
        oldWeight,
        newWeight,
      });
      return true;
    }
    return false;
  }
}

module.exports = new SpamDetector();
