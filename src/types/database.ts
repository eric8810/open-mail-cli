import type Database from 'better-sqlite3';

/**
 * SQLite database instance type from better-sqlite3.
 */
export type SQLiteDatabase = Database.Database;

/**
 * Migration contract for schema evolution.
 */
export interface Migration {
  up(db: SQLiteDatabase): void;
  down(db: SQLiteDatabase): void;
}
