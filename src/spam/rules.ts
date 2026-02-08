/**
 * Spam Detection Rules
 * Contains various spam detection algorithms
 */

/**
 * Check for spam keywords in email
 * @param {string} pattern - Regex pattern or keyword list (pipe-separated)
 * @param {Object} email - Email object
 * @returns {Object} - { matched: boolean, reason: string }
 */
function checkKeywords(pattern, email) {
  try {
    const regex = new RegExp(pattern, 'i');
    const subject = email.subject || '';
    const body = email.bodyText || '';

    // Check subject
    if (regex.test(subject)) {
      return {
        matched: true,
        reason: `Spam keyword found in subject: "${subject.match(regex)[0]}"`,
      };
    }

    // Check body
    if (regex.test(body)) {
      const match = body.match(regex);
      return {
        matched: true,
        reason: `Spam keyword found in body: "${match ? match[0] : 'keyword'}"`,
      };
    }

    return { matched: false };
  } catch (error) {
    return { matched: false };
  }
}

/**
 * Check for suspicious links in email
 * @param {string} pattern - Pattern to match suspicious links
 * @param {Object} email - Email object
 * @returns {Object} - { matched: boolean, reason: string }
 */
function checkSuspiciousLinks(pattern, email) {
  try {
    const body = email.bodyText || '';
    const html = email.bodyHtml || '';

    // Common suspicious link patterns
    const suspiciousPatterns = [
      /bit\.ly|tinyurl|goo\.gl/i, // URL shorteners
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP addresses
      /https?:\/\/[^\s]+\.(tk|ml|ga|cf|gq)/i, // Suspicious TLDs
    ];

    // Check for URL shorteners and suspicious domains
    for (const suspPattern of suspiciousPatterns) {
      if (suspPattern.test(body) || suspPattern.test(html)) {
        return {
          matched: true,
          reason:
            'Suspicious link detected (URL shortener or suspicious domain)',
        };
      }
    }

    // Check custom pattern if provided
    if (pattern) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(body) || regex.test(html)) {
        return {
          matched: true,
          reason: 'Suspicious link pattern matched',
        };
      }
    }

    return { matched: false };
  } catch (error) {
    return { matched: false };
  }
}

/**
 * Check email headers for spam indicators
 * @param {string} pattern - Header pattern to check
 * @param {Object} email - Email object
 * @returns {Object} - { matched: boolean, reason: string }
 */
function checkHeaders(pattern, email) {
  try {
    // Check for common spam header indicators
    const spamIndicators = [
      { key: 'X-Spam-Flag', value: 'YES' },
      { key: 'X-Spam-Status', value: 'Yes' },
    ];

    // For now, we'll check if the pattern matches known spam headers
    // In a real implementation, we'd parse actual email headers
    if (
      pattern.includes('X-Spam-Flag: YES') ||
      pattern.includes('X-Spam-Status: Yes')
    ) {
      // This would need actual header data from the email
      // For now, return false as we don't have header data in the model
      return { matched: false };
    }

    return { matched: false };
  } catch (error) {
    return { matched: false };
  }
}

/**
 * Check sender reputation
 * @param {string} senderEmail - Sender email address
 * @returns {Object} - { matched: boolean, reason: string, score: number }
 */
function checkSenderReputation(senderEmail) {
  try {
    // Check for suspicious sender patterns
    const suspiciousPatterns = [
      /noreply@/i,
      /no-reply@/i,
      /donotreply@/i,
      /\d{5,}@/, // Many numbers in email
      /[a-z]{20,}@/i, // Very long random string
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(senderEmail)) {
        return {
          matched: true,
          reason: 'Suspicious sender email pattern',
          score: 10,
        };
      }
    }

    return { matched: false, score: 0 };
  } catch (error) {
    return { matched: false, score: 0 };
  }
}

/**
 * Check for excessive capitalization (SHOUTING)
 * @param {Object} email - Email object
 * @returns {Object} - { matched: boolean, reason: string }
 */
function checkExcessiveCaps(email) {
  try {
    const subject = email.subject || '';

    if (subject.length < 10) {
      return { matched: false };
    }

    // Count uppercase letters
    const upperCount = (subject.match(/[A-Z]/g) || []).length;
    const totalLetters = (subject.match(/[A-Za-z]/g) || []).length;

    if (totalLetters === 0) {
      return { matched: false };
    }

    const capsRatio = upperCount / totalLetters;

    // If more than 70% uppercase, likely spam
    if (capsRatio > 0.7) {
      return {
        matched: true,
        reason: 'Excessive capitalization in subject',
      };
    }

    return { matched: false };
  } catch (error) {
    return { matched: false };
  }
}

/**
 * Check for excessive punctuation (!!!, ???)
 * @param {Object} email - Email object
 * @returns {Object} - { matched: boolean, reason: string }
 */
function checkExcessivePunctuation(email) {
  try {
    const subject = email.subject || '';

    // Check for repeated punctuation
    const patterns = [
      /!{3,}/, // Multiple exclamation marks
      /\?{3,}/, // Multiple question marks
      /\.{4,}/, // Multiple periods (more than ellipsis)
    ];

    for (const pattern of patterns) {
      if (pattern.test(subject)) {
        return {
          matched: true,
          reason: 'Excessive punctuation in subject',
        };
      }
    }

    return { matched: false };
  } catch (error) {
    return { matched: false };
  }
}

/**
 * Check for common phishing patterns
 * @param {Object} email - Email object
 * @returns {Object} - { matched: boolean, reason: string }
 */
function checkPhishingPatterns(email) {
  try {
    const subject = (email.subject || '').toLowerCase();
    const body = (email.bodyText || '').toLowerCase();

    const phishingKeywords = [
      'verify your account',
      'confirm your identity',
      'suspended account',
      'unusual activity',
      'click here to verify',
      'update your information',
      'security alert',
      'your account will be closed',
    ];

    for (const keyword of phishingKeywords) {
      if (subject.includes(keyword) || body.includes(keyword)) {
        return {
          matched: true,
          reason: `Potential phishing: "${keyword}"`,
        };
      }
    }

    return { matched: false };
  } catch (error) {
    return { matched: false };
  }
}

export {
  checkKeywords,
  checkSuspiciousLinks,
  checkHeaders,
  checkSenderReputation,
  checkExcessiveCaps,
  checkExcessivePunctuation,
  checkPhishingPatterns,
};
