import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

import { type SQLiteDatabase } from '../types/database';
import { StorageError } from '../utils/errors';
import { getDataDir } from '../utils/helpers';
import logger from '../utils/logger';
import { up as up001 } from './migrations/001_initial';
import { up as up002 } from './migrations/002_p0_features';
import { up as up003 } from './migrations/003_p1_features';
import { up as up004 } from './migrations/004_p2_features';

/**
 * Convert unknown error payload to displayable message.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Database Manager.
 * Handles SQLite database connection and migrations.
 */
export class DatabaseManager {
  private dataDir: string;
  private dbPath: string;
  private db: SQLiteDatabase | null;

  /**
   * Create database manager.
   */
  constructor(dbPath: string | null = null) {
    if (dbPath) {
      this.dbPath = dbPath;
      this.dataDir = path.dirname(dbPath);
    } else {
      this.dataDir = getDataDir();
      this.dbPath = path.join(this.dataDir, 'mail.db');
    }
    this.db = null;
  }

  /**
   * Ensure data directory exists.
   */
  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      logger.info('Created data directory', { path: this.dataDir });
    }
  }

  /**
   * Initialize database connection.
   */
  initialize(): SQLiteDatabase {
    try {
      this.ensureDataDir();
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      logger.info('Database initialized', { path: this.dbPath });
      this.runMigrations();
      return this.db;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to initialize database', { error: errorMessage });
      throw new StorageError(`Failed to initialize database: ${errorMessage}`);
    }
  }

  /**
   * Run database migrations.
   */
  runMigrations(): void {
    try {
      if (!this.db) {
        throw new StorageError('Database not initialized');
      }

      up001(this.db);
      up002(this.db);
      up003(this.db);
      up004(this.db);

      logger.info('Database migrations completed');
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to run migrations', { error: errorMessage });
      throw new StorageError(`Failed to run migrations: ${errorMessage}`);
    }
  }

  /**
   * Get database instance.
   */
  getDb(): SQLiteDatabase {
    if (!this.db) {
      return this.initialize();
    }
    return this.db;
  }

  /**
   * Close database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }
}

const databaseManager = new DatabaseManager();
export default databaseManager;
