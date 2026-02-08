import contactModel from '../storage/models/contact';
import contactGroupModel from '../storage/models/contact_group';
import { parseEmailAddress } from '../utils/email-parser';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Contact Manager
 * High-level contact management operations
 */
class ContactManager {
  /**
   * Add a new contact
   */
  async addContact(contactData) {
    this._validateEmail(contactData.email);

    try {
      const id = contactModel.create(contactData);
      const contact = contactModel.findById(id);
      logger.info('Contact added', { id, email: contactData.email });
      return contact;
    } catch (error) {
      logger.error('Failed to add contact', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all contacts
   */
  async listContacts(accountId = null, options = {}) {
    try {
      return contactModel.findAll(accountId, options);
    } catch (error) {
      logger.error('Failed to list contacts', { error: error.message });
      throw error;
    }
  }

  /**
   * Get contact by ID
   */
  async getContact(id) {
    try {
      const contact = contactModel.findById(id);
      if (!contact) {
        throw new ValidationError(`Contact with ID ${id} not found`);
      }
      return contact;
    } catch (error) {
      logger.error('Failed to get contact', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Update contact
   */
  async updateContact(id, data) {
    if (data.email) {
      this._validateEmail(data.email);
    }

    try {
      const updated = contactModel.update(id, data);
      if (!updated) {
        throw new ValidationError(`Contact with ID ${id} not found`);
      }
      const contact = contactModel.findById(id);
      logger.info('Contact updated', { id });
      return contact;
    } catch (error) {
      logger.error('Failed to update contact', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Delete contact
   */
  async deleteContact(id) {
    try {
      const deleted = contactModel.delete(id);
      if (!deleted) {
        throw new ValidationError(`Contact with ID ${id} not found`);
      }
      logger.info('Contact deleted', { id });
      return true;
    } catch (error) {
      logger.error('Failed to delete contact', { id, error: error.message });
      throw error;
    }
  }

  /**
   * Search contacts
   */
  async searchContacts(keyword, accountId = null, options = {}) {
    try {
      return contactModel.search(keyword, accountId, options);
    } catch (error) {
      logger.error('Failed to search contacts', {
        keyword,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Create contact group
   */
  async createGroup(groupData) {
    try {
      const id = contactGroupModel.create(groupData);
      const group = contactGroupModel.findById(id);
      logger.info('Contact group created', { id, name: groupData.name });
      return group;
    } catch (error) {
      logger.error('Failed to create contact group', { error: error.message });
      throw error;
    }
  }

  /**
   * List all contact groups
   */
  async listGroups(accountId = null) {
    try {
      return contactGroupModel.findAll(accountId);
    } catch (error) {
      logger.error('Failed to list contact groups', { error: error.message });
      throw error;
    }
  }

  /**
   * Add contact to group
   */
  async addContactToGroup(contactId, groupId) {
    try {
      contactGroupModel.addContact(groupId, contactId);
      logger.info('Contact added to group', { contactId, groupId });
      return true;
    } catch (error) {
      logger.error('Failed to add contact to group', {
        contactId,
        groupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Remove contact from group
   */
  async removeContactFromGroup(contactId, groupId) {
    try {
      const removed = contactGroupModel.removeContact(groupId, contactId);
      if (!removed) {
        throw new ValidationError('Contact not found in group');
      }
      logger.info('Contact removed from group', { contactId, groupId });
      return true;
    } catch (error) {
      logger.error('Failed to remove contact from group', {
        contactId,
        groupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get contacts in a group
   */
  async getGroupContacts(groupId, options = {}) {
    try {
      return contactGroupModel.getContacts(groupId, options);
    } catch (error) {
      logger.error('Failed to get group contacts', {
        groupId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Auto-collect contact from email address
   */
  async autoCollectContact(emailAddress, accountId = null) {
    try {
      const parsed = parseEmailAddress(emailAddress);
      if (!parsed || !parsed.address) {
        return null;
      }

      const result = contactModel.findOrCreate(parsed.address, {
        displayName: parsed.name || null,
        accountId,
      });

      if (result.created) {
        logger.info('Contact auto-collected', { email: parsed.address });
      }

      return result.contact;
    } catch (error) {
      logger.error('Failed to auto-collect contact', {
        emailAddress,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Get contact suggestions for email composition
   */
  async getSuggestions(query, accountId = null, limit = 10) {
    try {
      if (!query || query.length < 2) {
        return [];
      }

      const contacts = await this.searchContacts(query, accountId, { limit });
      return contacts.map((contact) => ({
        email: contact.email,
        name: contact.displayName || contact.email,
        company: contact.company,
      }));
    } catch (error) {
      logger.error('Failed to get contact suggestions', {
        query,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Import contacts from CSV
   */
  async importFromCSV(csvData) {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      throw new ValidationError(
        'CSV file must contain header and at least one contact'
      );
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const imported = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(',').map((v) => v.trim());
        const contactData = {};

        header.forEach((field, index) => {
          const value = values[index];
          if (!value) return;

          switch (field) {
            case 'email':
              contactData.email = value;
              break;
            case 'name':
            case 'display_name':
              contactData.displayName = value;
              break;
            case 'first_name':
              contactData.firstName = value;
              break;
            case 'last_name':
              contactData.lastName = value;
              break;
            case 'phone':
              contactData.phone = value;
              break;
            case 'company':
              contactData.company = value;
              break;
            case 'job_title':
            case 'title':
              contactData.jobTitle = value;
              break;
            case 'notes':
              contactData.notes = value;
              break;
          }
        });

        if (!contactData.email) {
          errors.push({ line: i + 1, error: 'Missing email address' });
          continue;
        }

        const result = contactModel.findOrCreate(
          contactData.email,
          contactData
        );
        imported.push(result.contact);
      } catch (error) {
        errors.push({ line: i + 1, error: error.message });
      }
    }

    logger.info('Contacts imported from CSV', {
      imported: imported.length,
      errors: errors.length,
    });
    return { imported, errors };
  }

  /**
   * Export contacts to CSV
   */
  async exportToCSV(accountId = null) {
    try {
      const contacts = await this.listContacts(accountId, { limit: 10000 });

      const header =
        'email,display_name,first_name,last_name,phone,company,job_title,notes';
      const rows = contacts.map((contact) => {
        return [
          contact.email,
          contact.displayName || '',
          contact.firstName || '',
          contact.lastName || '',
          contact.phone || '',
          contact.company || '',
          contact.jobTitle || '',
          contact.notes || '',
        ]
          .map((field) => `"${field.replace(/"/g, '""')}"`)
          .join(',');
      });

      return [header, ...rows].join('\n');
    } catch (error) {
      logger.error('Failed to export contacts to CSV', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate email address
   */
  _validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError(`Invalid email address: ${email}`);
    }
  }
}

module.exports = new ContactManager();
