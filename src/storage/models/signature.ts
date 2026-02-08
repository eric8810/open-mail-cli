import type { SQLiteDatabase } from '../../types/database';

import { StorageError } from '../../utils/errors';
import logger from '../../utils/logger';
import database from '../database';

interface SignatureCreateInput {
  name: string;
  contentText?: string | null;
  contentHtml?: string | null;
  isDefault?: boolean;
  accountEmail?: string | null;
}

interface SignatureUpdateInput {
  name?: string;
  contentText?: string | null;
  contentHtml?: string | null;
  isDefault?: boolean;
  accountEmail?: string | null;
}

interface SignatureRow {
  id: number;
  name: string;
  content_text: string | null;
  content_html: string | null;
  is_default: number;
  account_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface SignatureRecord {
  id: number;
  name: string;
  contentText: string | null;
  contentHtml: string | null;
  isDefault: boolean;
  accountEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * Signature model.
 */
export class SignatureModel {
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

  create(signatureData: SignatureCreateInput): number {
    try {
      const db = this.getDb();

      if (signatureData.isDefault && signatureData.accountEmail) {
        this.unsetDefaultForAccount(signatureData.accountEmail);
      }

      const stmt = db.prepare(`
        INSERT INTO signatures (
          name, content_text, content_html, is_default, account_email
        ) VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        signatureData.name,
        signatureData.contentText ?? null,
        signatureData.contentHtml ?? null,
        signatureData.isDefault ? 1 : 0,
        signatureData.accountEmail ?? null
      );

      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Signature created', { id: insertId });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to create signature', { error: errorMessage });
      throw new StorageError(`Failed to create signature: ${errorMessage}`);
    }
  }

  findById(id: number): SignatureRecord | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], SignatureRow>(
        'SELECT * FROM signatures WHERE id = ?'
      );
      const signature = stmt.get(id);
      return signature ? this.formatSignature(signature) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find signature by ID', {
        id,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find signature: ${errorMessage}`);
    }
  }

  findAll(accountEmail: string | null = null): SignatureRecord[] {
    try {
      const db = this.getDb();
      let query = 'SELECT * FROM signatures';
      const params: string[] = [];

      if (accountEmail) {
        query += ' WHERE account_email = ? OR account_email IS NULL';
        params.push(accountEmail);
      }

      query += ' ORDER BY is_default DESC, created_at DESC';

      const stmt = db.prepare<unknown[], SignatureRow>(query);
      const signatures = stmt.all(...params);
      return signatures.map((signature) => this.formatSignature(signature));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find signatures', { error: errorMessage });
      throw new StorageError(`Failed to find signatures: ${errorMessage}`);
    }
  }

  findDefault(accountEmail: string | null = null): SignatureRecord | null {
    try {
      const db = this.getDb();
      let query = 'SELECT * FROM signatures WHERE is_default = 1';
      const params: string[] = [];

      if (accountEmail) {
        query += ' AND (account_email = ? OR account_email IS NULL)';
        params.push(accountEmail);
      }

      query += ' ORDER BY account_email DESC LIMIT 1';

      const stmt = db.prepare<unknown[], SignatureRow>(query);
      const signature = stmt.get(...params);
      return signature ? this.formatSignature(signature) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find default signature', { error: errorMessage });
      throw new StorageError(
        `Failed to find default signature: ${errorMessage}`
      );
    }
  }

  update(id: number, data: SignatureUpdateInput): boolean {
    try {
      const db = this.getDb();
      const fields: string[] = [];
      const params: Array<string | number | null> = [];

      if (data.name !== undefined) {
        fields.push('name = ?');
        params.push(data.name);
      }

      if (data.contentText !== undefined) {
        fields.push('content_text = ?');
        params.push(data.contentText);
      }

      if (data.contentHtml !== undefined) {
        fields.push('content_html = ?');
        params.push(data.contentHtml);
      }

      if (data.isDefault !== undefined) {
        fields.push('is_default = ?');
        params.push(data.isDefault ? 1 : 0);

        if (data.isDefault) {
          const signature = this.findById(id);
          if (signature?.accountEmail) {
            this.unsetDefaultForAccount(signature.accountEmail, id);
          }
        }
      }

      if (data.accountEmail !== undefined) {
        fields.push('account_email = ?');
        params.push(data.accountEmail);
      }

      if (fields.length === 0) {
        return false;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE signatures SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      logger.debug('Signature updated', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to update signature', { id, error: errorMessage });
      throw new StorageError(`Failed to update signature: ${errorMessage}`);
    }
  }

  setAsDefault(id: number): boolean {
    const signature = this.findById(id);
    if (!signature) {
      throw new StorageError('Signature not found');
    }

    if (signature.accountEmail) {
      this.unsetDefaultForAccount(signature.accountEmail, id);
    }

    return this.update(id, { isDefault: true });
  }

  unsetDefaultForAccount(
    accountEmail: string,
    exceptId: number | null = null
  ): void {
    try {
      const db = this.getDb();
      let query =
        'UPDATE signatures SET is_default = 0 WHERE account_email = ?';
      const params: Array<string | number> = [accountEmail];

      if (exceptId) {
        query += ' AND id != ?';
        params.push(exceptId);
      }

      const stmt = db.prepare(query);
      stmt.run(...params);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to unset default signatures', {
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to unset default signatures: ${errorMessage}`
      );
    }
  }

  delete(id: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM signatures WHERE id = ?');
      const result = stmt.run(id);
      logger.debug('Signature deleted', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete signature', { id, error: errorMessage });
      throw new StorageError(`Failed to delete signature: ${errorMessage}`);
    }
  }

  private formatSignature(signature: SignatureRow): SignatureRecord {
    return {
      id: signature.id,
      name: signature.name,
      contentText: signature.content_text,
      contentHtml: signature.content_html,
      isDefault: signature.is_default === 1,
      accountEmail: signature.account_email,
      createdAt: signature.created_at,
      updatedAt: signature.updated_at,
    };
  }
}

const signatureModel = new SignatureModel();
export default signatureModel;
