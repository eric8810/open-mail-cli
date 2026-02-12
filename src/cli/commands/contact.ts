import fs from 'fs';
import path from 'path';

import chalk from 'chalk';

import contactManager from '../../contacts/manager';
import contactGroupModel from '../../storage/models/contact_group';
import { ValidationError } from '../../utils/errors';
import { handleCommandError } from '../utils/error-handler';

/**
 * Contact command - Manage contacts
 */
function contactCommand(action, args, options) {
  try {
    switch (action) {
      case 'add':
        return addContact(args, options);
      case 'list':
        return listContacts(args, options);
      case 'show':
        return showContact(args, options);
      case 'edit':
        return editContact(args, options);
      case 'delete':
        return deleteContact(args, options);
      case 'search':
        return searchContacts(args, options);
      case 'group':
        return groupCommand(args, options);
      case 'import':
        return importContacts(args, options);
      case 'export':
        return exportContacts(args, options);
      default:
        throw new ValidationError(
          `Unknown action: ${action}. Available actions: add, list, show, edit, delete, search, group, import, export`
        );
    }
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Add a new contact
 */
async function addContact(args, options) {
  if (!options.email) {
    throw new ValidationError(
      'Email address is required. Usage: contact add --email <email> [--name <name>] [--phone <phone>] [--company <company>]'
    );
  }

  const contactData = {
    email: options.email,
    displayName: options.name || null,
    phone: options.phone || null,
    company: options.company || null,
    jobTitle: options.title || null,
    notes: options.notes || null,
  };

  const contact = await contactManager.addContact(contactData);

  console.log(chalk.green('✓'), 'Contact added successfully');
  console.log(chalk.gray(`  ID: ${contact.id}`));
  console.log(chalk.gray(`  Email: ${contact.email}`));
  if (contact.displayName) {
    console.log(chalk.gray(`  Name: ${contact.displayName}`));
  }
  if (contact.phone) {
    console.log(chalk.gray(`  Phone: ${contact.phone}`));
  }
  if (contact.company) {
    console.log(chalk.gray(`  Company: ${contact.company}`));
  }
}

/**
 * List all contacts
 */
async function listContacts(args, options) {
  const groupName = options.group;
  let contacts;

  if (groupName) {
    const group = contactGroupModel.findByName(groupName);
    if (!group) {
      throw new ValidationError(`Group "${groupName}" not found`);
    }
    contacts = contactGroupModel.getContacts(group.id);
    console.log(chalk.bold.cyan(`Contacts in group "${group.name}":`));
  } else {
    contacts = await contactManager.listContacts(null, {
      limit: options.limit || 100,
      favoriteOnly: options.favorites || false,
    });
    console.log(chalk.bold.cyan('All Contacts:'));
  }

  if (contacts.length === 0) {
    console.log(chalk.yellow('No contacts found.'));
    return;
  }

  console.log();
  contacts.forEach((contact) => {
    const favorite = contact.isFavorite ? chalk.yellow('★ ') : '  ';
    console.log(
      `${favorite}${chalk.bold(contact.displayName || contact.email)}`
    );
    console.log(chalk.gray(`  ID: ${contact.id} | Email: ${contact.email}`));
    if (contact.phone) {
      console.log(chalk.gray(`  Phone: ${contact.phone}`));
    }
    if (contact.company) {
      console.log(chalk.gray(`  Company: ${contact.company}`));
    }
    console.log();
  });

  console.log(chalk.gray(`Total: ${contacts.length} contacts`));
}

/**
 * Show contact details
 */
async function showContact(args, options) {
  if (!args || args.length === 0) {
    throw new ValidationError(
      'Contact ID is required. Usage: contact show <id>'
    );
  }

  const contactId = parseInt(args[0]);
  const contact = await contactManager.getContact(contactId);

  console.log(chalk.bold.cyan('Contact Details:'));
  console.log();
  console.log(chalk.bold('  ID:'), contact.id);
  console.log(chalk.bold('  Email:'), contact.email);
  if (contact.displayName) {
    console.log(chalk.bold('  Name:'), contact.displayName);
  }
  if (contact.firstName) {
    console.log(chalk.bold('  First Name:'), contact.firstName);
  }
  if (contact.lastName) {
    console.log(chalk.bold('  Last Name:'), contact.lastName);
  }
  if (contact.phone) {
    console.log(chalk.bold('  Phone:'), contact.phone);
  }
  if (contact.company) {
    console.log(chalk.bold('  Company:'), contact.company);
  }
  if (contact.jobTitle) {
    console.log(chalk.bold('  Job Title:'), contact.jobTitle);
  }
  if (contact.notes) {
    console.log(chalk.bold('  Notes:'), contact.notes);
  }
  console.log(chalk.bold('  Favorite:'), contact.isFavorite ? 'Yes' : 'No');
  console.log(chalk.gray(`  Created: ${contact.createdAt}`));
  console.log(chalk.gray(`  Updated: ${contact.updatedAt}`));

  const groups = contactGroupModel.getGroupsByContact(contactId);
  if (groups.length > 0) {
    console.log();
    console.log(chalk.bold('  Groups:'));
    groups.forEach((group) => {
      console.log(chalk.gray(`    - ${group.name}`));
    });
  }
}

/**
 * Edit contact
 */
async function editContact(args, options) {
  if (!args || args.length === 0) {
    throw new ValidationError(
      'Contact ID is required. Usage: contact edit <id> [--name <name>] [--email <email>] [--phone <phone>] [--company <company>]'
    );
  }

  const contactId = parseInt(args[0]);
  const updateData = {};

  if (options.name !== undefined) updateData.displayName = options.name;
  if (options.email !== undefined) updateData.email = options.email;
  if (options.phone !== undefined) updateData.phone = options.phone;
  if (options.company !== undefined) updateData.company = options.company;
  if (options.title !== undefined) updateData.jobTitle = options.title;
  if (options.notes !== undefined) updateData.notes = options.notes;
  if (options.favorite !== undefined)
    updateData.isFavorite = options.favorite === 'true';

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError(
      'No fields to update. Usage: contact edit <id> [--name <name>] [--email <email>] [--phone <phone>] [--company <company>]'
    );
  }

  const contact = await contactManager.updateContact(contactId, updateData);

  console.log(chalk.green('✓'), 'Contact updated successfully');
  console.log(chalk.gray(`  ID: ${contact.id}`));
  console.log(chalk.gray(`  Email: ${contact.email}`));
  if (contact.displayName) {
    console.log(chalk.gray(`  Name: ${contact.displayName}`));
  }
}

/**
 * Delete contact
 */
async function deleteContact(args, options) {
  if (!args || args.length === 0) {
    throw new ValidationError(
      'Contact ID is required. Usage: contact delete <id> [--yes]'
    );
  }

  const contactId = parseInt(args[0]);
  const contact = await contactManager.getContact(contactId);

  if (!options.yes) {
    console.log(
      chalk.yellow('Warning:'),
      `Delete contact "${contact.displayName || contact.email}"?`
    );
    console.log(chalk.gray('Use --yes to confirm deletion'));
    process.exit(1);
  }

  await contactManager.deleteContact(contactId);
  console.log(chalk.green('✓'), 'Contact deleted successfully');
}

/**
 * Search contacts
 */
async function searchContacts(args, options) {
  if (!args || args.length === 0) {
    throw new ValidationError(
      'Search keyword is required. Usage: contact search <keyword>'
    );
  }

  const keyword = args.join(' ');
  const contacts = await contactManager.searchContacts(keyword, null, {
    limit: options.limit || 50,
  });

  if (contacts.length === 0) {
    console.log(chalk.yellow(`No contacts found matching "${keyword}".`));
    return;
  }

  console.log(chalk.bold.cyan(`Search results for "${keyword}":`));
  console.log();

  contacts.forEach((contact) => {
    const favorite = contact.isFavorite ? chalk.yellow('★ ') : '  ';
    console.log(
      `${favorite}${chalk.bold(contact.displayName || contact.email)}`
    );
    console.log(chalk.gray(`  ID: ${contact.id} | Email: ${contact.email}`));
    if (contact.phone) {
      console.log(chalk.gray(`  Phone: ${contact.phone}`));
    }
    if (contact.company) {
      console.log(chalk.gray(`  Company: ${contact.company}`));
    }
    console.log();
  });

  console.log(chalk.gray(`Found: ${contacts.length} contacts`));
}

/**
 * Group command handler
 */
async function groupCommand(args, options) {
  if (!args || args.length === 0) {
    console.error(chalk.red('Error:'), 'Group action is required');
    console.log(
      chalk.gray('Available actions: create, list, add, remove, show')
    );
    process.exit(1);
  }

  const action = args[0];
  const subArgs = args.slice(1);

  switch (action) {
    case 'create':
      return createGroup(subArgs, options);
    case 'list':
      return listGroups(options);
    case 'add':
      return addToGroup(subArgs, options);
    case 'remove':
      return removeFromGroup(subArgs, options);
    case 'show':
      return showGroup(subArgs, options);
    default:
      console.error(chalk.red('Error:'), `Unknown group action: ${action}`);
      console.log(
        chalk.gray('Available actions: create, list, add, remove, show')
      );
      process.exit(1);
  }
}

/**
 * Create contact group
 */
async function createGroup(args, options) {
  if (!args || args.length === 0) {
    console.error(chalk.red('Error:'), 'Group name is required');
    console.log(
      chalk.gray('Usage: contact group create <name> [--description <text>]')
    );
    process.exit(1);
  }

  const name = args.join(' ');
  const group = await contactManager.createGroup({
    name,
    description: options.description || null,
  });

  console.log(chalk.green('✓'), `Group "${group.name}" created successfully`);
  console.log(chalk.gray(`  ID: ${group.id}`));
  if (group.description) {
    console.log(chalk.gray(`  Description: ${group.description}`));
  }
}

/**
 * List all groups
 */
async function listGroups(options) {
  const groups = await contactManager.listGroups();

  if (groups.length === 0) {
    console.log(chalk.yellow('No groups found.'));
    return;
  }

  console.log(chalk.bold.cyan('Contact Groups:'));
  console.log();

  for (const group of groups) {
    const count = contactGroupModel.countContacts(group.id);
    console.log(chalk.bold(group.name), chalk.gray(`(${count} contacts)`));
    console.log(chalk.gray(`  ID: ${group.id}`));
    if (group.description) {
      console.log(chalk.gray(`  ${group.description}`));
    }
    console.log();
  }

  console.log(chalk.gray(`Total: ${groups.length} groups`));
}

/**
 * Add contact to group
 */
async function addToGroup(args, options) {
  if (!args || args.length < 2) {
    console.error(
      chalk.red('Error:'),
      'Contact ID and group name are required'
    );
    console.log(
      chalk.gray('Usage: contact group add <contact-id> <group-name>')
    );
    process.exit(1);
  }

  const contactId = parseInt(args[0]);
  const groupName = args.slice(1).join(' ');

  const contact = await contactManager.getContact(contactId);
  const group = contactGroupModel.findByName(groupName);

  if (!group) {
    console.error(chalk.red('Error:'), `Group "${groupName}" not found`);
    process.exit(1);
  }

  await contactManager.addContactToGroup(contactId, group.id);

  console.log(
    chalk.green('✓'),
    `Contact "${contact.displayName || contact.email}" added to group "${group.name}"`
  );
}

/**
 * Remove contact from group
 */
async function removeFromGroup(args, options) {
  if (!args || args.length < 2) {
    console.error(
      chalk.red('Error:'),
      'Contact ID and group name are required'
    );
    console.log(
      chalk.gray('Usage: contact group remove <contact-id> <group-name>')
    );
    process.exit(1);
  }

  const contactId = parseInt(args[0]);
  const groupName = args.slice(1).join(' ');

  const contact = await contactManager.getContact(contactId);
  const group = contactGroupModel.findByName(groupName);

  if (!group) {
    console.error(chalk.red('Error:'), `Group "${groupName}" not found`);
    process.exit(1);
  }

  await contactManager.removeContactFromGroup(contactId, group.id);

  console.log(
    chalk.green('✓'),
    `Contact "${contact.displayName || contact.email}" removed from group "${group.name}"`
  );
}

/**
 * Show group details
 */
async function showGroup(args, options) {
  if (!args || args.length === 0) {
    console.error(chalk.red('Error:'), 'Group name is required');
    console.log(chalk.gray('Usage: contact group show <group-name>'));
    process.exit(1);
  }

  const groupName = args.join(' ');
  const group = contactGroupModel.findByName(groupName);

  if (!group) {
    console.error(chalk.red('Error:'), `Group "${groupName}" not found`);
    process.exit(1);
  }

  console.log(chalk.bold.cyan('Group Details:'));
  console.log();
  console.log(chalk.bold('  Name:'), group.name);
  console.log(chalk.bold('  ID:'), group.id);
  if (group.description) {
    console.log(chalk.bold('  Description:'), group.description);
  }

  const contacts = await contactManager.getGroupContacts(group.id);
  console.log();
  console.log(chalk.bold('  Contacts:'), contacts.length);

  if (contacts.length > 0) {
    console.log();
    contacts.forEach((contact) => {
      console.log(
        `    - ${contact.displayName || contact.email} (${contact.email})`
      );
    });
  }
}

/**
 * Import contacts from CSV
 */
async function importContacts(args, options) {
  if (!args || args.length === 0) {
    console.error(chalk.red('Error:'), 'CSV file path is required');
    console.log(chalk.gray('Usage: contact import <file.csv>'));
    process.exit(1);
  }

  const filePath = args[0];

  if (!fs.existsSync(filePath)) {
    console.error(chalk.red('Error:'), `File not found: ${filePath}`);
    process.exit(1);
  }

  const csvData = fs.readFileSync(filePath, 'utf-8');
  const result = await contactManager.importFromCSV(csvData);

  console.log(chalk.green('✓'), 'Import completed');
  console.log(chalk.gray(`  Imported: ${result.imported.length} contacts`));

  if (result.errors.length > 0) {
    console.log(chalk.yellow(`  Errors: ${result.errors.length}`));
    console.log();
    console.log(chalk.yellow('Errors:'));
    result.errors.forEach((error) => {
      console.log(chalk.gray(`  Line ${error.line}: ${error.error}`));
    });
  }
}

/**
 * Export contacts to CSV
 */
async function exportContacts(args, options) {
  if (!args || args.length === 0) {
    console.error(chalk.red('Error:'), 'Output file path is required');
    console.log(chalk.gray('Usage: contact export <file.csv>'));
    process.exit(1);
  }

  const filePath = args[0];
  const csvData = await contactManager.exportToCSV();

  fs.writeFileSync(filePath, csvData, 'utf-8');

  console.log(chalk.green('✓'), `Contacts exported to ${filePath}`);
}

module.exports = contactCommand;
