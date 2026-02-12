import chalk from 'chalk';

import emailModel from '../../storage/models/email';
import tagModel from '../../storage/models/tag';
import logger from '../../utils/logger';
import { handleCommandError } from '../utils/error-handler';
import { formatEmailList } from '../utils/formatter';

/**
 * Tag command - Manage email tags
 */
function tagCommand(action, args, options) {
  try {
    switch (action) {
      case 'create':
        return createTag(args, options);
      case 'list':
        return listTags(options);
      case 'delete':
        return deleteTag(args, options);
      case 'add':
        return addTagToEmail(args, options);
      case 'remove':
        return removeTagFromEmail(args, options);
      case 'filter':
        return filterByTag(args, options);
      default:
        console.error(chalk.red('Error:'), `Unknown action: ${action}`);
        console.log(
          chalk.gray(
            'Available actions: create, list, delete, add, remove, filter'
          )
        );
        process.exit(1);
    }
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Create a new tag
 */
function createTag(args, options) {
  if (!args || args.length === 0) {
    console.error(chalk.red('Error:'), 'Tag name is required');
    console.log(
      chalk.gray(
        'Usage: tag create <name> [--color <color>] [--description <text>]'
      )
    );
    process.exit(1);
  }

  const name = args[0];
  const color = options.color || '#808080';
  const description = options.description || '';

  const tagId = tagModel.create({ name, color, description });

  console.log(chalk.green('✓'), `Tag "${name}" created successfully`);
  console.log(chalk.gray(`  ID: ${tagId}`));
  console.log(chalk.gray(`  Color: ${color}`));
  if (description) {
    console.log(chalk.gray(`  Description: ${description}`));
  }
}

/**
 * List all tags
 */
function listTags(options) {
  const tags = tagModel.findAll();

  if (tags.length === 0) {
    console.log(chalk.yellow('No tags found.'));
    return;
  }

  console.log(chalk.bold.cyan('Tags:'));
  console.log();

  tags.forEach((tag) => {
    const emailCount = tagModel.countEmailsByTag(tag.id);
    const colorBox = chalk.hex(tag.color)('■');
    console.log(
      `${colorBox} ${chalk.bold(tag.name)} ${chalk.gray(`(${emailCount} emails)`)}`
    );
    console.log(chalk.gray(`  ID: ${tag.id}`));
    if (tag.description) {
      console.log(chalk.gray(`  ${tag.description}`));
    }
    console.log();
  });

  console.log(chalk.gray(`Total: ${tags.length} tags`));
}

/**
 * Delete a tag
 */
function deleteTag(args, options) {
  if (!args || args.length === 0) {
    console.error(chalk.red('Error:'), 'Tag name or ID is required');
    console.log(chalk.gray('Usage: tag delete <name|id>'));
    process.exit(1);
  }

  const identifier = args[0];
  let tag;

  // Try to find by ID first, then by name
  if (/^\d+$/.test(identifier)) {
    tag = tagModel.findById(parseInt(identifier));
  } else {
    tag = tagModel.findByName(identifier);
  }

  if (!tag) {
    console.error(chalk.red('Error:'), `Tag "${identifier}" not found`);
    process.exit(1);
  }

  const emailCount = tagModel.countEmailsByTag(tag.id);

  if (emailCount > 0 && !options.yes) {
    console.log(
      chalk.yellow('Warning:'),
      `This tag is used by ${emailCount} email(s)`
    );
    console.log(chalk.gray('Use --yes to confirm deletion'));
    process.exit(1);
  }

  tagModel.delete(tag.id);
  console.log(chalk.green('✓'), `Tag "${tag.name}" deleted successfully`);
}

/**
 * Add tag to email
 */
function addTagToEmail(args, options) {
  if (!args || args.length < 2) {
    console.error(chalk.red('Error:'), 'Email ID and tag name are required');
    console.log(chalk.gray('Usage: tag add <email-id> <tag-name>'));
    process.exit(1);
  }

  const emailId = parseInt(args[0]);
  const tagName = args[1];

  // Verify email exists
  const email = emailModel.findById(emailId);
  if (!email) {
    console.error(chalk.red('Error:'), `Email with ID ${emailId} not found`);
    process.exit(1);
  }

  // Find or create tag
  let tag = tagModel.findByName(tagName);
  if (!tag) {
    console.log(chalk.yellow('Tag not found, creating new tag...'));
    const tagId = tagModel.create({ name: tagName });
    tag = tagModel.findById(tagId);
  }

  // Add tag to email
  tagModel.addToEmail(emailId, tag.id);

  console.log(chalk.green('✓'), `Tag "${tag.name}" added to email #${emailId}`);
  console.log(chalk.gray(`  Subject: ${email.subject}`));
}

/**
 * Remove tag from email
 */
function removeTagFromEmail(args, options) {
  if (!args || args.length < 2) {
    console.error(chalk.red('Error:'), 'Email ID and tag name are required');
    console.log(chalk.gray('Usage: tag remove <email-id> <tag-name>'));
    process.exit(1);
  }

  const emailId = parseInt(args[0]);
  const tagName = args[1];

  // Verify email exists
  const email = emailModel.findById(emailId);
  if (!email) {
    console.error(chalk.red('Error:'), `Email with ID ${emailId} not found`);
    process.exit(1);
  }

  // Find tag
  const tag = tagModel.findByName(tagName);
  if (!tag) {
    console.error(chalk.red('Error:'), `Tag "${tagName}" not found`);
    process.exit(1);
  }

  // Remove tag from email
  const removed = tagModel.removeFromEmail(emailId, tag.id);

  if (removed) {
    console.log(
      chalk.green('✓'),
      `Tag "${tag.name}" removed from email #${emailId}`
    );
  } else {
    console.log(chalk.yellow('Email does not have this tag'));
  }
}

/**
 * Filter emails by tag
 */
function filterByTag(args, options) {
  if (!args || args.length === 0) {
    console.error(chalk.red('Error:'), 'Tag name is required');
    console.log(
      chalk.gray(
        'Usage: tag filter <tag-name> [--limit <number>] [--page <number>]'
      )
    );
    process.exit(1);
  }

  const tagName = args[0];
  const limit = options.limit || 50;
  const page = options.page || 1;
  const offset = (page - 1) * limit;

  // Find tag
  const tag = tagModel.findByName(tagName);
  if (!tag) {
    console.error(chalk.red('Error:'), `Tag "${tagName}" not found`);
    process.exit(1);
  }

  console.log(chalk.bold.cyan(`Emails tagged with "${tag.name}":`));
  console.log();

  const emails = tagModel.findEmailsByTag(tag.id, { limit, offset });

  if (emails.length === 0) {
    console.log(chalk.yellow('No emails found with this tag.'));
    return;
  }

  // Format emails using the email model's formatter
  const formattedEmails = emails.map((email) => emailModel._formatEmail(email));
  console.log(formatEmailList(formattedEmails));
  console.log();

  const total = tagModel.countEmailsByTag(tag.id);
  const totalPages = Math.ceil(total / limit);

  console.log(
    chalk.gray(`Page ${page} of ${totalPages} (${total} total emails)`)
  );
}

module.exports = tagCommand;
