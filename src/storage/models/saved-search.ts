import type { SQLiteDatabase } from '../../types/database';

import { StorageError } from '../../utils/errors';
import logger from '../../utils/logger';
import database from '../database';

interface SavedSearchCreateInput {
  name: string;
  query: unknown;
  description?: string | null;
  accountId?: number | null;
}

interface SavedSearchUpdateInput {
  name?: string;
  query?: unknown;
  description?: string | null;
}

interface SavedSearchRow {
  id: number;
  name: string;
  query: string;
  description: string | null;
  account_id: number | null;
  created_at: string;
  updated_at: string;
}

interface CountRow {
  count: number;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * Saved search model.
 */
export class SavedSearchModel {
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

  create(searchData: SavedSearchCreateInput): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO saved_searches (name, query, description, account_id)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        searchData.name,
        JSON.stringify(searchData.query),
        searchData.description ?? null,
        searchData.accountId ?? null
      );

      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Saved search created', { id: insertId });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to create saved search', { error: errorMessage });
      throw new StorageError(`Failed to create saved search: ${errorMessage}`);
    }
  }

  findById(id: number): SavedSearchRow | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], SavedSearchRow>(
        'SELECT * FROM saved_searches WHERE id = ?'
      );
      return stmt.get(id) ?? null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find saved search by ID', {
        id,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find saved search: ${errorMessage}`);
    }
  }

  findByName(name: string): SavedSearchRow | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[string], SavedSearchRow>(
        'SELECT * FROM saved_searches WHERE name = ?'
      );
      return stmt.get(name) ?? null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find saved search by name', {
        name,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find saved search: ${errorMessage}`);
    }
  }

  findAll(accountId: number | null = null): SavedSearchRow[] {
    try {
      const db = this.getDb();
      let query = 'SELECT * FROM saved_searches';
      const params: number[] = [];

      if (accountId !== null) {
        query += ' WHERE account_id = ?';
        params.push(accountId);
      }

      query += ' ORDER BY name ASC';

      const stmt = db.prepare<unknown[], SavedSearchRow>(query);
      return stmt.all(...params);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find saved searches', { error: errorMessage });
      throw new StorageError(`Failed to find saved searches: ${errorMessage}`);
    }
  }

  update(id: number, data: SavedSearchUpdateInput): boolean {
    try {
      const db = this.getDb();
      const fields: string[] = [];
      const params: Array<string | number | null> = [];

      if (data.name !== undefined) {
        fields.push('name = ?');
        params.push(data.name);
      }

      if (data.query !== undefined) {
        fields.push('query = ?');
        params.push(JSON.stringify(data.query));
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

      const sql = `UPDATE saved_searches SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      logger.debug('Saved search updated', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to update saved search', {
        id,
        error: errorMessage,
      });
      throw new StorageError(`Failed to update saved search: ${errorMessage}`);
    }
  }

  delete(id: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM saved_searches WHERE id = ?');
      const result = stmt.run(id);

      logger.debug('Saved search deleted', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete saved search', {
        id,
        error: errorMessage,
      });
      throw new StorageError(`Failed to delete saved search: ${errorMessage}`);
    }
  }

  count(accountId: number | null = null): number {
    try {
      const db = this.getDb();
      let query = 'SELECT COUNT(*) as count FROM saved_searches';
      const params: number[] = [];

      if (accountId !== null) {
        query += ' WHERE account_id = ?';
        params.push(accountId);
      }

      const stmt = db.prepare<unknown[], CountRow>(query);
      const result = stmt.get(...params);
      return result?.count ?? 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to count saved searches', { error: errorMessage });
      throw new StorageError(`Failed to count saved searches: ${errorMessage}`);
    }
  }
}

const savedSearchModel = new SavedSearchModel();
export default savedSearchModel;
