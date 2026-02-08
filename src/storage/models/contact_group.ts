import type { SQLiteDatabase } from '../../types/database';

import { StorageError } from '../../utils/errors';
import logger from '../../utils/logger';
import database from '../database';

interface ContactGroupInput {
  name: string;
  description?: string | null;
  accountId?: number | null;
}

interface ContactGroupUpdateInput {
  name?: string;
  description?: string | null;
}

interface ContactGroupRow {
  id: number;
  name: string;
  description: string | null;
  account_id: number | null;
  created_at: string;
  updated_at: string;
}

interface ContactRow {
  id: number;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  notes: string | null;
  photo_path: string | null;
  is_favorite: number;
  account_id: number | null;
  created_at: string;
  updated_at: string;
}

interface CountRow {
  count: number;
}

export interface ContactGroupRecord {
  id: number;
  name: string;
  description: string | null;
  accountId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactRecord {
  id: number;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  notes: string | null;
  photoPath: string | null;
  isFavorite: boolean;
  accountId: number | null;
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
 * Contact group model.
 */
export class ContactGroupModel {
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

  create(groupData: ContactGroupInput): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO contact_groups (name, description, account_id)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run(
        groupData.name,
        groupData.description ?? null,
        groupData.accountId ?? null
      );

      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Contact group created', {
        id: insertId,
        name: groupData.name,
      });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to create contact group', { error: errorMessage });
      throw new StorageError(`Failed to create contact group: ${errorMessage}`);
    }
  }

  findAll(accountId: number | null = null): ContactGroupRecord[] {
    try {
      const db = this.getDb();
      let query = 'SELECT * FROM contact_groups WHERE 1=1';
      const params: number[] = [];

      if (accountId !== null) {
        query += ' AND (account_id = ? OR account_id IS NULL)';
        params.push(accountId);
      }

      query += ' ORDER BY name ASC';

      const stmt = db.prepare<unknown[], ContactGroupRow>(query);
      const groups = stmt.all(...params);
      return groups.map((group) => this.formatGroup(group));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find contact groups', { error: errorMessage });
      throw new StorageError(`Failed to find contact groups: ${errorMessage}`);
    }
  }

  findById(id: number): ContactGroupRecord | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], ContactGroupRow>(
        'SELECT * FROM contact_groups WHERE id = ?'
      );
      const group = stmt.get(id);
      return group ? this.formatGroup(group) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find contact group by ID', {
        id,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find contact group: ${errorMessage}`);
    }
  }

  findByName(
    name: string,
    accountId: number | null = null
  ): ContactGroupRecord | null {
    try {
      const db = this.getDb();
      let query = 'SELECT * FROM contact_groups WHERE name = ?';
      const params: Array<string | number> = [name];

      if (accountId !== null) {
        query += ' AND (account_id = ? OR account_id IS NULL)';
        params.push(accountId);
      }

      const stmt = db.prepare<unknown[], ContactGroupRow>(query);
      const group = stmt.get(...params);
      return group ? this.formatGroup(group) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find contact group by name', {
        name,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find contact group: ${errorMessage}`);
    }
  }

  update(id: number, data: ContactGroupUpdateInput): boolean {
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

      if (fields.length === 0) {
        return false;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE contact_groups SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      logger.debug('Contact group updated', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to update contact group', {
        id,
        error: errorMessage,
      });
      throw new StorageError(`Failed to update contact group: ${errorMessage}`);
    }
  }

  delete(id: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM contact_groups WHERE id = ?');
      const result = stmt.run(id);
      logger.debug('Contact group deleted', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete contact group', {
        id,
        error: errorMessage,
      });
      throw new StorageError(`Failed to delete contact group: ${errorMessage}`);
    }
  }

  addContact(groupId: number, contactId: number): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO contact_group_members (group_id, contact_id)
        VALUES (?, ?)
      `);

      const result = stmt.run(groupId, contactId);
      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Contact added to group', { groupId, contactId });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (errorMessage.includes('UNIQUE constraint failed')) {
        throw new StorageError('Contact is already in this group');
      }
      logger.error('Failed to add contact to group', {
        groupId,
        contactId,
        error: errorMessage,
      });
      throw new StorageError(`Failed to add contact to group: ${errorMessage}`);
    }
  }

  removeContact(groupId: number, contactId: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        DELETE FROM contact_group_members
        WHERE group_id = ? AND contact_id = ?
      `);

      const result = stmt.run(groupId, contactId);
      logger.debug('Contact removed from group', {
        groupId,
        contactId,
        changes: result.changes,
      });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to remove contact from group', {
        groupId,
        contactId,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to remove contact from group: ${errorMessage}`
      );
    }
  }

  getContacts(
    groupId: number,
    options: { limit?: number; offset?: number } = {}
  ): ContactRecord[] {
    try {
      const db = this.getDb();
      const { limit = 100, offset = 0 } = options;

      const stmt = db.prepare<[number, number, number], ContactRow>(`
        SELECT c.* FROM contacts c
        INNER JOIN contact_group_members cgm ON c.id = cgm.contact_id
        WHERE cgm.group_id = ?
        ORDER BY c.display_name ASC, c.email ASC
        LIMIT ? OFFSET ?
      `);

      const contacts = stmt.all(groupId, limit, offset);
      return contacts.map((contact) => this.formatContact(contact));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to get contacts in group', {
        groupId,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to get contacts in group: ${errorMessage}`
      );
    }
  }

  getGroupsByContact(contactId: number): ContactGroupRecord[] {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], ContactGroupRow>(`
        SELECT cg.* FROM contact_groups cg
        INNER JOIN contact_group_members cgm ON cg.id = cgm.group_id
        WHERE cgm.contact_id = ?
        ORDER BY cg.name ASC
      `);

      const groups = stmt.all(contactId);
      return groups.map((group) => this.formatGroup(group));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to get groups for contact', {
        contactId,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to get groups for contact: ${errorMessage}`
      );
    }
  }

  countContacts(groupId: number): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], CountRow>(`
        SELECT COUNT(*) as count FROM contact_group_members
        WHERE group_id = ?
      `);

      const result = stmt.get(groupId);
      return result?.count ?? 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to count contacts in group', {
        groupId,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to count contacts in group: ${errorMessage}`
      );
    }
  }

  private formatGroup(group: ContactGroupRow): ContactGroupRecord {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      accountId: group.account_id,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
    };
  }

  private formatContact(contact: ContactRow): ContactRecord {
    return {
      id: contact.id,
      email: contact.email,
      displayName: contact.display_name,
      firstName: contact.first_name,
      lastName: contact.last_name,
      nickname: contact.nickname,
      phone: contact.phone,
      company: contact.company,
      jobTitle: contact.job_title,
      notes: contact.notes,
      photoPath: contact.photo_path,
      isFavorite: contact.is_favorite === 1,
      accountId: contact.account_id,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    };
  }
}

const contactGroupModel = new ContactGroupModel();
export default contactGroupModel;
