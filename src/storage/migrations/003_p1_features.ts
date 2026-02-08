import type { SQLiteDatabase } from '../../types/database';

/**
 * Extract readable message from unknown errors.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const createTagsTable = `
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#808080',
  description TEXT,
  account_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
`;

const createEmailTagsTable = `
CREATE TABLE IF NOT EXISTS email_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE(email_id, tag_id)
);
`;

const createFiltersTable = `
CREATE TABLE IF NOT EXISTS filters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT 1,
  priority INTEGER DEFAULT 0,
  match_all BOOLEAN DEFAULT 1,
  account_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
`;

const createFilterConditionsTable = `
CREATE TABLE IF NOT EXISTS filter_conditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filter_id INTEGER NOT NULL,
  field TEXT NOT NULL,
  operator TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (filter_id) REFERENCES filters(id) ON DELETE CASCADE
);
`;

const createFilterActionsTable = `
CREATE TABLE IF NOT EXISTS filter_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filter_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  action_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (filter_id) REFERENCES filters(id) ON DELETE CASCADE
);
`;

const createContactsTable = `
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  nickname TEXT,
  phone TEXT,
  company TEXT,
  job_title TEXT,
  notes TEXT,
  photo_path TEXT,
  is_favorite BOOLEAN DEFAULT 0,
  account_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
`;

const createContactGroupsTable = `
CREATE TABLE IF NOT EXISTS contact_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  account_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
`;

const createContactGroupMembersTable = `
CREATE TABLE IF NOT EXISTS contact_group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES contact_groups(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  UNIQUE(group_id, contact_id)
);
`;

const createAccountsTable = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL,
  imap_secure BOOLEAN DEFAULT 1,
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL,
  smtp_secure BOOLEAN DEFAULT 1,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  is_default BOOLEAN DEFAULT 0,
  is_enabled BOOLEAN DEFAULT 1,
  sync_interval INTEGER DEFAULT 300,
  last_sync DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

const createThreadsTable = `
CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT UNIQUE NOT NULL,
  subject TEXT,
  first_message_date DATETIME,
  last_message_date DATETIME,
  message_count INTEGER DEFAULT 0,
  account_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
`;

const createSavedSearchesTable = `
CREATE TABLE IF NOT EXISTS saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  query TEXT NOT NULL,
  description TEXT,
  account_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
`;

const alterEmailsTable = [
  'ALTER TABLE emails ADD COLUMN account_id INTEGER;',
  'ALTER TABLE emails ADD COLUMN is_starred BOOLEAN DEFAULT 0;',
  'ALTER TABLE emails ADD COLUMN is_important BOOLEAN DEFAULT 0;',
  'ALTER TABLE emails ADD COLUMN priority INTEGER DEFAULT 0;',
];

const alterFoldersTable = [
  'ALTER TABLE folders ADD COLUMN account_id INTEGER;',
  'ALTER TABLE folders ADD COLUMN parent_id INTEGER;',
  'ALTER TABLE folders ADD COLUMN is_favorite BOOLEAN DEFAULT 0;',
  'ALTER TABLE folders ADD COLUMN sort_order INTEGER DEFAULT 0;',
  'ALTER TABLE folders ADD COLUMN unread_count INTEGER DEFAULT 0;',
  'ALTER TABLE folders ADD COLUMN total_count INTEGER DEFAULT 0;',
];

const createIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);',
  'CREATE INDEX IF NOT EXISTS idx_tags_account ON tags(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_email_tags_email ON email_tags(email_id);',
  'CREATE INDEX IF NOT EXISTS idx_email_tags_tag ON email_tags(tag_id);',
  'CREATE INDEX IF NOT EXISTS idx_filters_enabled ON filters(is_enabled);',
  'CREATE INDEX IF NOT EXISTS idx_filters_priority ON filters(priority);',
  'CREATE INDEX IF NOT EXISTS idx_filters_account ON filters(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_filter_conditions_filter ON filter_conditions(filter_id);',
  'CREATE INDEX IF NOT EXISTS idx_filter_actions_filter ON filter_actions(filter_id);',
  'CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);',
  'CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(display_name);',
  'CREATE INDEX IF NOT EXISTS idx_contacts_favorite ON contacts(is_favorite);',
  'CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_contact_groups_account ON contact_groups(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_contact_group_members_group ON contact_group_members(group_id);',
  'CREATE INDEX IF NOT EXISTS idx_contact_group_members_contact ON contact_group_members(contact_id);',
  'CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);',
  'CREATE INDEX IF NOT EXISTS idx_accounts_is_default ON accounts(is_default);',
  'CREATE INDEX IF NOT EXISTS idx_accounts_is_enabled ON accounts(is_enabled);',
  'CREATE INDEX IF NOT EXISTS idx_threads_thread_id ON threads(thread_id);',
  'CREATE INDEX IF NOT EXISTS idx_threads_account ON threads(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_threads_last_message ON threads(last_message_date);',
  'CREATE INDEX IF NOT EXISTS idx_saved_searches_name ON saved_searches(name);',
  'CREATE INDEX IF NOT EXISTS idx_saved_searches_account ON saved_searches(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_emails_is_starred ON emails(is_starred);',
  'CREATE INDEX IF NOT EXISTS idx_emails_is_important ON emails(is_important);',
  'CREATE INDEX IF NOT EXISTS idx_emails_priority ON emails(priority);',
  'CREATE INDEX IF NOT EXISTS idx_folders_account ON folders(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);',
  'CREATE INDEX IF NOT EXISTS idx_folders_favorite ON folders(is_favorite);',
  'CREATE INDEX IF NOT EXISTS idx_folders_sort_order ON folders(sort_order);',
];

/**
 * Apply migration.
 */
export function up(db: SQLiteDatabase): void {
  db.exec(createAccountsTable);
  db.exec(createTagsTable);
  db.exec(createEmailTagsTable);
  db.exec(createFiltersTable);
  db.exec(createFilterConditionsTable);
  db.exec(createFilterActionsTable);
  db.exec(createContactsTable);
  db.exec(createContactGroupsTable);
  db.exec(createContactGroupMembersTable);
  db.exec(createThreadsTable);
  db.exec(createSavedSearchesTable);

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

  alterFoldersTable.forEach((sql) => {
    try {
      db.exec(sql);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (!errorMessage.includes('duplicate column name')) {
        throw error;
      }
    }
  });

  createIndexes.forEach((indexSql) => db.exec(indexSql));

  const insertDefaultTags = db.prepare(`
    INSERT INTO tags (name, color, description)
    VALUES (?, ?, ?)
  `);

  const defaultTags = [
    { name: 'Important', color: '#FF0000', description: 'Important emails' },
    { name: 'Work', color: '#0000FF', description: 'Work-related emails' },
    { name: 'Personal', color: '#00FF00', description: 'Personal emails' },
    {
      name: 'Follow Up',
      color: '#FFA500',
      description: 'Emails requiring follow-up',
    },
    { name: 'To Read', color: '#800080', description: 'Emails to read later' },
  ];

  defaultTags.forEach((tag) => {
    try {
      insertDefaultTags.run(tag.name, tag.color, tag.description);
    } catch {
      // Ignore duplicate inserts to keep migration idempotent.
    }
  });
}

/**
 * Roll back migration.
 */
export function down(db: SQLiteDatabase): void {
  db.exec('DROP TABLE IF EXISTS contact_group_members;');
  db.exec('DROP TABLE IF EXISTS contact_groups;');
  db.exec('DROP TABLE IF EXISTS contacts;');
  db.exec('DROP TABLE IF EXISTS filter_actions;');
  db.exec('DROP TABLE IF EXISTS filter_conditions;');
  db.exec('DROP TABLE IF EXISTS filters;');
  db.exec('DROP TABLE IF EXISTS email_tags;');
  db.exec('DROP TABLE IF EXISTS tags;');
  db.exec('DROP TABLE IF EXISTS threads;');
  db.exec('DROP TABLE IF EXISTS saved_searches;');
  db.exec('DROP TABLE IF EXISTS accounts;');
}
