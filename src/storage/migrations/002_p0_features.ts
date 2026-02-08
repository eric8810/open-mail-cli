import type { SQLiteDatabase } from '../../types/database';

/**
 * Extract readable message from unknown errors.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * P0 features migration.
 */
const alterEmailsTable = [
  'ALTER TABLE emails ADD COLUMN is_draft BOOLEAN DEFAULT 0;',
  'ALTER TABLE emails ADD COLUMN is_deleted BOOLEAN DEFAULT 0;',
  'ALTER TABLE emails ADD COLUMN is_spam BOOLEAN DEFAULT 0;',
  'ALTER TABLE emails ADD COLUMN in_reply_to TEXT;',
  'ALTER TABLE emails ADD COLUMN email_references TEXT;',
  'ALTER TABLE emails ADD COLUMN thread_id TEXT;',
  'ALTER TABLE emails ADD COLUMN deleted_at DATETIME;',
];

const createSignaturesTable = `
CREATE TABLE IF NOT EXISTS signatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content_text TEXT,
  content_html TEXT,
  is_default BOOLEAN DEFAULT 0,
  account_email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const createSpamRulesTable = `
CREATE TABLE IF NOT EXISTS spam_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  action TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const createBlacklistTable = `
CREATE TABLE IF NOT EXISTS blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_address TEXT UNIQUE NOT NULL,
  domain TEXT,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const createWhitelistTable = `
CREATE TABLE IF NOT EXISTS whitelist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_address TEXT UNIQUE NOT NULL,
  domain TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const createIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_emails_is_draft ON emails(is_draft);',
  'CREATE INDEX IF NOT EXISTS idx_emails_is_deleted ON emails(is_deleted);',
  'CREATE INDEX IF NOT EXISTS idx_emails_is_spam ON emails(is_spam);',
  'CREATE INDEX IF NOT EXISTS idx_emails_thread_id ON emails(thread_id);',
  'CREATE INDEX IF NOT EXISTS idx_emails_in_reply_to ON emails(in_reply_to);',
  'CREATE INDEX IF NOT EXISTS idx_signatures_account ON signatures(account_email);',
  'CREATE INDEX IF NOT EXISTS idx_signatures_is_default ON signatures(is_default);',
  'CREATE INDEX IF NOT EXISTS idx_spam_rules_type ON spam_rules(rule_type);',
  'CREATE INDEX IF NOT EXISTS idx_spam_rules_enabled ON spam_rules(is_enabled);',
  'CREATE INDEX IF NOT EXISTS idx_blacklist_email ON blacklist(email_address);',
  'CREATE INDEX IF NOT EXISTS idx_blacklist_domain ON blacklist(domain);',
  'CREATE INDEX IF NOT EXISTS idx_whitelist_email ON whitelist(email_address);',
  'CREATE INDEX IF NOT EXISTS idx_whitelist_domain ON whitelist(domain);',
];

/**
 * Apply migration.
 */
export function up(db: SQLiteDatabase): void {
  alterEmailsTable.forEach((sql) => {
    try {
      db.exec(sql);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (!errorMessage.includes('duplicate column name')) {
        throw error;
      }
    }
  });

  db.exec(createSignaturesTable);
  db.exec(createSpamRulesTable);
  db.exec(createBlacklistTable);
  db.exec(createWhitelistTable);

  createIndexes.forEach((indexSql) => db.exec(indexSql));

  const insertDefaultRules = db.prepare(`
    INSERT INTO spam_rules (rule_type, pattern, action, priority)
    VALUES (?, ?, ?, ?)
  `);

  const defaultRules = [
    {
      type: 'keyword',
      pattern: 'viagra|cialis|lottery|winner|prize',
      action: 'mark_spam',
      priority: 10,
    },
    {
      type: 'keyword',
      pattern: 'click here|act now|limited time',
      action: 'mark_spam',
      priority: 5,
    },
    {
      type: 'header',
      pattern: 'X-Spam-Flag: YES',
      action: 'mark_spam',
      priority: 20,
    },
  ];

  defaultRules.forEach((rule) => {
    try {
      insertDefaultRules.run(
        rule.type,
        rule.pattern,
        rule.action,
        rule.priority
      );
    } catch {
      // Ignore duplicate inserts to keep migration idempotent.
    }
  });
}

/**
 * Roll back migration.
 */
export function down(db: SQLiteDatabase): void {
  db.exec('DROP TABLE IF EXISTS whitelist;');
  db.exec('DROP TABLE IF EXISTS blacklist;');
  db.exec('DROP TABLE IF EXISTS spam_rules;');
  db.exec('DROP TABLE IF EXISTS signatures;');
}
