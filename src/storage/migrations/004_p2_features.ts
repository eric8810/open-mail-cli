import type { SQLiteDatabase } from '../../types/database';

const createTemplatesTable = `
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  variables TEXT,
  account_id INTEGER,
  is_enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
`;

const createNotificationsTable = `
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  message TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME,
  account_id INTEGER,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
`;

const createIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);',
  'CREATE INDEX IF NOT EXISTS idx_templates_account ON templates(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_templates_enabled ON templates(is_enabled);',
  'CREATE INDEX IF NOT EXISTS idx_notifications_email ON notifications(email_id);',
  'CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);',
  'CREATE INDEX IF NOT EXISTS idx_notifications_account ON notifications(account_id);',
  'CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);',
  'CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);',
];

/**
 * Apply migration.
 */
export function up(db: SQLiteDatabase): void {
  db.exec(createTemplatesTable);
  db.exec(createNotificationsTable);
  createIndexes.forEach((indexSql) => db.exec(indexSql));

  const insertDefaultTemplate = db.prepare(`
    INSERT INTO templates (name, subject, body_text, body_html, variables)
    VALUES (?, ?, ?, ?, ?)
  `);

  const defaultTemplates = [
    {
      name: 'Welcome Email',
      subject: 'Welcome to {{company_name}}!',
      bodyText:
        'Hi {{recipient_name}},\n\nWelcome to {{company_name}}! We are excited to have you on board.\n\nBest regards,\n{{sender_name}}',
      bodyHtml:
        '<p>Hi {{recipient_name}},</p><p>Welcome to {{company_name}}! We are excited to have you on board.</p><p>Best regards,<br>{{sender_name}}</p>',
      variables: JSON.stringify([
        'recipient_name',
        'company_name',
        'sender_name',
      ]),
    },
    {
      name: 'Meeting Reminder',
      subject: 'Reminder: Meeting on {{meeting_date}}',
      bodyText:
        'Hi {{recipient_name}},\n\nThis is a reminder about our meeting scheduled for {{meeting_date}} at {{meeting_time}}.\n\nTopic: {{meeting_topic}}\nLocation: {{meeting_location}}\n\nSee you there!\n{{sender_name}}',
      bodyHtml:
        '<p>Hi {{recipient_name}},</p><p>This is a reminder about our meeting scheduled for {{meeting_date}} at {{meeting_time}}.</p><p><strong>Topic:</strong> {{meeting_topic}}<br><strong>Location:</strong> {{meeting_location}}</p><p>See you there!<br>{{sender_name}}</p>',
      variables: JSON.stringify([
        'recipient_name',
        'meeting_date',
        'meeting_time',
        'meeting_topic',
        'meeting_location',
        'sender_name',
      ]),
    },
    {
      name: 'Follow Up',
      subject: 'Following up on {{subject}}',
      bodyText:
        'Hi {{recipient_name}},\n\nI wanted to follow up on {{subject}}. Please let me know if you have any questions or need any additional information.\n\nBest regards,\n{{sender_name}}',
      bodyHtml:
        '<p>Hi {{recipient_name}},</p><p>I wanted to follow up on {{subject}}. Please let me know if you have any questions or need any additional information.</p><p>Best regards,<br>{{sender_name}}</p>',
      variables: JSON.stringify(['recipient_name', 'subject', 'sender_name']),
    },
  ];

  defaultTemplates.forEach((template) => {
    try {
      insertDefaultTemplate.run(
        template.name,
        template.subject,
        template.bodyText,
        template.bodyHtml,
        template.variables
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
  db.exec('DROP TABLE IF EXISTS notifications;');
  db.exec('DROP TABLE IF EXISTS templates;');
}
