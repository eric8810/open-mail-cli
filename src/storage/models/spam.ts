import type { SQLiteDatabase } from '../../types/database';

import { StorageError } from '../../utils/errors';
import logger from '../../utils/logger';
import database from '../database';

interface SpamRuleInput {
  ruleType: string;
  pattern: string;
  action: string;
  isEnabled?: boolean;
  priority?: number;
}

interface SpamRuleUpdateInput {
  ruleType?: string;
  pattern?: string;
  action?: string;
  isEnabled?: boolean;
  priority?: number;
}

interface SpamRuleRow {
  id: number;
  rule_type: string;
  pattern: string;
  action: string;
  is_enabled: number;
  priority: number;
  created_at: string;
}

interface EmailListRow {
  id: number;
  email_address: string;
  domain: string | null;
  reason?: string | null;
  created_at: string;
}

interface CountRow {
  count: number;
}

export interface SpamRuleRecord {
  id: number;
  ruleType: string;
  pattern: string;
  action: string;
  isEnabled: boolean;
  priority: number;
  createdAt: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/**
 * Spam model.
 */
export class SpamModel {
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

  createRule(ruleData: SpamRuleInput): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO spam_rules (
          rule_type, pattern, action, is_enabled, priority
        ) VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        ruleData.ruleType,
        ruleData.pattern,
        ruleData.action,
        ruleData.isEnabled !== undefined ? (ruleData.isEnabled ? 1 : 0) : 1,
        ruleData.priority ?? 0
      );

      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Spam rule created', { id: insertId });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to create spam rule', { error: errorMessage });
      throw new StorageError(`Failed to create spam rule: ${errorMessage}`);
    }
  }

  findAllRules(enabledOnly = false): SpamRuleRecord[] {
    try {
      const db = this.getDb();
      let query = 'SELECT * FROM spam_rules';

      if (enabledOnly) {
        query += ' WHERE is_enabled = 1';
      }

      query += ' ORDER BY priority DESC, created_at ASC';

      const stmt = db.prepare<[], SpamRuleRow>(query);
      const rules = stmt.all();
      return rules.map((rule) => this.formatRule(rule));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find spam rules', { error: errorMessage });
      throw new StorageError(`Failed to find spam rules: ${errorMessage}`);
    }
  }

  updateRule(id: number, data: SpamRuleUpdateInput): boolean {
    try {
      const db = this.getDb();
      const fields: string[] = [];
      const params: Array<string | number> = [];

      if (data.ruleType !== undefined) {
        fields.push('rule_type = ?');
        params.push(data.ruleType);
      }

      if (data.pattern !== undefined) {
        fields.push('pattern = ?');
        params.push(data.pattern);
      }

      if (data.action !== undefined) {
        fields.push('action = ?');
        params.push(data.action);
      }

      if (data.isEnabled !== undefined) {
        fields.push('is_enabled = ?');
        params.push(data.isEnabled ? 1 : 0);
      }

      if (data.priority !== undefined) {
        fields.push('priority = ?');
        params.push(data.priority);
      }

      if (fields.length === 0) {
        return false;
      }

      params.push(id);
      const sql = `UPDATE spam_rules SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      logger.debug('Spam rule updated', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to update spam rule', { id, error: errorMessage });
      throw new StorageError(`Failed to update spam rule: ${errorMessage}`);
    }
  }

  deleteRule(id: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM spam_rules WHERE id = ?');
      const result = stmt.run(id);
      logger.debug('Spam rule deleted', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete spam rule', { id, error: errorMessage });
      throw new StorageError(`Failed to delete spam rule: ${errorMessage}`);
    }
  }

  addToBlacklist(emailAddress: string, reason: string | null = null): number {
    try {
      const db = this.getDb();
      const domain = this.extractDomain(emailAddress);

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO blacklist (email_address, domain, reason)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run(emailAddress, domain, reason);
      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Email added to blacklist', { emailAddress });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to add to blacklist', {
        emailAddress,
        error: errorMessage,
      });
      throw new StorageError(`Failed to add to blacklist: ${errorMessage}`);
    }
  }

  removeFromBlacklist(emailAddress: string): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM blacklist WHERE email_address = ?');
      const result = stmt.run(emailAddress);
      logger.debug('Email removed from blacklist', {
        emailAddress,
        changes: result.changes,
      });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to remove from blacklist', {
        emailAddress,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to remove from blacklist: ${errorMessage}`
      );
    }
  }

  isBlacklisted(emailAddress: string): boolean {
    try {
      const db = this.getDb();
      const domain = this.extractDomain(emailAddress);

      const stmt = db.prepare<[string, string | null], CountRow>(`
        SELECT COUNT(*) as count FROM blacklist
        WHERE email_address = ? OR domain = ?
      `);

      const result = stmt.get(emailAddress, domain);
      return (result?.count ?? 0) > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to check blacklist', {
        emailAddress,
        error: errorMessage,
      });
      throw new StorageError(`Failed to check blacklist: ${errorMessage}`);
    }
  }

  getBlacklist(): EmailListRow[] {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[], EmailListRow>(
        'SELECT * FROM blacklist ORDER BY created_at DESC'
      );
      return stmt.all();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to get blacklist', { error: errorMessage });
      throw new StorageError(`Failed to get blacklist: ${errorMessage}`);
    }
  }

  addToWhitelist(emailAddress: string): number {
    try {
      const db = this.getDb();
      const domain = this.extractDomain(emailAddress);

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO whitelist (email_address, domain)
        VALUES (?, ?)
      `);

      const result = stmt.run(emailAddress, domain);
      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Email added to whitelist', { emailAddress });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to add to whitelist', {
        emailAddress,
        error: errorMessage,
      });
      throw new StorageError(`Failed to add to whitelist: ${errorMessage}`);
    }
  }

  removeFromWhitelist(emailAddress: string): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM whitelist WHERE email_address = ?');
      const result = stmt.run(emailAddress);
      logger.debug('Email removed from whitelist', {
        emailAddress,
        changes: result.changes,
      });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to remove from whitelist', {
        emailAddress,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to remove from whitelist: ${errorMessage}`
      );
    }
  }

  isWhitelisted(emailAddress: string): boolean {
    try {
      const db = this.getDb();
      const domain = this.extractDomain(emailAddress);

      const stmt = db.prepare<[string, string | null], CountRow>(`
        SELECT COUNT(*) as count FROM whitelist
        WHERE email_address = ? OR domain = ?
      `);

      const result = stmt.get(emailAddress, domain);
      return (result?.count ?? 0) > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to check whitelist', {
        emailAddress,
        error: errorMessage,
      });
      throw new StorageError(`Failed to check whitelist: ${errorMessage}`);
    }
  }

  getWhitelist(): EmailListRow[] {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[], EmailListRow>(
        'SELECT * FROM whitelist ORDER BY created_at DESC'
      );
      return stmt.all();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to get whitelist', { error: errorMessage });
      throw new StorageError(`Failed to get whitelist: ${errorMessage}`);
    }
  }

  private extractDomain(emailAddress: string): string | null {
    const match = emailAddress.match(/@(.+)$/);
    return match ? match[1] : null;
  }

  private formatRule(rule: SpamRuleRow): SpamRuleRecord {
    return {
      id: rule.id,
      ruleType: rule.rule_type,
      pattern: rule.pattern,
      action: rule.action,
      isEnabled: rule.is_enabled === 1,
      priority: rule.priority,
      createdAt: rule.created_at,
    };
  }
}

const spamModel = new SpamModel();
export default spamModel;
