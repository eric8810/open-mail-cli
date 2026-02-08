import type { SQLiteDatabase } from '../../types/database';

/**
 * Database initialization migration.
 */
const createEmailsTable = `
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid INTEGER NOT NULL,
  message_id TEXT UNIQUE,
  folder TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  cc_address TEXT,
  subject TEXT,
  date DATETIME,
  body_text TEXT,
  body_html TEXT,
  has_attachments BOOLEAN DEFAULT 0,
  is_read BOOLEAN DEFAULT 0,
  flags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const createAttachmentsTable = `
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  content_type TEXT,
  size INTEGER,
  file_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);
`;

const createFoldersTable = `
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  delimiter TEXT,
  flags TEXT,
  last_sync DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const createIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_emails_uid ON emails(uid);',
  'CREATE INDEX IF NOT EXISTS idx_emails_folder ON emails(folder);',
  'CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date);',
  'CREATE INDEX IF NOT EXISTS idx_emails_from ON emails(from_address);',
  'CREATE INDEX IF NOT EXISTS idx_emails_subject ON emails(subject);',
  'CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);',
];

/**
 * Apply migration.
 */
export function up(db: SQLiteDatabase): void {
  db.exec(createEmailsTable);
  db.exec(createAttachmentsTable);
  db.exec(createFoldersTable);
  createIndexes.forEach((indexSql) => db.exec(indexSql));
}

/**
 * Roll back migration.
 */
export function down(db: SQLiteDatabase): void {
  db.exec('DROP TABLE IF EXISTS attachments;');
  db.exec('DROP TABLE IF EXISTS emails;');
  db.exec('DROP TABLE IF EXISTS folders;');
}
