import type { SQLiteDatabase } from '../../types/database';

import { StorageError } from '../../utils/errors';
import logger from '../../utils/logger';
import database from '../database';

interface FilterInput {
  name: string;
  description?: string | null;
  isEnabled?: boolean;
  priority?: number;
  matchAll?: boolean;
  accountId?: number | null;
}

interface FilterUpdateInput {
  name?: string;
  description?: string | null;
  isEnabled?: boolean;
  priority?: number;
  matchAll?: boolean;
}

interface FilterConditionInput {
  field: string;
  operator: string;
  value: string;
}

interface FilterActionInput {
  type: string;
  value?: string | null;
}

interface FilterFindOptions {
  enabledOnly?: boolean;
  accountId?: number | null;
}

interface FilterRow {
  id: number;
  name: string;
  description: string | null;
  is_enabled: number;
  priority: number;
  match_all: number;
  account_id: number | null;
  created_at: string;
  updated_at: string;
}

interface FilterConditionRow {
  id: number;
  field: string;
  operator: string;
  value: string;
}

interface FilterActionRow {
  id: number;
  action_type: string;
  action_value: string | null;
}

export interface FilterRecord {
  id: number;
  name: string;
  description: string | null;
  isEnabled: boolean;
  priority: number;
  matchAll: boolean;
  accountId: number | null;
  conditions: Array<{
    id: number;
    field: string;
    operator: string;
    value: string;
  }>;
  actions: Array<{
    id: number;
    type: string;
    value: string | null;
  }>;
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
 * Filter model.
 */
export class FilterModel {
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

  create(filterData: FilterInput): number {
    try {
      const db = this.getDb();

      const stmt = db.prepare(`
        INSERT INTO filters (
          name, description, is_enabled, priority, match_all, account_id
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        filterData.name,
        filterData.description ?? null,
        filterData.isEnabled !== undefined ? (filterData.isEnabled ? 1 : 0) : 1,
        filterData.priority ?? 0,
        filterData.matchAll !== undefined ? (filterData.matchAll ? 1 : 0) : 1,
        filterData.accountId ?? null
      );

      const filterId = toNumber(result.lastInsertRowid);
      logger.debug('Filter created', { id: filterId });
      return filterId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to create filter', { error: errorMessage });
      throw new StorageError(`Failed to create filter: ${errorMessage}`);
    }
  }

  addCondition(filterId: number, condition: FilterConditionInput): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO filter_conditions (filter_id, field, operator, value)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        filterId,
        condition.field,
        condition.operator,
        condition.value
      );

      const conditionId = toNumber(result.lastInsertRowid);
      logger.debug('Filter condition added', { filterId, conditionId });
      return conditionId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to add filter condition', {
        filterId,
        error: errorMessage,
      });
      throw new StorageError(`Failed to add filter condition: ${errorMessage}`);
    }
  }

  addAction(filterId: number, action: FilterActionInput): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO filter_actions (filter_id, action_type, action_value)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run(filterId, action.type, action.value ?? null);

      const actionId = toNumber(result.lastInsertRowid);
      logger.debug('Filter action added', { filterId, actionId });
      return actionId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to add filter action', {
        filterId,
        error: errorMessage,
      });
      throw new StorageError(`Failed to add filter action: ${errorMessage}`);
    }
  }

  findById(id: number): FilterRecord | null {
    try {
      const db = this.getDb();

      const filterStmt = db.prepare<[number], FilterRow>(
        'SELECT * FROM filters WHERE id = ?'
      );
      const filter = filterStmt.get(id);

      if (!filter) {
        return null;
      }

      const conditionsStmt = db.prepare<[number], FilterConditionRow>(
        'SELECT * FROM filter_conditions WHERE filter_id = ?'
      );
      const conditions = conditionsStmt.all(id);

      const actionsStmt = db.prepare<[number], FilterActionRow>(
        'SELECT * FROM filter_actions WHERE filter_id = ?'
      );
      const actions = actionsStmt.all(id);

      return this.formatFilter(filter, conditions, actions);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find filter by ID', { id, error: errorMessage });
      throw new StorageError(`Failed to find filter: ${errorMessage}`);
    }
  }

  findAll(options: FilterFindOptions = {}): FilterRecord[] {
    try {
      const db = this.getDb();
      const { enabledOnly = false, accountId = null } = options;

      let query = 'SELECT * FROM filters WHERE 1=1';
      const params: number[] = [];

      if (enabledOnly) {
        query += ' AND is_enabled = 1';
      }

      if (accountId !== null) {
        query += ' AND (account_id = ? OR account_id IS NULL)';
        params.push(accountId);
      }

      query += ' ORDER BY priority DESC, id ASC';

      const stmt = db.prepare<unknown[], FilterRow>(query);
      const filters = stmt.all(...params);

      return filters.map((filter) => {
        const conditionsStmt = db.prepare<[number], FilterConditionRow>(
          'SELECT * FROM filter_conditions WHERE filter_id = ?'
        );
        const conditions = conditionsStmt.all(filter.id);

        const actionsStmt = db.prepare<[number], FilterActionRow>(
          'SELECT * FROM filter_actions WHERE filter_id = ?'
        );
        const actions = actionsStmt.all(filter.id);

        return this.formatFilter(filter, conditions, actions);
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find filters', { error: errorMessage });
      throw new StorageError(`Failed to find filters: ${errorMessage}`);
    }
  }

  update(id: number, data: FilterUpdateInput): boolean {
    try {
      const db = this.getDb();
      const fields: string[] = [];
      const params: Array<string | number | null> = [];

      if (data.name !== undefined) {
        fields.push('name = ?');
        params.push(data.name);
      }

      if (data.description !== undefined) {
        fields.push('description = ?');
        params.push(data.description);
      }

      if (data.isEnabled !== undefined) {
        fields.push('is_enabled = ?');
        params.push(data.isEnabled ? 1 : 0);
      }

      if (data.priority !== undefined) {
        fields.push('priority = ?');
        params.push(data.priority);
      }

      if (data.matchAll !== undefined) {
        fields.push('match_all = ?');
        params.push(data.matchAll ? 1 : 0);
      }

      if (fields.length === 0) {
        return false;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE filters SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      logger.debug('Filter updated', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to update filter', { id, error: errorMessage });
      throw new StorageError(`Failed to update filter: ${errorMessage}`);
    }
  }

  delete(id: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM filters WHERE id = ?');
      const result = stmt.run(id);

      logger.debug('Filter deleted', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete filter', { id, error: errorMessage });
      throw new StorageError(`Failed to delete filter: ${errorMessage}`);
    }
  }

  enable(id: number): boolean {
    return this.update(id, { isEnabled: true });
  }

  disable(id: number): boolean {
    return this.update(id, { isEnabled: false });
  }

  deleteConditions(filterId: number): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(
        'DELETE FROM filter_conditions WHERE filter_id = ?'
      );
      const result = stmt.run(filterId);

      logger.debug('Filter conditions deleted', {
        filterId,
        changes: result.changes,
      });
      return result.changes;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete filter conditions', {
        filterId,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to delete filter conditions: ${errorMessage}`
      );
    }
  }

  deleteActions(filterId: number): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM filter_actions WHERE filter_id = ?');
      const result = stmt.run(filterId);

      logger.debug('Filter actions deleted', {
        filterId,
        changes: result.changes,
      });
      return result.changes;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete filter actions', {
        filterId,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to delete filter actions: ${errorMessage}`
      );
    }
  }

  private formatFilter(
    filter: FilterRow,
    conditions: FilterConditionRow[] = [],
    actions: FilterActionRow[] = []
  ): FilterRecord {
    return {
      id: filter.id,
      name: filter.name,
      description: filter.description,
      isEnabled: filter.is_enabled === 1,
      priority: filter.priority,
      matchAll: filter.match_all === 1,
      accountId: filter.account_id,
      conditions: conditions.map((condition) => ({
        id: condition.id,
        field: condition.field,
        operator: condition.operator,
        value: condition.value,
      })),
      actions: actions.map((action) => ({
        id: action.id,
        type: action.action_type,
        value: action.action_value,
      })),
      createdAt: filter.created_at,
      updatedAt: filter.updated_at,
    };
  }
}

const filterModel = new FilterModel();
export default filterModel;
