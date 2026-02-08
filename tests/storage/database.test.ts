import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DatabaseManager } from '../../src/storage/database.ts';

describe('database manager', () => {
  let tempDir = '';
  let dbPath = '';
  let manager: DatabaseManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-cli-db-'));
    dbPath = path.join(tempDir, 'mail.db');
    manager = new DatabaseManager(dbPath);
  });

  afterEach(() => {
    manager.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('initializes database and runs all migrations', () => {
    const db = manager.initialize();
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>;
    const tableNames = rows.map((row) => row.name);

    expect(tableNames).toContain('emails');
    expect(tableNames).toContain('attachments');
    expect(tableNames).toContain('accounts');
    expect(tableNames).toContain('templates');
    expect(tableNames).toContain('notifications');
    expect(fs.existsSync(dbPath)).toBe(true);
  });
});
