import Database from 'better-sqlite3';

import type {
  Email,
  EmailCreateInput,
  DraftSaveInput,
  EmailSearchQuery,
  PaginationOptions,
} from '../../types';

import { StorageError } from '../../utils/errors';
import logger from '../../utils/logger';
import database from '../database';

interface EmailRow {
  id: number;
  uid: number;
  message_id: string;
  folder: string;
  from_address: string;
  to_address: string;
  cc_address: string | null;
  subject: string;
  date: string;
  body_text: string | null;
  body_html: string | null;
  has_attachments: number;
  is_read: number;
  is_draft: number;
  is_deleted: number;
  is_spam: number;
  is_starred: number;
  is_important: number;
  priority: number | null;
  deleted_at: string | null;
  in_reply_to: string | null;
  references: string | null;
  thread_id: number | null;
  account_id: number | null;
  flags: string | null;
  created_at: string;
  updated_at: string;
}

interface FindFolderOptions extends PaginationOptions {
  unreadOnly?: boolean;
}

interface FindStarredOptions extends PaginationOptions {
  folder?: string | null;
}
interface FindImportantOptions extends PaginationOptions {
  folder?: string | null;
}

interface UpdateData {
  isRead?: boolean;
  flags?: string[];
  bodyText?: string;
  bodyHtml?: string;
}

interface BodyData {
  bodyText?: string;
  bodyHtml?: string;
}

interface ThreadMetadata {
  inReplyTo?: string;
  references?: string;
  threadId?: number;
}

interface CountResult {
  count: number;
}

class EmailModel {
  private db: Database.Database | null = null;

  private _getDb(): Database.Database {
    if (!this.db) {
      this.db = database.getDb();
    }
    return this.db;
  }

  create(emailData: EmailCreateInput): number {
    try {
      const db = this._getDb();
      const stmt = db.prepare(`
        INSERT INTO emails (
          uid, message_id, folder, from_address, to_address, cc_address,
          subject, date, body_text, body_html, has_attachments, is_read, flags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        emailData.uid,
        emailData.messageId,
        emailData.folder,
        emailData.from,
        emailData.to,
        emailData.cc || null,
        emailData.subject,
        emailData.date,
        emailData.bodyText || null,
        emailData.bodyHtml || null,
        emailData.hasAttachments ? 1 : 0,
        emailData.isRead ? 1 : 0,
        emailData.flags ? JSON.stringify(emailData.flags) : null
      );

      logger.debug('Email created', { id: result.lastInsertRowid });
      return result.lastInsertRowid as number;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to create email', { error: errorMessage });
      throw new StorageError(`Failed to create email: ${errorMessage}`);
    }
  }

  findById(id: number): Email | null {
    try {
      const db = this._getDb();
      const stmt = db.prepare('SELECT * FROM emails WHERE id = ?');
      const email = stmt.get(id) as EmailRow | undefined;
      return email ? this._formatEmail(email) : null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to find email by ID', { id, error: errorMessage });
      throw new StorageError(`Failed to find email: ${errorMessage}`);
    }
  }

  findByUid(uid: number, folder = 'INBOX'): Email | null {
    try {
      const db = this._getDb();
      const stmt = db.prepare(
        'SELECT * FROM emails WHERE uid = ? AND folder = ?'
      );
      const email = stmt.get(uid, folder) as EmailRow | undefined;
      return email ? this._formatEmail(email) : null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to find email by UID', { uid, error: errorMessage });
      throw new StorageError(`Failed to find email: ${errorMessage}`);
    }
  }

  findByMessageId(messageId: string): Email | null {
    try {
      const db = this._getDb();
      const stmt = db.prepare('SELECT * FROM emails WHERE message_id = ?');
      const email = stmt.get(messageId) as EmailRow | undefined;
      return email ? this._formatEmail(email) : null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to find email by message ID', {
        messageId,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find email: ${errorMessage}`);
    }
  }

  findByFolder(folder = 'INBOX', options: FindFolderOptions = {}): Email[] {
    try {
      const db = this._getDb();
      const { limit = 50, offset = 0, unreadOnly = false } = options;

      let query = 'SELECT * FROM emails WHERE folder = ?';
      const params: (string | number)[] = [folder];

      if (unreadOnly) {
        query += ' AND is_read = 0';
      }

      query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = db.prepare(query);
      const emails = stmt.all(...params) as EmailRow[];
      return emails.map((email) => this._formatEmail(email));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to find emails by folder', {
        folder,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find emails: ${errorMessage}`);
    }
  }

  search(query: EmailSearchQuery): Email[] {
    try {
      const db = this._getDb();
      const {
        keyword,
        from,
        to,
        cc,
        subject,
        folder,
        dateFrom,
        dateTo,
        starred,
        flagged,
        unread,
        hasAttachment,
        noAttachment,
        tag,
        accountId,
        limit = 100,
        offset = 0,
      } = query;

      let sql = 'SELECT DISTINCT e.* FROM emails e';
      const params: (string | number | boolean)[] = [];
      const conditions: string[] = [];

      if (tag) {
        sql += ' LEFT JOIN email_tags et ON e.id = et.email_id';
        sql += ' LEFT JOIN tags t ON et.tag_id = t.id';
      }

      conditions.push('e.is_deleted = 0');

      if (keyword) {
        conditions.push(
          '(e.subject LIKE ? OR e.body_text LIKE ? OR e.from_address LIKE ?)'
        );
        const searchTerm = `%${keyword}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (from) {
        conditions.push('e.from_address LIKE ?');
        params.push(`%${from}%`);
      }

      if (to) {
        conditions.push('e.to_address LIKE ?');
        params.push(`%${to}%`);
      }

      if (cc) {
        conditions.push('e.cc_address LIKE ?');
        params.push(`%${cc}%`);
      }

      if (subject) {
        conditions.push('e.subject LIKE ?');
        params.push(`%${subject}%`);
      }

      if (folder) {
        conditions.push('e.folder = ?');
        params.push(folder);
      }

      if (dateFrom) {
        conditions.push('e.date >= ?');
        params.push(dateFrom);
      }

      if (dateTo) {
        conditions.push('e.date <= ?');
        params.push(dateTo);
      }

      if (starred !== undefined) {
        conditions.push('e.is_starred = ?');
        params.push(starred ? 1 : 0);
      }

      if (flagged !== undefined) {
        conditions.push('e.is_important = ?');
        params.push(flagged ? 1 : 0);
      }

      if (unread !== undefined) {
        conditions.push('e.is_read = ?');
        params.push(unread ? 0 : 1);
      }

      if (hasAttachment !== undefined) {
        conditions.push('e.has_attachments = ?');
        params.push(hasAttachment ? 1 : 0);
      }

      if (noAttachment) {
        conditions.push('e.has_attachments = 0');
      }

      if (tag) {
        conditions.push('t.name = ?');
        params.push(tag);
      }

      if (accountId !== undefined) {
        conditions.push('e.account_id = ?');
        params.push(accountId);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' ORDER BY e.date DESC';
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = db.prepare(sql);
      const emails = stmt.all(...params) as EmailRow[];
      return emails.map((email) => this._formatEmail(email));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to search emails', { error: errorMessage });
      throw new StorageError(`Failed to search emails: ${errorMessage}`);
    }
  }

  update(id: number, data: UpdateData): boolean {
    try {
      const db = this._getDb();
      const fields: string[] = [];
      const params: (string | number)[] = [];

      if (data.isRead !== undefined) {
        fields.push('is_read = ?');
        params.push(data.isRead ? 1 : 0);
      }

      if (data.flags !== undefined) {
        fields.push('flags = ?');
        params.push(JSON.stringify(data.flags));
      }

      if (data.bodyText !== undefined) {
        fields.push('body_text = ?');
        params.push(data.bodyText);
      }

      if (data.bodyHtml !== undefined) {
        fields.push('body_html = ?');
        params.push(data.bodyHtml);
      }

      if (fields.length === 0) {
        return false;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE emails SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      logger.debug('Email updated', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to update email', { id, error: errorMessage });
      throw new StorageError(`Failed to update email: ${errorMessage}`);
    }
  }

  updateBody(id: number, bodyData: BodyData): boolean {
    return this.update(id, {
      bodyText: bodyData.bodyText,
      bodyHtml: bodyData.bodyHtml,
    });
  }

  markAsRead(id: number): boolean {
    return this.update(id, { isRead: true });
  }

  markAsUnread(id: number): boolean {
    return this.update(id, { isRead: false });
  }

  updateFolder(id: number, folder: string): boolean {
    try {
      const db = this._getDb();
      const stmt = db.prepare(`
        UPDATE emails SET folder = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(folder, id);
      logger.debug('Email folder updated', {
        id,
        folder,
        changes: result.changes,
      });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to update email folder', {
        id,
        folder,
        error: errorMessage,
      });
      throw new StorageError(`Failed to update email folder: ${errorMessage}`);
    }
  }

  markAsSpam(id: number): boolean {
    try {
      const db = this._getDb();
      const stmt = db.prepare(`
        UPDATE emails SET is_spam = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(id);
      logger.debug('Email marked as spam', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to mark email as spam', { id, error: errorMessage });
      throw new StorageError(`Failed to mark email as spam: ${errorMessage}`);
    }
  }

  unmarkAsSpam(id: number): boolean {
    try {
      const db = this._getDb();
      const stmt = db.prepare(`
        UPDATE emails SET is_spam = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(id);
      logger.debug('Email unmarked as spam', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to unmark email as spam', {
        id,
        error: errorMessage,
      });
      throw new StorageError(`Failed to unmark email as spam: ${errorMessage}`);
    }
  }

  findSpam(options: FindSpamOptions = {}): Email[] {
    try {
      const db = this._getDb();
      const { limit = 50, offset = 0 } = options;

      const query = `
        SELECT * FROM emails
        WHERE is_spam = 1 AND is_deleted = 0
        ORDER BY date DESC
        LIMIT ? OFFSET ?
      `;

      const stmt = db.prepare(query);
      const emails = stmt.all(limit, offset) as EmailRow[];
      return emails.map((email) => this._formatEmail(email));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to find spam emails', { error: errorMessage });
      throw new StorageError(`Failed to find spam emails: ${errorMessage}`);
    }
  }

  countSpam(): number {
    try {
      const db = this._getDb();
      const stmt = db.prepare(
        'SELECT COUNT(*) as count FROM emails WHERE is_spam = 1 AND is_deleted = 0'
      );
      const result = stmt.get() as CountResult;
      return result.count;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to count spam emails', { error: errorMessage });
      throw new StorageError(`Failed to count spam emails: ${errorMessage}`);
    }
  }

  saveDraft(draftData: DraftSaveInput): number {
    try {
      const db = this._getDb();

      if (draftData.id) {
        const stmt = db.prepare(`
          UPDATE emails SET
            to_address = ?,
            cc_address = ?,
            subject = ?,
            body_text = ?,
            body_html = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND is_draft = 1
        `);

        const result = stmt.run(
          draftData.to || '',
          draftData.cc || '',
          draftData.subject || '',
          draftData.bodyText || '',
          draftData.bodyHtml || '',
          draftData.id
        );

        logger.debug('Draft updated', {
          id: draftData.id,
          changes: result.changes,
        });
        return draftData.id;
      } else {
        const stmt = db.prepare(`
          INSERT INTO emails (
            uid, message_id, folder, from_address, to_address, cc_address,
            subject, date, body_text, body_html, has_attachments, is_read, is_draft, flags
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
          draftData.uid || 0,
          draftData.messageId || `draft-${Date.now()}@local`,
          'Drafts',
          draftData.from || '',
          draftData.to || '',
          draftData.cc || '',
          draftData.subject || '',
          new Date().toISOString(),
          draftData.bodyText || '',
          draftData.bodyHtml || '',
          0,
          0,
          1,
          JSON.stringify(['\\Draft'])
        );

        logger.debug('Draft created', { id: result.lastInsertRowid });
        return result.lastInsertRowid as number;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to save draft', { error: errorMessage });
      throw new StorageError(`Failed to save draft: ${errorMessage}`);
    }
  }

  findDrafts(options: FindDraftsOptions = {}): Email[] {
    try {
      const db = this._getDb();
      const { limit = 50, offset = 0 } = options;

      const query = `
        SELECT * FROM emails
        WHERE is_draft = 1
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `;

      const stmt = db.prepare(query);
      const drafts = stmt.all(limit, offset) as EmailRow[];
      return drafts.map((draft) => this._formatEmail(draft));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to find drafts', { error: errorMessage });
      throw new StorageError(`Failed to find drafts: ${errorMessage}`);
    }
  }

  deleteDraft(id: number): boolean {
    try {
      const db = this._getDb();
      const stmt = db.prepare(
        'DELETE FROM emails WHERE id = ? AND is_draft = 1'
      );
      const result = stmt.run(id);
      logger.debug('Draft deleted', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to delete draft', { id, error: errorMessage });
      throw new StorageError(`Failed to delete draft: ${errorMessage}`);
    }
  }

  convertDraftToSent(id: number, messageId: string): boolean {
    try {
      const db = this._getDb();
      const stmt = db.prepare(`
        UPDATE emails SET
          is_draft = 0,
          folder = 'Sent',
          message_id = ?,
          date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_draft = 1
      `);

      const result = stmt.run(messageId, id);
      logger.debug('Draft converted to sent', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to convert draft', { id, error: errorMessage });
      throw new StorageError(`Failed to convert draft: ${errorMessage}`);
    }
  }

  countDrafts(): number {
    try {
      const db = this._getDb();
      const stmt = db.prepare(
        'SELECT COUNT(*) as count FROM emails WHERE is_draft = 1'
      );
      const result = stmt.get() as CountResult;
      return result.count;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to count drafts', { error: errorMessage });
      throw new StorageError(`Failed to count drafts: ${errorMessage}`);
    }
  }

  markAsDeleted(id: number): boolean {
    try {
      const db = this._getDb();
      const stmt = db.prepare(`
        UPDATE emails
        SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(id);
      logger.debug('Email marked as deleted', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to mark email as deleted', {
        id,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to mark email as deleted: ${errorMessage}`
      );
    }
  }

  restoreDeleted(id: number): boolean {
    try {
      const db = this._getDb();
      const stmt = db.prepare(`
        UPDATE emails
        SET is_deleted = 0, deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(id);
      logger.debug('Email restored', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to restore email', { id, error: errorMessage });
      throw new StorageError(`Failed to restore email: ${errorMessage}`);
    }
  }

  findDeleted(options: FindDeletedOptions = {}): Email[] {
    try {
      const db = this._getDb();
      const { limit = 50, offset = 0 } = options;

      const sql = `
        SELECT * FROM emails
        WHERE is_deleted = 1
        ORDER BY deleted_at DESC
        LIMIT ? OFFSET ?
      `;
      const stmt = db.prepare(sql);
      const emails = stmt.all(limit, offset) as EmailRow[];
      return emails.map((email) => this._formatEmail(email));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to find deleted emails', { error: errorMessage });
      throw new StorageError(`Failed to find deleted emails: ${errorMessage}`);
    }
  }

  countDeleted(): number {
    try {
      const db = this._getDb();
      const stmt = db.prepare(
        'SELECT COUNT(*) as count FROM emails WHERE is_deleted = 1'
      );
      const result = stmt.get() as CountResult;
      return result.count;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to count deleted emails', { error: errorMessage });
      throw new StorageError(`Failed to count deleted emails: ${errorMessage}`);
    }
  }

  permanentlyDelete(id: number): boolean {
    try {
      const db = this._getDb();
      const stmt = db.prepare('DELETE FROM emails WHERE id = ?');
      const result = stmt.run(id);
      logger.debug('Email permanently deleted', {
        id,
        changes: result.changes,
      });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to permanently delete email', {
        id,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to permanently delete email: ${errorMessage}`
      );
    }
  }

  emptyTrash(): number {
    try {
      const db = this._getDb();
      const stmt = db.prepare('DELETE FROM emails WHERE is_deleted = 1');
      const result = stmt.run();
      logger.info('Trash emptied', { deleted: result.changes });
      return result.changes;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to empty trash', { error: errorMessage });
      throw new StorageError(`Failed to empty trash: ${errorMessage}`);
    }
  }

  findByThreadId(
    threadId: number,
    options: FindByThreadIdOptions = {}
  ): Email[] {
    try {
      const db = this._getDb();
      const { limit = 50, offset = 0 } = options;

      const query = `
        SELECT * FROM emails
        WHERE thread_id = ? AND is_deleted = 0
        ORDER BY date ASC
        LIMIT ? OFFSET ?
      `;

      const stmt = db.prepare(query);
      const emails = stmt.all(threadId, limit, offset) as EmailRow[];
      return emails.map((email) => this._formatEmail(email));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to find emails by thread ID', {
        threadId,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to find emails by thread ID: ${errorMessage}`
      );
    }
  }

  updateThreadMetadata(id: number, metadata: ThreadMetadata): boolean {
    try {
      const db = this._getDb();
      const fields: string[] = [];
      const params: (string | number)[] = [];

      if (metadata.inReplyTo !== undefined) {
        fields.push('in_reply_to = ?');
        params.push(metadata.inReplyTo);
      }

      if (metadata.references !== undefined) {
        fields.push('references = ?');
        params.push(metadata.references);
      }

      if (metadata.threadId !== undefined) {
        fields.push('thread_id = ?');
        params.push(metadata.threadId);
      }

      if (fields.length === 0) {
        return false;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE emails SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      logger.debug('Email thread metadata updated', {
        id,
        changes: result.changes,
      });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to update thread metadata', {
        id,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to update thread metadata: ${errorMessage}`
      );
    }
  }

  delete(id: number): boolean {
    return this.permanentlyDelete(id);
  }

  markAsStarred(id: number): boolean {
    try {
      const db = this._getDb();
      const stmt = db.prepare(`
        UPDATE emails
        SET is_starred = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(id);
      logger.debug('Email marked as starred', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to mark email as starred', {
        id,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to mark email as starred: ${errorMessage}`
      );
    }
  }

  unmarkAsStarred(id: number): boolean {
    try {
      const db = this._getDb();
      const stmt = db.prepare(`
        UPDATE emails
        SET is_starred = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(id);
      logger.debug('Email unmarked as starred', {
        id,
        changes: result.changes,
      });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to unmark email as starred', {
        id,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to unmark email as starred: ${errorMessage}`
      );
    }
  }

  markAsImportant(id: number): boolean {
    try {
      const db = this._getDb();
      const stmt = db.prepare(`
        UPDATE emails
        SET is_important = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(id);
      logger.debug('Email marked as important', {
        id,
        changes: result.changes,
      });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to mark email as important', {
        id,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to mark email as important: ${errorMessage}`
      );
    }
  }

  unmarkAsImportant(id: number): boolean {
    try {
      const db = this._getDb();
      const stmt = db.prepare(`
        UPDATE emails
        SET is_important = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(id);
      logger.debug('Email unmarked as important', {
        id,
        changes: result.changes,
      });
      return result.changes > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to unmark email as important', {
        id,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to unmark email as important: ${errorMessage}`
      );
    }
  }

  findStarred(options: FindStarredOptions = {}): Email[] {
    try {
      const db = this._getDb();
      const { limit = 50, offset = 0, folder = null } = options;

      let query =
        'SELECT * FROM emails WHERE is_starred = 1 AND is_deleted = 0';
      const params: (string | number)[] = [];

      if (folder) {
        query += ' AND folder = ?';
        params.push(folder);
      }

      query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = db.prepare(query);
      const emails = stmt.all(...params) as EmailRow[];
      return emails.map((email) => this._formatEmail(email));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to find starred emails', { error: errorMessage });
      throw new StorageError(`Failed to find starred emails: ${errorMessage}`);
    }
  }

  findImportant(options: FindImportantOptions = {}): Email[] {
    try {
      const db = this._getDb();
      const { limit = 50, offset = 0, folder = null } = options;

      let query =
        'SELECT * FROM emails WHERE is_important = 1 AND is_deleted = 0';
      const params: (string | number)[] = [];

      if (folder) {
        query += ' AND folder = ?';
        params.push(folder);
      }

      query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = db.prepare(query);
      const emails = stmt.all(...params) as EmailRow[];
      return emails.map((email) => this._formatEmail(email));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to find important emails', { error: errorMessage });
      throw new StorageError(
        `Failed to find important emails: ${errorMessage}`
      );
    }
  }

  countStarred(folder = null): number {
    try {
      const db = this._getDb();
      let query =
        'SELECT COUNT(*) as count FROM emails WHERE is_starred = 1 AND is_deleted = 0';
      const params: string[] = [];

      if (folder) {
        query += ' AND folder = ?';
        params.push(folder);
      }

      const stmt = db.prepare(query);
      const result = stmt.get(...params) as CountResult;
      return result.count;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to count starred emails', { error: errorMessage });
      throw new StorageError(`Failed to count starred emails: ${errorMessage}`);
    }
  }

  countImportant(folder = null): number {
    try {
      const db = this._getDb();
      let query =
        'SELECT COUNT(*) as count FROM emails WHERE is_important = 1 AND is_deleted = 0';
      const params: string[] = [];

      if (folder) {
        query += ' AND folder = ?';
        params.push(folder);
      }

      const stmt = db.prepare(query);
      const result = stmt.get(...params) as CountResult;
      return result.count;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to count important emails', { error: errorMessage });
      throw new StorageError(
        `Failed to count important emails: ${errorMessage}`
      );
    }
  }

  countByFolder(folder = 'INBOX', unreadOnly = false): number {
    try {
      const db = this._getDb();
      let sql = 'SELECT COUNT(*) as count FROM emails WHERE folder = ?';
      const params: (string | number)[] = [folder];

      if (unreadOnly) {
        sql += ' AND is_read = 0';
      }

      const stmt = db.prepare(sql);
      const result = stmt.get(...params) as CountResult;
      return result.count;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Failed to count emails', { folder, error: errorMessage });
      throw new StorageError(`Failed to count emails: ${errorMessage}`);
    }
  }

  private _formatEmail(email: EmailRow): Email {
    return {
      id: email.id,
      uid: email.uid,
      messageId: email.message_id,
      folder: email.folder,
      from: email.from_address,
      to: email.to_address,
      cc: email.cc_address || '',
      subject: email.subject,
      date: email.date,
      bodyText: email.body_text || '',
      bodyHtml: email.body_html || '',
      hasAttachments: email.has_attachments === 1,
      isRead: email.is_read === 1,
      isDraft: email.is_draft === 1,
      isDeleted: email.is_deleted === 1,
      isSpam: email.is_spam === 1,
      isStarred: email.is_starred === 1,
      isImportant: email.is_important === 1,
      priority: email.priority || 0,
      deletedAt: email.deleted_at,
      inReplyTo: email.in_reply_to,
      references: email.references,
      threadId: email.thread_id,
      accountId: email.account_id,
      flags: email.flags ? JSON.parse(email.flags) : [],
      createdAt: email.created_at,
      updatedAt: email.updated_at,
    };
  }
}

export default new EmailModel();
