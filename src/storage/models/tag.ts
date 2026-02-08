import type { SQLiteDatabase } from '../../types/database';

import { StorageError } from '../../utils/errors';
import logger from '../../utils/logger';
import database from '../database';

interface TagInput {
  name: string;
  color?: string;
  description?: string | null;
  accountId?: number | null;
}

interface TagUpdateInput {
  name?: string;
  color?: string;
  description?: string | null;
}

interface TagRow {
  id: number;
  name: string;
  color: string;
  description: string | null;
  account_id: number | null;
  created_at: string;
  updated_at: string;
}

interface CountRow {
  count: number;
}

export interface TagRecord {
  id: number;
  name: string;
  color: string;
  description: string | null;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * Tag model.
 */
export class TagModel {
  private db: SQLiteDatabase | null;

  constructor() {
    this.db = null;
  }

  private getDb(): SQLiteDatabase {
    if (!this.db) {
      this.db = database.getDb();
    }
    return this.db;
  }

  create(tagData: TagInput): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO tags (name, color, description, account_id)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        tagData.name,
        tagData.color ?? '#808080',
        tagData.description ?? null,
        tagData.accountId ?? null
      );

      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Tag created', { id: insertId, name: tagData.name });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (errorMessage.includes('UNIQUE constraint failed')) {
        throw new StorageError(`Tag "${tagData.name}" already exists`);
      }
      logger.error('Failed to create tag', { error: errorMessage });
      throw new StorageError(`Failed to create tag: ${errorMessage}`);
    }
  }

  findAll(accountId: number | null = null): TagRecord[] {
    try {
      const db = this.getDb();
      let query = 'SELECT * FROM tags';
      const params: number[] = [];

      if (accountId !== null) {
        query += ' WHERE account_id = ? OR account_id IS NULL';
        params.push(accountId);
      }

      query += ' ORDER BY name ASC';

      const stmt = db.prepare<unknown[], TagRow>(query);
      const tags = stmt.all(...params);
      return tags.map((tag) => this.formatTag(tag));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find tags', { error: errorMessage });
      throw new StorageError(`Failed to find tags: ${errorMessage}`);
    }
  }

  findById(id: number): TagRecord | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], TagRow>(
        'SELECT * FROM tags WHERE id = ?'
      );
      const tag = stmt.get(id);
      return tag ? this.formatTag(tag) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find tag by ID', { id, error: errorMessage });
      throw new StorageError(`Failed to find tag: ${errorMessage}`);
    }
  }

  findByName(name: string, accountId: number | null = null): TagRecord | null {
    try {
      const db = this.getDb();
      let query = 'SELECT * FROM tags WHERE name = ?';
      const params: Array<string | number> = [name];

      if (accountId !== null) {
        query += ' AND (account_id = ? OR account_id IS NULL)';
        params.push(accountId);
      }

      const stmt = db.prepare<unknown[], TagRow>(query);
      const tag = stmt.get(...params);
      return tag ? this.formatTag(tag) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find tag by name', { name, error: errorMessage });
      throw new StorageError(`Failed to find tag: ${errorMessage}`);
    }
  }

  update(id: number, data: TagUpdateInput): boolean {
    try {
      const db = this.getDb();
      const fields: string[] = [];
      const params: Array<string | number | null> = [];

      if (data.name !== undefined) {
        fields.push('name = ?');
        params.push(data.name);
      }

      if (data.color !== undefined) {
        fields.push('color = ?');
        params.push(data.color);
      }

      if (data.description !== undefined) {
        fields.push('description = ?');
        params.push(data.description);
      }

      if (fields.length === 0) {
        return false;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE tags SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      logger.debug('Tag updated', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (errorMessage.includes('UNIQUE constraint failed')) {
        throw new StorageError('Tag name already exists');
      }
      logger.error('Failed to update tag', { id, error: errorMessage });
      throw new StorageError(`Failed to update tag: ${errorMessage}`);
    }
  }

  delete(id: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM tags WHERE id = ?');
      const result = stmt.run(id);
      logger.debug('Tag deleted', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete tag', { id, error: errorMessage });
      throw new StorageError(`Failed to delete tag: ${errorMessage}`);
    }
  }

  addToEmail(emailId: number, tagId: number): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO email_tags (email_id, tag_id)
        VALUES (?, ?)
      `);

      const result = stmt.run(emailId, tagId);
      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Tag added to email', { emailId, tagId });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (errorMessage.includes('UNIQUE constraint failed')) {
        throw new StorageError('Email already has this tag');
      }
      logger.error('Failed to add tag to email', {
        emailId,
        tagId,
        error: errorMessage,
      });
      throw new StorageError(`Failed to add tag to email: ${errorMessage}`);
    }
  }

  removeFromEmail(emailId: number, tagId: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        DELETE FROM email_tags
        WHERE email_id = ? AND tag_id = ?
      `);

      const result = stmt.run(emailId, tagId);
      logger.debug('Tag removed from email', {
        emailId,
        tagId,
        changes: result.changes,
      });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to remove tag from email', {
        emailId,
        tagId,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to remove tag from email: ${errorMessage}`
      );
    }
  }

  findByEmailId(emailId: number): TagRecord[] {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], TagRow>(`
        SELECT t.* FROM tags t
        INNER JOIN email_tags et ON t.id = et.tag_id
        WHERE et.email_id = ?
        ORDER BY t.name ASC
      `);

      const tags = stmt.all(emailId);
      return tags.map((tag) => this.formatTag(tag));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find tags for email', {
        emailId,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find tags for email: ${errorMessage}`);
    }
  }

  findEmailsByTag(
    tagId: number,
    options: { limit?: number; offset?: number } = {}
  ): Record<string, unknown>[] {
    try {
      const db = this.getDb();
      const { limit = 50, offset = 0 } = options;

      const stmt = db.prepare<
        [number, number, number],
        Record<string, unknown>
      >(`
        SELECT e.* FROM emails e
        INNER JOIN email_tags et ON e.id = et.email_id
        WHERE et.tag_id = ? AND e.is_deleted = 0
        ORDER BY e.date DESC
        LIMIT ? OFFSET ?
      `);

      return stmt.all(tagId, limit, offset);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find emails by tag', {
        tagId,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find emails by tag: ${errorMessage}`);
    }
  }

  countEmailsByTag(tagId: number): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], CountRow>(`
        SELECT COUNT(*) as count FROM email_tags et
        INNER JOIN emails e ON et.email_id = e.id
        WHERE et.tag_id = ? AND e.is_deleted = 0
      `);

      const result = stmt.get(tagId);
      return result?.count ?? 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to count emails by tag', {
        tagId,
        error: errorMessage,
      });
      throw new StorageError(`Failed to count emails by tag: ${errorMessage}`);
    }
  }

  private formatTag(tag: TagRow): TagRecord {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      accountId: tag.account_id,
      createdAt: tag.created_at,
      updatedAt: tag.updated_at,
    };
  }
}

const tagModel = new TagModel();
export default tagModel;
