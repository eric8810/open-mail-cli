import logger from '../utils/logger';

/**
 * Filter Condition Matcher
 * Evaluates filter conditions against email data
 */
class ConditionMatcher {
  /**
   * Check if email matches a single condition
   */
  matchCondition(email, condition) {
    const { field, operator, value } = condition;
    const emailValue = this._getEmailField(email, field);

    if (emailValue === null || emailValue === undefined) {
      return false;
    }

    switch (operator) {
      case 'equals':
        return this._matchEquals(emailValue, value);

      case 'not_equals':
        return !this._matchEquals(emailValue, value);

      case 'contains':
        return this._matchContains(emailValue, value);

      case 'not_contains':
        return !this._matchContains(emailValue, value);

      case 'starts_with':
        return this._matchStartsWith(emailValue, value);

      case 'ends_with':
        return this._matchEndsWith(emailValue, value);

      case 'matches_regex':
        return this._matchRegex(emailValue, value);

      case 'greater_than':
        return this._matchGreaterThan(emailValue, value);

      case 'less_than':
        return this._matchLessThan(emailValue, value);

      case 'is_empty':
        return this._matchIsEmpty(emailValue);

      case 'is_not_empty':
        return !this._matchIsEmpty(emailValue);

      default:
        logger.warn('Unknown operator', { operator });
        return false;
    }
  }

  /**
   * Check if email matches all conditions (AND logic)
   */
  matchAll(email, conditions) {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    return conditions.every((condition) =>
      this.matchCondition(email, condition)
    );
  }

  /**
   * Check if email matches any condition (OR logic)
   */
  matchAny(email, conditions) {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    return conditions.some((condition) =>
      this.matchCondition(email, condition)
    );
  }

  /**
   * Get email field value by field name
   */
  _getEmailField(email, field) {
    switch (field) {
      case 'from':
        return email.from || '';

      case 'to':
        return email.to || '';

      case 'cc':
        return email.cc || '';

      case 'subject':
        return email.subject || '';

      case 'body':
        return (email.bodyText || '') + ' ' + (email.bodyHtml || '');

      case 'has_attachments':
        return email.hasAttachments;

      case 'size':
        return this._calculateEmailSize(email);

      case 'date':
        return email.date;

      case 'folder':
        return email.folder || '';

      default:
        logger.warn('Unknown field', { field });
        return null;
    }
  }

  /**
   * Calculate approximate email size
   */
  _calculateEmailSize(email) {
    let size = 0;
    if (email.bodyText) size += email.bodyText.length;
    if (email.bodyHtml) size += email.bodyHtml.length;
    if (email.subject) size += email.subject.length;
    return size;
  }

  /**
   * Match equals operator
   */
  _matchEquals(emailValue, conditionValue) {
    if (typeof emailValue === 'boolean') {
      return (
        emailValue === (conditionValue === 'true' || conditionValue === true)
      );
    }
    return (
      String(emailValue).toLowerCase() === String(conditionValue).toLowerCase()
    );
  }

  /**
   * Match contains operator
   */
  _matchContains(emailValue, conditionValue) {
    return String(emailValue)
      .toLowerCase()
      .includes(String(conditionValue).toLowerCase());
  }

  /**
   * Match starts_with operator
   */
  _matchStartsWith(emailValue, conditionValue) {
    return String(emailValue)
      .toLowerCase()
      .startsWith(String(conditionValue).toLowerCase());
  }

  /**
   * Match ends_with operator
   */
  _matchEndsWith(emailValue, conditionValue) {
    return String(emailValue)
      .toLowerCase()
      .endsWith(String(conditionValue).toLowerCase());
  }

  /**
   * Match regex operator
   */
  _matchRegex(emailValue, pattern) {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(String(emailValue));
    } catch (error) {
      logger.error('Invalid regex pattern', { pattern, error: error.message });
      return false;
    }
  }

  /**
   * Match greater_than operator
   */
  _matchGreaterThan(emailValue, conditionValue) {
    const numValue = Number(emailValue);
    const numCondition = Number(conditionValue);

    if (isNaN(numValue) || isNaN(numCondition)) {
      return false;
    }

    return numValue > numCondition;
  }

  /**
   * Match less_than operator
   */
  _matchLessThan(emailValue, conditionValue) {
    const numValue = Number(emailValue);
    const numCondition = Number(conditionValue);

    if (isNaN(numValue) || isNaN(numCondition)) {
      return false;
    }

    return numValue < numCondition;
  }

  /**
   * Match is_empty operator
   */
  _matchIsEmpty(emailValue) {
    if (emailValue === null || emailValue === undefined) {
      return true;
    }

    if (typeof emailValue === 'string') {
      return emailValue.trim() === '';
    }

    if (Array.isArray(emailValue)) {
      return emailValue.length === 0;
    }

    return false;
  }
}

module.exports = new ConditionMatcher();
