import type { SQLiteDatabase } from '../../types/database';

import { StorageError } from '../../utils/errors';
import logger from '../../utils/logger';
import database from '../database';

interface ThreadUpsertInput {
  threadId: string;
  subject: string | null;
  firstMessageDate: string | null;
  lastMessageDate: string | null;
  messageCount: number;
  accountId?: number | null;
}

interface ThreadFindOptions {
  limit?: number;
  offset?: number;
  accountId?: number | null;
}

interface ThreadCountRow {
  count: number;
}

interface ThreadRow {
  id: number;
  thread_id: string;
  subject: string | null;
  first_message_date: string | null;
  last_message_date: string | null;
  message_count: number;
  account_id: number | null;
  created_at: string;
  updated_at: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * Thread model.
 */
export class ThreadModel {
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

  upsertThread(threadData: ThreadUpsertInput): number | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO threads (
          thread_id, subject, first_message_date, last_message_date,
          message_count, account_id
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(thread_id) DO UPDATE SET
          subject = excluded.subject,
          last_message_date = excluded.last_message_date,
          message_count = excluded.message_count,
          updated_at = CURRENT_TIMESTAMP
      `);

      const result = stmt.run(
        threadData.threadId,
        threadData.subject,
        threadData.firstMessageDate,
        threadData.lastMessageDate,
        threadData.messageCount,
        threadData.accountId ?? null
      );

      logger.debug('Thread upserted', { threadId: threadData.threadId });
      if (result.lastInsertRowid) {
        return toNumber(result.lastInsertRowid);
      }

      return this.findByThreadId(threadData.threadId)?.id ?? null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to upsert thread', { error: errorMessage });
      throw new StorageError(`Failed to upsert thread: ${errorMessage}`);
    }
  }

  findByThreadId(threadId: string): ThreadRow | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[string], ThreadRow>(
        'SELECT * FROM threads WHERE thread_id = ?'
      );
      return stmt.get(threadId) ?? null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find thread', { threadId, error: errorMessage });
      throw new StorageError(`Failed to find thread: ${errorMessage}`);
    }
  }

  findAll(options: ThreadFindOptions = {}): ThreadRow[] {
    try {
      const db = this.getDb();
      const { limit = 50, offset = 0, accountId = null } = options;

      let query = 'SELECT * FROM threads WHERE 1=1';
      const params: Array<number> = [];

      if (accountId) {
        query += ' AND account_id = ?';
        params.push(accountId);
      }

      query += ' ORDER BY last_message_date DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = db.prepare<unknown[], ThreadRow>(query);
      return stmt.all(...params);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find threads', { error: errorMessage });
      throw new StorageError(`Failed to find threads: ${errorMessage}`);
    }
  }

  delete(threadId: string): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM threads WHERE thread_id = ?');
      const result = stmt.run(threadId);
      logger.debug('Thread deleted', { threadId, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete thread', {
        threadId,
        error: errorMessage,
      });
      throw new StorageError(`Failed to delete thread: ${errorMessage}`);
    }
  }

  count(accountId: number | null = null): number {
    try {
      const db = this.getDb();
      let query = 'SELECT COUNT(*) as count FROM threads WHERE 1=1';
      const params: number[] = [];

      if (accountId) {
        query += ' AND account_id = ?';
        params.push(accountId);
      }

      const stmt = db.prepare<unknown[], ThreadCountRow>(query);
      const result = stmt.get(...params);
      return result?.count ?? 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to count threads', { error: errorMessage });
      throw new StorageError(`Failed to count threads: ${errorMessage}`);
    }
  }
}

const threadModel = new ThreadModel();
export default threadModel;
