import logger from '../utils/logger';

/**
 * Email Thread Analyzer
 * Analyzes email relationships to build conversation threads
 */
class ThreadAnalyzer {
  /**
   * Normalize subject by removing Re:, Fwd:, etc. prefixes
   */
  normalizeSubject(subject) {
    if (!subject) return '';

    // Remove common prefixes (case-insensitive)
    return subject
      .replace(/^(re|fw|fwd|回复|转发):\s*/gi, '')
      .trim()
      .toLowerCase();
  }

  /**
   * Extract email addresses from References header
   */
  parseReferences(references) {
    if (!references) return [];

    // References can be space or comma separated
    return references
      .split(/[\s,]+/)
      .map((ref) => ref.trim())
      .filter((ref) => ref.length > 0);
  }

  /**
   * Calculate subject similarity score (0-1)
   */
  calculateSubjectSimilarity(subject1, subject2) {
    const norm1 = this.normalizeSubject(subject1);
    const norm2 = this.normalizeSubject(subject2);

    if (!norm1 || !norm2) return 0;
    if (norm1 === norm2) return 1;

    // Simple Levenshtein-based similarity
    const maxLen = Math.max(norm1.length, norm2.length);
    const distance = this._levenshteinDistance(norm1, norm2);
    return 1 - distance / maxLen;
  }

  /**
   * Levenshtein distance algorithm
   */
  _levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Analyze email relationships and determine thread connections
   * Returns array of { emailId, parentId, confidence }
   */
  analyzeRelationships(emails) {
    const relationships = [];
    const messageIdMap = new Map();

    // Build message ID index
    emails.forEach((email) => {
      if (email.messageId) {
        messageIdMap.set(email.messageId, email);
      }
    });

    // Analyze each email
    emails.forEach((email) => {
      let parentId = null;
      let confidence = 0;
      let method = null;

      // Method 1: In-Reply-To header (highest confidence)
      if (email.inReplyTo) {
        const parent = messageIdMap.get(email.inReplyTo);
        if (parent) {
          parentId = parent.id;
          confidence = 1.0;
          method = 'in-reply-to';
        }
      }

      // Method 2: References header (high confidence)
      if (!parentId && email.references) {
        const refs = this.parseReferences(email.references);
        // Try to find the most recent reference
        for (let i = refs.length - 1; i >= 0; i--) {
          const parent = messageIdMap.get(refs[i]);
          if (parent) {
            parentId = parent.id;
            confidence = 0.9;
            method = 'references';
            break;
          }
        }
      }

      // Method 3: Subject similarity (medium confidence)
      if (!parentId && email.subject) {
        const normalizedSubject = this.normalizeSubject(email.subject);
        let bestMatch = null;
        let bestScore = 0;

        emails.forEach((otherEmail) => {
          if (otherEmail.id === email.id) return;
          if (!otherEmail.subject) return;
          if (new Date(otherEmail.date) >= new Date(email.date)) return;

          const similarity = this.calculateSubjectSimilarity(
            email.subject,
            otherEmail.subject
          );

          if (similarity > bestScore && similarity >= 0.8) {
            bestScore = similarity;
            bestMatch = otherEmail;
          }
        });

        if (bestMatch) {
          parentId = bestMatch.id;
          confidence = bestScore * 0.7; // Reduce confidence for subject-based matching
          method = 'subject-similarity';
        }
      }

      relationships.push({
        emailId: email.id,
        parentId,
        confidence,
        method,
      });

      logger.debug('Analyzed email relationship', {
        emailId: email.id,
        subject: email.subject,
        parentId,
        confidence,
        method,
      });
    });

    return relationships;
  }

  /**
   * Find thread root for an email
   */
  findThreadRoot(email, relationships) {
    const relationshipMap = new Map();
    relationships.forEach((rel) => {
      relationshipMap.set(rel.emailId, rel);
    });

    let current = email;
    const visited = new Set();

    while (current) {
      if (visited.has(current.id)) {
        logger.warn('Circular reference detected in thread', {
          emailId: current.id,
        });
        break;
      }
      visited.add(current.id);

      const rel = relationshipMap.get(current.id);
      if (!rel || !rel.parentId) {
        return current;
      }

      // Find parent email
      const parent = relationships.find((r) => r.emailId === rel.parentId);
      if (!parent) {
        return current;
      }

      current = { id: rel.parentId };
    }

    return current;
  }
}

module.exports = new ThreadAnalyzer();
