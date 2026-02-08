import chalk from 'chalk';

import config from '../../config';
import IMAPClient from '../../imap/client';
import emailModel from '../../storage/models/email';
import logger from '../../utils/logger';

/**
 * Delete email command
 * Moves email to trash or permanently deletes it
 */
async function deleteCommand(emailId, options) {
  try {
    const permanent = options.permanent || false;

    const email = emailModel.findById(emailId);
    if (!email) {
      console.error(chalk.red(`Error: Email with ID ${emailId} not found`));
      process.exit(1);
    }

    if (email.isDeleted && !permanent) {
      console.log(
        chalk.yellow(
          'Email is already in trash. Use --permanent to delete permanently.'
        )
      );
      return;
    }

    if (permanent) {
      const confirmMsg = options.yes
        ? 'y'
        : await promptConfirm(
            'Are you sure you want to permanently delete this email? This cannot be undone. (y/n): '
          );

      if (confirmMsg.toLowerCase() !== 'y') {
        console.log(chalk.yellow('Delete cancelled'));
        return;
      }

      const cfg = config.load();
      if (cfg.imap.host && cfg.imap.user && cfg.imap.password) {
        const imapClient = new IMAPClient({
          user: cfg.imap.user,
          password: cfg.imap.password,
          host: cfg.imap.host,
          port: cfg.imap.port,
          secure: cfg.imap.secure,
        });

        try {
          await imapClient.connect();
          await imapClient.openFolder(email.folder, false);
          await imapClient.deleteEmail(email.uid, true);
          await imapClient.disconnect();
        } catch (imapError) {
          logger.warn('IMAP delete failed, continuing with local delete', {
            error: imapError.message,
          });
        }
      }

      emailModel.permanentlyDelete(emailId);
      console.log(chalk.green(`Email ${emailId} permanently deleted`));
      logger.info('Email permanently deleted', { emailId });
    } else {
      const cfg = config.load();
      if (cfg.imap.host && cfg.imap.user && cfg.imap.password) {
        const imapClient = new IMAPClient({
          user: cfg.imap.user,
          password: cfg.imap.password,
          host: cfg.imap.host,
          port: cfg.imap.port,
          secure: cfg.imap.secure,
        });

        try {
          await imapClient.connect();
          await imapClient.openFolder(email.folder, false);
          await imapClient.deleteEmail(email.uid, false);
          await imapClient.disconnect();
        } catch (imapError) {
          logger.warn(
            'IMAP move to trash failed, continuing with local operation',
            { error: imapError.message }
          );
        }
      }

      emailModel.markAsDeleted(emailId);
      console.log(chalk.green(`Email ${emailId} moved to trash`));
      logger.info('Email moved to trash', { emailId });
    }
  } catch (error) {
    console.error(chalk.red(`Error deleting email: ${error.message}`));
    logger.error('Delete command failed', { error: error.message });
    process.exit(1);
  }
}

/**
 * Batch delete emails command
 */
async function batchDeleteCommand(emailIds, options) {
  try {
    const permanent = options.permanent || false;
    const ids = emailIds
      .split(',')
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id));

    if (ids.length === 0) {
      console.error(chalk.red('Error: No valid email IDs provided'));
      process.exit(1);
    }

    if (permanent) {
      const confirmMsg = options.yes
        ? 'y'
        : await promptConfirm(
            `Are you sure you want to permanently delete ${ids.length} emails? This cannot be undone. (y/n): `
          );

      if (confirmMsg.toLowerCase() !== 'y') {
        console.log(chalk.yellow('Delete cancelled'));
        return;
      }
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

        if (permanent) {
          emailModel.permanentlyDelete(id);
        } else {
          emailModel.markAsDeleted(id);
        }
        successCount++;
      } catch (error) {
        console.log(
          chalk.yellow(`Failed to delete email ${id}: ${error.message}`)
        );
        failCount++;
      }
    }

    console.log(chalk.green(`\nBatch delete completed:`));
    console.log(chalk.green(`  Success: ${successCount}`));
    if (failCount > 0) {
      console.log(chalk.yellow(`  Failed: ${failCount}`));
    }

    logger.info('Batch delete completed', {
      successCount,
      failCount,
      permanent,
    });
  } catch (error) {
    console.error(chalk.red(`Error in batch delete: ${error.message}`));
    logger.error('Batch delete command failed', { error: error.message });
    process.exit(1);
  }
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

export { deleteCommand, batchDeleteCommand };
