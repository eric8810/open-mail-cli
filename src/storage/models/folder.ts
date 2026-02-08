import type { SQLiteDatabase } from '../../types/database';

import { StorageError } from '../../utils/errors';
import logger from '../../utils/logger';
import database from '../database';

interface FolderInput {
  name: string;
  delimiter?: string | null;
  flags?: string[];
  lastSync?: string | null;
  accountId?: number | null;
  parentId?: number | null;
  isFavorite?: boolean;
  sortOrder?: number;
}

interface FolderRow {
  id: number;
  name: string;
  delimiter: string | null;
  flags: string | null;
  last_sync: string | null;
  account_id: number | null;
  parent_id: number | null;
  is_favorite: number;
  sort_order: number | null;
  unread_count: number | null;
  total_count: number | null;
  created_at: string;
}

export interface FolderRecord {
  id: number;
  name: string;
  delimiter: string | null;
  flags: string[];
  lastSync: string | null;
  accountId: number | null;
  parentId: number | null;
  isFavorite: boolean;
  sortOrder: number;
  unreadCount: number;
  totalCount: number;
  createdAt: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * Folder model.
 */
export class FolderModel {
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

  upsert(folderData: FolderInput): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO folders (name, delimiter, flags, last_sync, account_id, parent_id, is_favorite, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          delimiter = excluded.delimiter,
          flags = excluded.flags,
          last_sync = excluded.last_sync,
          account_id = excluded.account_id,
          parent_id = excluded.parent_id,
          is_favorite = excluded.is_favorite,
          sort_order = excluded.sort_order
      `);

      const result = stmt.run(
        folderData.name,
        folderData.delimiter ?? '/',
        folderData.flags ? JSON.stringify(folderData.flags) : null,
        folderData.lastSync ?? null,
        folderData.accountId ?? null,
        folderData.parentId ?? null,
        folderData.isFavorite ? 1 : 0,
        folderData.sortOrder ?? 0
      );

      logger.debug('Folder upserted', { name: folderData.name });
      return result.lastInsertRowid
        ? toNumber(result.lastInsertRowid)
        : result.changes;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to upsert folder', { error: errorMessage });
      throw new StorageError(`Failed to upsert folder: ${errorMessage}`);
    }
  }

  create(folderData: FolderInput): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO folders (name, delimiter, flags, account_id, parent_id, is_favorite, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        folderData.name,
        folderData.delimiter ?? '/',
        folderData.flags ? JSON.stringify(folderData.flags) : null,
        folderData.accountId ?? null,
        folderData.parentId ?? null,
        folderData.isFavorite ? 1 : 0,
        folderData.sortOrder ?? 0
      );

      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Folder created', { name: folderData.name, id: insertId });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to create folder', { error: errorMessage });
      throw new StorageError(`Failed to create folder: ${errorMessage}`);
    }
  }

  deleteByName(name: string): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM folders WHERE name = ?');
      const result = stmt.run(name);
      logger.debug('Folder deleted', { name, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete folder', { name, error: errorMessage });
      throw new StorageError(`Failed to delete folder: ${errorMessage}`);
    }
  }

  rename(oldName: string, newName: string): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('UPDATE folders SET name = ? WHERE name = ?');
      const result = stmt.run(newName, oldName);
      logger.debug('Folder renamed', {
        oldName,
        newName,
        changes: result.changes,
      });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to rename folder', {
        oldName,
        newName,
        error: errorMessage,
      });
      throw new StorageError(`Failed to rename folder: ${errorMessage}`);
    }
  }

  findChildren(parentId: number): FolderRecord[] {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], FolderRow>(
        'SELECT * FROM folders WHERE parent_id = ? ORDER BY sort_order, name'
      );
      const folders = stmt.all(parentId);
      return folders.map((folder) => this.formatFolder(folder));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find child folders', {
        parentId,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find child folders: ${errorMessage}`);
    }
  }

  updateCounts(name: string, unreadCount: number, totalCount: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare(
        'UPDATE folders SET unread_count = ?, total_count = ? WHERE name = ?'
      );
      const result = stmt.run(unreadCount, totalCount, name);
      logger.debug('Folder counts updated', { name, unreadCount, totalCount });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to update folder counts', {
        name,
        error: errorMessage,
      });
      throw new StorageError(`Failed to update folder counts: ${errorMessage}`);
    }
  }

  findAll(): FolderRecord[] {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[], FolderRow>(
        'SELECT * FROM folders ORDER BY name'
      );
      const folders = stmt.all();
      return folders.map((folder) => this.formatFolder(folder));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find folders', { error: errorMessage });
      throw new StorageError(`Failed to find folders: ${errorMessage}`);
    }
  }

  findByName(name: string): FolderRecord | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[string], FolderRow>(
        'SELECT * FROM folders WHERE name = ?'
      );
      const folder = stmt.get(name);
      return folder ? this.formatFolder(folder) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find folder', { name, error: errorMessage });
      throw new StorageError(`Failed to find folder: ${errorMessage}`);
    }
  }

  updateLastSync(name: string, lastSync = new Date().toISOString()): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare(
        'UPDATE folders SET last_sync = ? WHERE name = ?'
      );
      const result = stmt.run(lastSync, name);
      logger.debug('Folder last sync updated', { name, lastSync });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to update folder last sync', {
        name,
        error: errorMessage,
      });
      throw new StorageError(`Failed to update folder: ${errorMessage}`);
    }
  }

  private formatFolder(folder: FolderRow): FolderRecord {
    let flags: string[] = [];
    if (folder.flags) {
      try {
        const parsed = JSON.parse(folder.flags) as unknown;
        flags = Array.isArray(parsed)
          ? parsed.filter((item): item is string => typeof item === 'string')
          : [];
      } catch {
        flags = [];
      }
    }

    return {
      id: folder.id,
      name: folder.name,
      delimiter: folder.delimiter,
      flags,
      lastSync: folder.last_sync,
      accountId: folder.account_id,
      parentId: folder.parent_id,
      isFavorite: folder.is_favorite === 1,
      sortOrder: folder.sort_order ?? 0,
      unreadCount: folder.unread_count ?? 0,
      totalCount: folder.total_count ?? 0,
      createdAt: folder.created_at,
    };
  }
}

const folderModel = new FolderModel();
export default folderModel;
