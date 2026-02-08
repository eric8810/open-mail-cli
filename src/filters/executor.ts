import emailModel from '../storage/models/email';
import logger from '../utils/logger';

/**
 * Filter Action Executor
 * Executes filter actions on emails
 */
class ActionExecutor {
  /**
   * Execute a single action on an email
   */
  async executeAction(email, action) {
    const { type, value } = action;

    try {
      switch (type) {
        case 'move':
          return await this._moveEmail(email, value);

        case 'mark_read':
          return await this._markAsRead(email);

        case 'mark_unread':
          return await this._markAsUnread(email);

        case 'star':
          return await this._starEmail(email);

        case 'unstar':
          return await this._unstarEmail(email);

        case 'flag':
          return await this._flagEmail(email);

        case 'unflag':
          return await this._unflagEmail(email);

        case 'delete':
          return await this._deleteEmail(email);

        case 'mark_spam':
          return await this._markAsSpam(email);

        case 'add_tag':
          return await this._addTag(email, value);

        case 'remove_tag':
          return await this._removeTag(email, value);

        default:
          logger.warn('Unknown action type', { type });
          return { success: false, message: `Unknown action type: ${type}` };
      }
    } catch (error) {
      logger.error('Failed to execute action', {
        emailId: email.id,
        action: type,
        error: error.message,
      });
      return { success: false, message: error.message };
    }
  }

  /**
   * Execute multiple actions on an email
   */
  async executeActions(email, actions) {
    const results = [];

    for (const action of actions) {
      const result = await this.executeAction(email, action);
      results.push({
        action: action.type,
        ...result,
      });
    }

    return results;
  }

  /**
   * Move email to folder
   */
  async _moveEmail(email, folder) {
    try {
      const db = emailModel._getDb();
      const stmt = db.prepare(
        'UPDATE emails SET folder = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      );
      stmt.run(folder, email.id);

      logger.debug('Email moved', { emailId: email.id, folder });
      return { success: true, message: `Moved to ${folder}` };
    } catch (error) {
      throw new Error(`Failed to move email: ${error.message}`);
    }
  }

  /**
   * Mark email as read
   */
  async _markAsRead(email) {
    await emailModel.markAsRead(email.id);
    logger.debug('Email marked as read', { emailId: email.id });
    return { success: true, message: 'Marked as read' };
  }

  /**
   * Mark email as unread
   */
  async _markAsUnread(email) {
    await emailModel.markAsUnread(email.id);
    logger.debug('Email marked as unread', { emailId: email.id });
    return { success: true, message: 'Marked as unread' };
  }

  /**
   * Star email
   */
  async _starEmail(email) {
    try {
      const db = emailModel._getDb();
      const stmt = db.prepare(
        'UPDATE emails SET is_starred = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      );
      stmt.run(email.id);

      logger.debug('Email starred', { emailId: email.id });
      return { success: true, message: 'Starred' };
    } catch (error) {
      throw new Error(`Failed to star email: ${error.message}`);
    }
  }

  /**
   * Unstar email
   */
  async _unstarEmail(email) {
    try {
      const db = emailModel._getDb();
      const stmt = db.prepare(
        'UPDATE emails SET is_starred = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      );
      stmt.run(email.id);

      logger.debug('Email unstarred', { emailId: email.id });
      return { success: true, message: 'Unstarred' };
    } catch (error) {
      throw new Error(`Failed to unstar email: ${error.message}`);
    }
  }

  /**
   * Flag email
   */
  async _flagEmail(email) {
    try {
      const db = emailModel._getDb();
      const stmt = db.prepare(
        'UPDATE emails SET is_flagged = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      );
      stmt.run(email.id);

      logger.debug('Email flagged', { emailId: email.id });
      return { success: true, message: 'Flagged' };
    } catch (error) {
      throw new Error(`Failed to flag email: ${error.message}`);
    }
  }

  /**
   * Unflag email
   */
  async _unflagEmail(email) {
    try {
      const db = emailModel._getDb();
      const stmt = db.prepare(
        'UPDATE emails SET is_flagged = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      );
      stmt.run(email.id);

      logger.debug('Email unflagged', { emailId: email.id });
      return { success: true, message: 'Unflagged' };
    } catch (error) {
      throw new Error(`Failed to unflag email: ${error.message}`);
    }
  }

  /**
   * Delete email (soft delete)
   */
  async _deleteEmail(email) {
    await emailModel.markAsDeleted(email.id);
    logger.debug('Email deleted', { emailId: email.id });
    return { success: true, message: 'Deleted' };
  }

  /**
   * Mark email as spam
   */
  async _markAsSpam(email) {
    await emailModel.markAsSpam(email.id);
    logger.debug('Email marked as spam', { emailId: email.id });
    return { success: true, message: 'Marked as spam' };
  }

  /**
   * Add tag to email
   */
  async _addTag(email, tagName) {
    try {
      const db = emailModel._getDb();

      const tagStmt = db.prepare('SELECT id FROM tags WHERE name = ?');
      const tag = tagStmt.get(tagName);

      if (!tag) {
        return { success: false, message: `Tag "${tagName}" not found` };
      }

      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO email_tags (email_id, tag_id)
        VALUES (?, ?)
      `);
      insertStmt.run(email.id, tag.id);

      logger.debug('Tag added to email', { emailId: email.id, tagName });
      return { success: true, message: `Tagged with "${tagName}"` };
    } catch (error) {
      throw new Error(`Failed to add tag: ${error.message}`);
    }
  }

  /**
   * Remove tag from email
   */
  async _removeTag(email, tagName) {
    try {
      const db = emailModel._getDb();

      const tagStmt = db.prepare('SELECT id FROM tags WHERE name = ?');
      const tag = tagStmt.get(tagName);

      if (!tag) {
        return { success: false, message: `Tag "${tagName}" not found` };
      }

      const deleteStmt = db.prepare(
        'DELETE FROM email_tags WHERE email_id = ? AND tag_id = ?'
      );
      deleteStmt.run(email.id, tag.id);

      logger.debug('Tag removed from email', { emailId: email.id, tagName });
      return { success: true, message: `Removed tag "${tagName}"` };
    } catch (error) {
      throw new Error(`Failed to remove tag: ${error.message}`);
    }
  }
}

module.exports = new ActionExecutor();
