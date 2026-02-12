import chalk from 'chalk';

import emailModel from '../../storage/models/email';
import logger from '../../utils/logger';
import { handleCommandError } from '../utils/error-handler';
import { formatEmailList } from '../utils/formatter';

/**
 * Quick filter command - Fast access to common email filters
 */
function quickFilterCommand(filter, options) {
  try {
    const limit = options.limit || 50;
    const page = options.page || 1;
    const offset = (page - 1) * limit;
    const folder = options.folder || null;

    let emails = [];
    let title = '';

    switch (filter) {
      case 'unread':
        title = 'Unread Emails';
        emails = emailModel.search({
          unread: true,
          folder,
          limit,
          offset,
        });
        break;

      case 'starred':
        title = 'Starred Emails';
        emails = emailModel.findStarred({ limit, offset, folder });
        break;

      case 'flagged':
      case 'important':
        title = 'Flagged/Important Emails';
        emails = emailModel.findImportant({ limit, offset, folder });
        break;

      case 'attachments':
        title = 'Emails with Attachments';
        emails = emailModel.search({
          hasAttachment: true,
          folder,
          limit,
          offset,
        });
        break;

      case 'today':
        title = "Today's Emails";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        emails = emailModel.search({
          dateFrom: today.toISOString(),
          folder,
          limit,
          offset,
        });
        break;

      case 'week':
        title = "This Week's Emails";
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        emails = emailModel.search({
          dateFrom: weekStart.toISOString(),
          folder,
          limit,
          offset,
        });
        break;

      case 'month':
        title = "This Month's Emails";
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        emails = emailModel.search({
          dateFrom: monthStart.toISOString(),
          folder,
          limit,
          offset,
        });
        break;

      default:
        console.error(chalk.red('Error:'), `Unknown filter: ${filter}`);
        console.log();
        console.log('Available filters:');
        console.log('  unread        - Show unread emails');
        console.log('  starred       - Show starred emails');
        console.log('  flagged       - Show flagged/important emails');
        console.log('  attachments   - Show emails with attachments');
        console.log("  today         - Show today's emails");
        console.log("  week          - Show this week's emails");
        console.log("  month         - Show this month's emails");
        console.log();
        console.log('Options:');
        console.log('  --folder <name>   Filter in specific folder');
        console.log('  --limit <number>  Limit results (default: 50)');
        console.log('  --page <number>   Page number (default: 1)');
        process.exit(1);
    }

    console.log(chalk.bold.cyan(title));
    if (folder) {
      console.log(chalk.gray(`  Folder: ${folder}`));
    }
    console.log();

    if (emails.length === 0) {
      console.log(chalk.yellow('No emails found.'));
      return;
    }

    console.log(formatEmailList(emails));
    console.log();
    console.log(chalk.gray(`Showing ${emails.length} email(s) (Page ${page})`));
  } catch (error) {
    handleCommandError(error);
  }
}

module.exports = quickFilterCommand;
