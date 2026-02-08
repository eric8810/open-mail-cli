import type { SQLiteDatabase } from '../../types/database';

import { StorageError } from '../../utils/errors';
import logger from '../../utils/logger';
import database from '../database';

interface ContactInput {
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  nickname?: string | null;
  phone?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  notes?: string | null;
  photoPath?: string | null;
  isFavorite?: boolean;
  accountId?: number | null;
}

type ContactUpdateInput = Partial<ContactInput>;

interface ContactFindOptions {
  limit?: number;
  offset?: number;
  favoriteOnly?: boolean;
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
 * Contact model.
 */
export class ContactModel {
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

  create(contactData: ContactInput): number {
    try {
      const db = this.getDb();
      const stmt = db.prepare(`
        INSERT INTO contacts (
          email, display_name, first_name, last_name, nickname,
          phone, company, job_title, notes, photo_path,
          is_favorite, account_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        contactData.email,
        contactData.displayName ?? null,
        contactData.firstName ?? null,
        contactData.lastName ?? null,
        contactData.nickname ?? null,
        contactData.phone ?? null,
        contactData.company ?? null,
        contactData.jobTitle ?? null,
        contactData.notes ?? null,
        contactData.photoPath ?? null,
        contactData.isFavorite ? 1 : 0,
        contactData.accountId ?? null
      );

      const insertId = toNumber(result.lastInsertRowid);
      logger.debug('Contact created', {
        id: insertId,
        email: contactData.email,
      });
      return insertId;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (errorMessage.includes('UNIQUE constraint failed')) {
        throw new StorageError(
          `Contact with email "${contactData.email}" already exists`
        );
      }
      logger.error('Failed to create contact', { error: errorMessage });
      throw new StorageError(`Failed to create contact: ${errorMessage}`);
    }
  }

  findAll(
    accountId: number | null = null,
    options: ContactFindOptions = {}
  ): ContactRecord[] {
    try {
      const db = this.getDb();
      const { limit = 100, offset = 0, favoriteOnly = false } = options;

      let query = 'SELECT * FROM contacts WHERE 1=1';
      const params: number[] = [];

      if (accountId !== null) {
        query += ' AND (account_id = ? OR account_id IS NULL)';
        params.push(accountId);
      }

      if (favoriteOnly) {
        query += ' AND is_favorite = 1';
      }

      query += ' ORDER BY display_name ASC, email ASC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = db.prepare<unknown[], ContactRow>(query);
      const contacts = stmt.all(...params);
      return contacts.map((contact) => this.formatContact(contact));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find contacts', { error: errorMessage });
      throw new StorageError(`Failed to find contacts: ${errorMessage}`);
    }
  }

  findById(id: number): ContactRecord | null {
    try {
      const db = this.getDb();
      const stmt = db.prepare<[number], ContactRow>(
        'SELECT * FROM contacts WHERE id = ?'
      );
      const contact = stmt.get(id);
      return contact ? this.formatContact(contact) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find contact by ID', { id, error: errorMessage });
      throw new StorageError(`Failed to find contact: ${errorMessage}`);
    }
  }

  findByEmail(
    email: string,
    accountId: number | null = null
  ): ContactRecord | null {
    try {
      const db = this.getDb();
      let query = 'SELECT * FROM contacts WHERE email = ?';
      const params: Array<string | number> = [email];

      if (accountId !== null) {
        query += ' AND (account_id = ? OR account_id IS NULL)';
        params.push(accountId);
      }

      const stmt = db.prepare<unknown[], ContactRow>(query);
      const contact = stmt.get(...params);
      return contact ? this.formatContact(contact) : null;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find contact by email', {
        email,
        error: errorMessage,
      });
      throw new StorageError(`Failed to find contact: ${errorMessage}`);
    }
  }

  search(
    keyword: string,
    accountId: number | null = null,
    options: ContactFindOptions = {}
  ): ContactRecord[] {
    try {
      const db = this.getDb();
      const { limit = 50, offset = 0 } = options;
      const searchTerm = `%${keyword}%`;

      let query = `
        SELECT * FROM contacts
        WHERE (
          email LIKE ? OR
          display_name LIKE ? OR
          first_name LIKE ? OR
          last_name LIKE ? OR
          company LIKE ? OR
          notes LIKE ?
        )
      `;
      const params: Array<string | number> = [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
      ];

      if (accountId !== null) {
        query += ' AND (account_id = ? OR account_id IS NULL)';
        params.push(accountId);
      }

      query += ' ORDER BY display_name ASC, email ASC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = db.prepare<unknown[], ContactRow>(query);
      const contacts = stmt.all(...params);
      return contacts.map((contact) => this.formatContact(contact));
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to search contacts', {
        keyword,
        error: errorMessage,
      });
      throw new StorageError(`Failed to search contacts: ${errorMessage}`);
    }
  }

  update(id: number, data: ContactUpdateInput): boolean {
    try {
      const db = this.getDb();
      const fields: string[] = [];
      const params: Array<string | number | null> = [];

      const fieldMap: Record<keyof ContactUpdateInput, string> = {
        email: 'email',
        displayName: 'display_name',
        firstName: 'first_name',
        lastName: 'last_name',
        nickname: 'nickname',
        phone: 'phone',
        company: 'company',
        jobTitle: 'job_title',
        notes: 'notes',
        photoPath: 'photo_path',
        isFavorite: 'is_favorite',
        accountId: 'account_id',
      };

      (Object.keys(fieldMap) as Array<keyof ContactUpdateInput>).forEach(
        (key) => {
          const value = data[key];
          if (value !== undefined) {
            fields.push(`${fieldMap[key]} = ?`);
            params.push(
              key === 'isFavorite'
                ? value
                  ? 1
                  : 0
                : (value as string | number | null)
            );
          }
        }
      );

      if (fields.length === 0) {
        return false;
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const sql = `UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      const result = stmt.run(...params);

      logger.debug('Contact updated', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (errorMessage.includes('UNIQUE constraint failed')) {
        throw new StorageError('Contact email already exists');
      }
      logger.error('Failed to update contact', { id, error: errorMessage });
      throw new StorageError(`Failed to update contact: ${errorMessage}`);
    }
  }

  delete(id: number): boolean {
    try {
      const db = this.getDb();
      const stmt = db.prepare('DELETE FROM contacts WHERE id = ?');
      const result = stmt.run(id);
      logger.debug('Contact deleted', { id, changes: result.changes });
      return result.changes > 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to delete contact', { id, error: errorMessage });
      throw new StorageError(`Failed to delete contact: ${errorMessage}`);
    }
  }

  count(accountId: number | null = null): number {
    try {
      const db = this.getDb();
      let query = 'SELECT COUNT(*) as count FROM contacts WHERE 1=1';
      const params: number[] = [];

      if (accountId !== null) {
        query += ' AND (account_id = ? OR account_id IS NULL)';
        params.push(accountId);
      }

      const stmt = db.prepare<unknown[], CountRow>(query);
      const result = stmt.get(...params);
      return result?.count ?? 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to count contacts', { error: errorMessage });
      throw new StorageError(`Failed to count contacts: ${errorMessage}`);
    }
  }

  findOrCreate(
    email: string,
    data: Omit<ContactInput, 'email'> = {}
  ): { contact: ContactRecord | null; created: boolean } {
    try {
      const existing = this.findByEmail(email, data.accountId ?? null);
      if (existing) {
        return { contact: existing, created: false };
      }

      const contactData: ContactInput = {
        email,
        ...data,
      };

      const id = this.create(contactData);
      const contact = this.findById(id);
      return { contact, created: true };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to find or create contact', {
        email,
        error: errorMessage,
      });
      throw new StorageError(
        `Failed to find or create contact: ${errorMessage}`
      );
    }
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

const contactModel = new ContactModel();
export default contactModel;
