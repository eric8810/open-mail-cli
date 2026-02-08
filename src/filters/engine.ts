import executor from './executor';
import matcher from './matcher';
import emailModel from '../storage/models/email';
import filterModel from '../storage/models/filter';
import logger from '../utils/logger';

/**
 * Filter Rules Engine
 * Main engine for processing email filter rules
 */
class FilterEngine {
  /**
   * Apply all enabled filters to an email
   */
  async applyFilters(email, options = {}) {
    try {
      const { accountId = null } = options;

      const filters = filterModel.findAll({
        enabledOnly: true,
        accountId,
      });

      if (filters.length === 0) {
        logger.debug('No filters to apply', { emailId: email.id });
        return { matched: false, appliedFilters: [] };
      }

      const appliedFilters = [];

      for (const filter of filters) {
        const matched = this._matchFilter(email, filter);

        if (matched) {
          logger.debug('Filter matched', {
            emailId: email.id,
            filterId: filter.id,
            filterName: filter.name,
          });

          const results = await executor.executeActions(email, filter.actions);

          appliedFilters.push({
            filterId: filter.id,
            filterName: filter.name,
            actions: results,
          });

          email = await emailModel.findById(email.id);
        }
      }

      return {
        matched: appliedFilters.length > 0,
        appliedFilters,
      };
    } catch (error) {
      logger.error('Failed to apply filters', {
        emailId: email.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Test if an email matches a filter (without executing actions)
   */
  testFilter(email, filterId) {
    try {
      const filter = filterModel.findById(filterId);

      if (!filter) {
        throw new Error(`Filter ${filterId} not found`);
      }

      const matched = this._matchFilter(email, filter);

      return {
        matched,
        filter: {
          id: filter.id,
          name: filter.name,
          conditions: filter.conditions,
          actions: filter.actions,
        },
      };
    } catch (error) {
      logger.error('Failed to test filter', {
        emailId: email.id,
        filterId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Apply filters to multiple emails
   */
  async applyFiltersToEmails(emails, options = {}) {
    const results = [];

    for (const email of emails) {
      try {
        const result = await this.applyFilters(email, options);
        results.push({
          emailId: email.id,
          ...result,
        });
      } catch (error) {
        logger.error('Failed to apply filters to email', {
          emailId: email.id,
          error: error.message,
        });
        results.push({
          emailId: email.id,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Apply a specific filter to an email
   */
  async applyFilter(email, filterId) {
    try {
      const filter = filterModel.findById(filterId);

      if (!filter) {
        throw new Error(`Filter ${filterId} not found`);
      }

      if (!filter.isEnabled) {
        return {
          matched: false,
          message: 'Filter is disabled',
        };
      }

      const matched = this._matchFilter(email, filter);

      if (!matched) {
        return {
          matched: false,
          message: 'Email does not match filter conditions',
        };
      }

      const results = await executor.executeActions(email, filter.actions);

      return {
        matched: true,
        filterId: filter.id,
        filterName: filter.name,
        actions: results,
      };
    } catch (error) {
      logger.error('Failed to apply filter', {
        emailId: email.id,
        filterId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Check if email matches filter conditions
   */
  _matchFilter(email, filter) {
    if (!filter.conditions || filter.conditions.length === 0) {
      return true;
    }

    if (filter.matchAll) {
      return matcher.matchAll(email, filter.conditions);
    } else {
      return matcher.matchAny(email, filter.conditions);
    }
  }

  /**
   * Get filter statistics
   */
  getStatistics() {
    try {
      const allFilters = filterModel.findAll();
      const enabledFilters = filterModel.findAll({ enabledOnly: true });

      return {
        totalFilters: allFilters.length,
        enabledFilters: enabledFilters.length,
        disabledFilters: allFilters.length - enabledFilters.length,
      };
    } catch (error) {
      logger.error('Failed to get filter statistics', { error: error.message });
      throw error;
    }
  }
}

module.exports = new FilterEngine();
