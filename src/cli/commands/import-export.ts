import path from 'path';

import { Command } from 'commander';
import ora from 'ora';

import accountManager from '../../accounts/manager';
import importExportManager from '../../import-export/manager';
import logger from '../../utils/logger';

/**
 * Import/Export commands
 */
const importExportCommand = new Command('export');

importExportCommand.description('Import and export emails');

/**
 * Export single email to EML
 */
importExportCommand
  .command('email <id> <file>')
  .description('Export a single email to EML format')
  .action(async (id, file) => {
    const spinner = ora('Exporting email...').start();

    try {
      const emailId = parseInt(id);
      const filePath = path.resolve(file);

      await importExportManager.exportEmailToEml(emailId, filePath);

      spinner.succeed(`Email exported to ${filePath}`);
    } catch (error) {
      spinner.fail('Export failed');
      logger.error('Failed to export email', { error: error.message });
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Export folder to MBOX
 */
importExportCommand
  .command('folder <folder> <file>')
  .description('Export a folder to MBOX format')
  .action(async (folder, file) => {
    const spinner = ora('Exporting folder...').start();

    try {
      const filePath = path.resolve(file);

      let lastProgress = 0;
      const count = await importExportManager.exportFolderToMbox(
        folder,
        filePath,
        (current, total) => {
          const progress = Math.floor((current / total) * 100);
          if (progress !== lastProgress) {
            spinner.text = `Exporting folder... ${current}/${total} (${progress}%)`;
            lastProgress = progress;
          }
        }
      );

      spinner.succeed(
        `Exported ${count} emails from folder "${folder}" to ${filePath}`
      );
    } catch (error) {
      spinner.fail('Export failed');
      logger.error('Failed to export folder', { error: error.message });
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Export all emails to MBOX
 */
importExportCommand
  .command('all <file>')
  .description('Export all emails to MBOX format')
  .action(async (file) => {
    const spinner = ora('Exporting all emails...').start();

    try {
      const filePath = path.resolve(file);

      let lastProgress = 0;
      const count = await importExportManager.exportAllToMbox(
        filePath,
        (current, total) => {
          const progress = Math.floor((current / total) * 100);
          if (progress !== lastProgress) {
            spinner.text = `Exporting all emails... ${current}/${total} (${progress}%)`;
            lastProgress = progress;
          }
        }
      );

      spinner.succeed(`Exported ${count} emails to ${filePath}`);
    } catch (error) {
      spinner.fail('Export failed');
      logger.error('Failed to export all emails', { error: error.message });
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Import commands
 */
const importCommand = new Command('import');

importCommand.description('Import emails from files');

/**
 * Import EML file
 */
importCommand
  .command('eml <file>')
  .description('Import an EML file')
  .option('-f, --folder <folder>', 'Target folder', 'INBOX')
  .option('-a, --account <id>', 'Account ID')
  .action(async (file, options) => {
    const spinner = ora('Importing EML file...').start();

    try {
      const filePath = path.resolve(file);
      let accountId = null;

      if (options.account) {
        accountId = parseInt(options.account);
      } else {
        const defaultAccount = accountManager.getDefaultAccount();
        if (defaultAccount) {
          accountId = defaultAccount.id;
        }
      }

      const result = await importExportManager.importEml(
        filePath,
        options.folder,
        accountId
      );

      if (result.success) {
        spinner.succeed(
          `Email imported successfully (ID: ${result.emailId}, Attachments: ${result.attachmentCount})`
        );
      } else {
        spinner.warn(
          `Email skipped: ${result.reason} (Message-ID: ${result.messageId})`
        );
      }
    } catch (error) {
      spinner.fail('Import failed');
      logger.error('Failed to import EML file', { error: error.message });
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Import MBOX file
 */
importCommand
  .command('mbox <file>')
  .description('Import an MBOX file')
  .option('-f, --folder <folder>', 'Target folder', 'INBOX')
  .option('-a, --account <id>', 'Account ID')
  .action(async (file, options) => {
    const spinner = ora('Importing MBOX file...').start();

    try {
      const filePath = path.resolve(file);
      let accountId = null;

      if (options.account) {
        accountId = parseInt(options.account);
      } else {
        const defaultAccount = accountManager.getDefaultAccount();
        if (defaultAccount) {
          accountId = defaultAccount.id;
        }
      }

      const result = await importExportManager.importMbox(
        filePath,
        options.folder,
        accountId,
        (progress) => {
          spinner.text = `Importing MBOX... Imported: ${progress.imported}, Skipped: ${progress.skipped}, Errors: ${progress.errors}`;
        }
      );

      spinner.succeed(
        `MBOX import completed: ${result.imported} imported, ${result.skipped} skipped, ${result.errors} errors`
      );
    } catch (error) {
      spinner.fail('Import failed');
      logger.error('Failed to import MBOX file', { error: error.message });
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

export { importExportCommand as exportCommand, importCommand };
