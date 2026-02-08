import type { SQLiteDatabase } from '../../types/database';

import { StorageError } from '../../utils/errors';
import logger from '../../utils/logger';
import database from '../database';

interface AttachmentInput {
  emailId: number;
  filename: string;
  contentType?: string | null;
  size?: number | null;
  filePath?: string | null;
}

interface AttachmentRow {
  id: number;
  email_id: number;
  filename: string;
  content_type: string | null;
  size: number | null;
  file_path: string | null;
  created_at: string;
}

export interface AttachmentRecord {
  id: number;
  emailId: number;
  filename: string;
  contentType: string | null;
  size: number | null;
  filePath: string | null;
  createdAt: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * Attachment model.
 */
export class AttachmentModel {
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

  create(attachmentData: AttachmentInput): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO attachments (email_id, filename, content_type, size, file_path)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        attachmentData.emailId,
        attachmentData.filename,
        attachmentData.contentType ?? null,
        attachmentData.size ?? null,
        attachmentData.filePath ?? null
      );

      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Attachment created', { id: insertId });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to create attachment', { error: errorMessage });
      throw new StorageError(`Failed to create attachment: ${errorMessage}`);
    }
  }

  findByEmailId(emailId: number): AttachmentRecord[] {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], AttachmentRow>(
        'SELECT * FROM attachments WHERE email_id = ?'
      );
      const attachments = stmt.all(emailId);
      return attachments.map((attachment) => this.formatAttachment(attachment));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find attachments', {
        emailId,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find attachments: ${errorMessage}`);
    }
  }

  delete(id: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM attachments WHERE id = ?');
      const result = stmt.run(id);
      logger.debug('Attachment deleted', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete attachment', { id, error: errorMessage });
      throw new StorageError(`Failed to delete attachment: ${errorMessage}`);
    }
  }

  private formatAttachment(attachment: AttachmentRow): AttachmentRecord {
    return {
      id: attachment.id,
      emailId: attachment.email_id,
      filename: attachment.filename,
      contentType: attachment.content_type,
      size: attachment.size,
      filePath: attachment.file_path,
      createdAt: attachment.created_at,
    };
  }
}

const attachmentModel = new AttachmentModel();
export default attachmentModel;
