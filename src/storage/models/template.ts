import type { SQLiteDatabase } from '../../types/database';

import { StorageError } from '../../utils/errors';
import logger from '../../utils/logger';
import database from '../database';

interface TemplateCreateInput {
  name: string;
  subject: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  variables?: unknown[];
  accountId?: number | null;
  isEnabled?: boolean;
}

interface TemplateUpdateInput {
  name?: string;
  subject?: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  variables?: unknown[] | null;
  accountId?: number | null;
  isEnabled?: boolean;
}

interface TemplateRow {
  id: number;
  name: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  variables: string | null;
  account_id: number | null;
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateRecord {
  id: number;
  name: string;
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  variables: unknown[];
  accountId: number | null;
  isEnabled: boolean;
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
 * Template model.
 */
export class TemplateModel {
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

  create(templateData: TemplateCreateInput): number {
    try {
      const db = this.getDb();

      const stmt = db.prepare(`
        INSERT INTO templates (
          name, subject, body_text, body_html, variables, account_id, is_enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        templateData.name,
        templateData.subject,
        templateData.bodyText ?? null,
        templateData.bodyHtml ?? null,
        templateData.variables ? JSON.stringify(templateData.variables) : null,
        templateData.accountId ?? null,
        templateData.isEnabled !== undefined
          ? templateData.isEnabled
            ? 1
            : 0
          : 1
      );

      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Template created', { id: insertId });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to create template', { error: errorMessage });
      throw new StorageError(`Failed to create template: ${errorMessage}`);
    }
  }

  findById(id: number): TemplateRecord | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], TemplateRow>(
        'SELECT * FROM templates WHERE id = ?'
      );
      const template = stmt.get(id);
      return template ? this.formatTemplate(template) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find template by ID', {
        id,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find template: ${errorMessage}`);
    }
  }

  findAll(accountId: number | null = null): TemplateRecord[] {
    try {
      const db = this.getDb();
      let query = 'SELECT * FROM templates WHERE 1=1';
      const params: number[] = [];

      if (accountId) {
        query += ' AND (account_id = ? OR account_id IS NULL)';
        params.push(accountId);
      }

      query += ' ORDER BY created_at DESC';

      const stmt = db.prepare<unknown[], TemplateRow>(query);
      const templates = stmt.all(...params);
      return templates.map((template) => this.formatTemplate(template));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find templates', { error: errorMessage });
      throw new StorageError(`Failed to find templates: ${errorMessage}`);
    }
  }

  findByName(
    name: string,
    accountId: number | null = null
  ): TemplateRecord | null {
    try {
      const db = this.getDb();
      let query = 'SELECT * FROM templates WHERE name = ?';
      const params: Array<string | number> = [name];

      if (accountId) {
        query += ' AND (account_id = ? OR account_id IS NULL)';
        params.push(accountId);
      }

      query += ' LIMIT 1';

      const stmt = db.prepare<unknown[], TemplateRow>(query);
      const template = stmt.get(...params);
      return template ? this.formatTemplate(template) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find template by name', {
        name,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find template: ${errorMessage}`);
    }
  }

  update(id: number, data: TemplateUpdateInput): boolean {
    try {
      const db = this.getDb();
      const fields: string[] = [];
      const params: Array<string | number | null> = [];

      if (data.name !== undefined) {
        fields.push('name = ?');
        params.push(data.name);
      }

      if (data.subject !== undefined) {
        fields.push('subject = ?');
        params.push(data.subject);
      }

      if (data.bodyText !== undefined) {
        fields.push('body_text = ?');
        params.push(data.bodyText);
      }

      if (data.bodyHtml !== undefined) {
        fields.push('body_html = ?');
        params.push(data.bodyHtml);
      }

      if (data.variables !== undefined) {
        fields.push('variables = ?');
        params.push(data.variables ? JSON.stringify(data.variables) : null);
      }

      if (data.accountId !== undefined) {
        fields.push('account_id = ?');
        params.push(data.accountId);
      }

      if (data.isEnabled !== undefined) {
        fields.push('is_enabled = ?');
        params.push(data.isEnabled ? 1 : 0);
      }

      if (fields.length === 0) {
        return false;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE templates SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      logger.debug('Template updated', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to update template', { id, error: errorMessage });
      throw new StorageError(`Failed to update template: ${errorMessage}`);
    }
  }

  delete(id: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM templates WHERE id = ?');
      const result = stmt.run(id);
      logger.debug('Template deleted', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete template', { id, error: errorMessage });
      throw new StorageError(`Failed to delete template: ${errorMessage}`);
    }
  }

  private formatTemplate(template: TemplateRow): TemplateRecord {
    let variables: unknown[] = [];
    if (template.variables) {
      try {
        const parsed = JSON.parse(template.variables) as unknown;
        variables = Array.isArray(parsed) ? parsed : [];
      } catch {
        variables = [];
      }
    }

    return {
      id: template.id,
      name: template.name,
      subject: template.subject,
      bodyText: template.body_text,
      bodyHtml: template.body_html,
      variables,
      accountId: template.account_id,
      isEnabled: template.is_enabled === 1,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    };
  }
}

const templateModel = new TemplateModel();
export default templateModel;
