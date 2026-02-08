import chalk from 'chalk';
import Table from 'cli-table3';

import emailModel from '../../storage/models/email';
import logger from '../../utils/logger';

/**
 * List trash command
 * Shows all deleted emails
 */
function listTrashCommand(options) {
  try {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const deletedEmails = emailModel.findDeleted({ limit, offset });
    const totalCount = emailModel.countDeleted();

    if (deletedEmails.length === 0) {
      console.log(chalk.yellow('Trash is empty'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('From'),
        chalk.cyan('Subject'),
        chalk.cyan('Deleted At'),
        chalk.cyan('Folder'),
      ],
      colWidths: [8, 30, 40, 20, 15],
    });

    deletedEmails.forEach((email) => {
      table.push([
        email.id,
        truncate(email.from, 28),
        truncate(email.subject, 38),
        formatDate(email.deletedAt),
        email.folder,
      ]);
    });

    console.log(chalk.bold('\nTrash:'));
    console.log(table.toString());
    console.log(
      chalk.gray(
        `\nShowing ${deletedEmails.length} of ${totalCount} deleted emails`
      )
    );

    if (totalCount > limit) {
      console.log(chalk.gray(`Use --limit and --offset to see more`));
    }

    logger.info('Trash listed', {
      count: deletedEmails.length,
      total: totalCount,
    });
  } catch (error) {
    console.error(chalk.red(`Error listing trash: ${error.message}`));
    logger.error('List trash command failed', { error: error.message });
    process.exit(1);
  }
}

/**
 * Empty trash command
 * Permanently deletes all emails in trash
 */
async function emptyTrashCommand(options) {
  try {
    const count = emailModel.countDeleted();

    if (count === 0) {
      console.log(chalk.yellow('Trash is already empty'));
      return;
    }

    const confirmMsg = options.yes
      ? 'y'
      : await promptConfirm(
          `Are you sure you want to permanently delete ${count} emails from trash? This cannot be undone. (y/n): `
        );

    if (confirmMsg.toLowerCase() !== 'y') {
      console.log(chalk.yellow('Empty trash cancelled'));
      return;
    }

    const deletedCount = emailModel.emptyTrash();
    console.log(
      chalk.green(`Trash emptied: ${deletedCount} emails permanently deleted`)
    );
    logger.info('Trash emptied', { deletedCount });
  } catch (error) {
    console.error(chalk.red(`Error emptying trash: ${error.message}`));
    logger.error('Empty trash command failed', { error: error.message });
    process.exit(1);
  }
}

/**
 * Restore email from trash command
 */
function restoreCommand(emailId, options) {
  try {
    const email = emailModel.findById(emailId);

    if (!email) {
      console.error(chalk.red(`Error: Email with ID ${emailId} not found`));
      process.exit(1);
    }

    if (!email.isDeleted) {
      console.log(chalk.yellow('Email is not in trash'));
      return;
    }

    emailModel.restoreDeleted(emailId);
    console.log(chalk.green(`Email ${emailId} restored from trash`));
    logger.info('Email restored', { emailId });
  } catch (error) {
    console.error(chalk.red(`Error restoring email: ${error.message}`));
    logger.error('Restore command failed', { error: error.message });
    process.exit(1);
  }
}

/**
 * Batch restore emails from trash
 */
function batchRestoreCommand(emailIds, options) {
  try {
    const ids = emailIds
      .split(',')
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id));

    if (ids.length === 0) {
      console.error(chalk.red('Error: No valid email IDs provided'));
      process.exit(1);
    }

    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const email = emailModel.findById(id);
        if (!email) {
          console.log(chalk.yellow(`Email ${id} not found, skipping`));
          failCount++;
          continue;
        }

        if (!email.isDeleted) {
          console.log(chalk.yellow(`Email ${id} is not in trash, skipping`));
          failCount++;
          continue;
        }

        emailModel.restoreDeleted(id);
        successCount++;
      } catch (error) {
        console.log(
          chalk.yellow(`Failed to restore email ${id}: ${error.message}`)
        );
        failCount++;
      }
    }

    console.log(chalk.green(`\nBatch restore completed:`));
    console.log(chalk.green(`  Success: ${successCount}`));
    if (failCount > 0) {
      console.log(chalk.yellow(`  Failed: ${failCount}`));
    }

    logger.info('Batch restore completed', { successCount, failCount });
  } catch (error) {
    console.error(chalk.red(`Error in batch restore: ${error.message}`));
    logger.error('Batch restore command failed', { error: error.message });
    process.exit(1);
  }
}

/**
 * Trash command router
 */
async function trashCommand(action, args, options) {
  switch (action) {
    case 'list':
      listTrashCommand(options);
      break;
    case 'empty':
      await emptyTrashCommand(options);
      break;
    case 'restore':
      if (!args) {
        console.error(chalk.red('Error: Email ID required for restore'));
        process.exit(1);
      }
      if (args.includes(',')) {
        batchRestoreCommand(args, options);
      } else {
        restoreCommand(parseInt(args), options);
      }
      break;
    default:
      console.error(chalk.red(`Error: Unknown trash action: ${action}`));
      console.log(chalk.yellow('Available actions: list, empty, restore'));
      process.exit(1);
  }
}

/**
 * Truncate string to specified length
 */
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Prompt for confirmation
 */
function promptConfirm(message) {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question(message, (answer) => {
      readline.close();
      resolve(answer);
    });
  });
}

export {
  trashCommand,
  listTrashCommand,
  emptyTrashCommand,
  restoreCommand,
  batchRestoreCommand,
};
