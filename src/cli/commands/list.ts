import chalk from 'chalk';

import { formatThreadTree } from './thread';
import accountModel from '../../storage/models/account';
import emailModel from '../../storage/models/email';
import tagModel from '../../storage/models/tag';
import analyzer from '../../threads/analyzer';
import builder from '../../threads/builder';
import logger from '../../utils/logger';
import { formatEmailList } from '../utils/formatter';

/**
 * List command - List emails from local storage
 */
function listCommand(options) {
  try {
    const folder = options.folder || 'INBOX';
    const limit = options.limit || 50;
    const page = options.page || 1;
    const offset = (page - 1) * limit;
    const unreadOnly = options.unread || false;
    const starred = options.starred || false;
    const flagged = options.flagged || false;
    const tag = options.tag || null;
    const accountId = options.account ? parseInt(options.account) : null;
    const allAccounts = options.allAccounts || false;
    const threadView = options.thread || false;

    let emails;
    let total;
    let title;

    // Handle different filtering modes
    if (starred) {
      title = 'Starred Emails';
      emails = emailModel.findStarred({
        limit,
        offset,
        folder: options.folder ? folder : null,
        accountId,
        allAccounts,
      });
      total = emailModel.countStarred(
        options.folder ? folder : null,
        accountId,
        allAccounts
      );
    } else if (flagged) {
      title = 'Flagged (Important) Emails';
      emails = emailModel.findImportant({
        limit,
        offset,
        folder: options.folder ? folder : null,
        accountId,
        allAccounts,
      });
      total = emailModel.countImportant(
        options.folder ? folder : null,
        accountId,
        allAccounts
      );
    } else if (tag) {
      // Find tag by name
      const tagObj = tagModel.findByName(tag);
      if (!tagObj) {
        console.error(chalk.red('Error:'), `Tag "${tag}" not found`);
        process.exit(1);
      }
      title = `Emails tagged with "${tag}"`;
      const rawEmails = tagModel.findEmailsByTag(tagObj.id, {
        limit,
        offset,
        accountId,
        allAccounts,
      });
      emails = rawEmails.map((email) => emailModel._formatEmail(email));
      total = tagModel.countEmailsByTag(tagObj.id, accountId, allAccounts);
    } else {
      title = `Emails in ${folder}`;
      emails = emailModel.findByFolder(folder, {
        limit,
        offset,
        unreadOnly,
        accountId,
        allAccounts,
      });
      total = emailModel.countByFolder(
        folder,
        unreadOnly,
        accountId,
        allAccounts
      );
    }

    // Add account info to title if filtering by account
    if (accountId) {
      const account = accountModel.findById(accountId);
      if (account) {
        title += ` (${account.email})`;
      }
    } else if (allAccounts) {
      title += ' (All Accounts)';
    }

    console.log(chalk.bold.cyan(`${title}:`));
    console.log();

    if (emails.length === 0) {
      console.log(chalk.yellow('No emails found.'));
      return;
    }

    // Display in thread view or flat view
    if (threadView) {
      // Fetch more emails to build complete threads
      const allEmails = emailModel.findByFolder(folder, {
        limit: limit * 5,
        offset: 0,
        unreadOnly,
        accountId,
        allAccounts,
      });

      // Analyze relationships
      const relationships = analyzer.analyzeRelationships(allEmails);

      // Build threads
      const threads = builder.buildThreads(allEmails, relationships);

      // Display threads
      threads.slice(0, limit).forEach((thread, index) => {
        const stats = builder.getThreadStats(thread);
        const threadLines = formatThreadTree(thread, { expanded: false });

        console.log(threadLines.join('\n'));
        console.log(
          chalk.gray(
            `  ${stats.messageCount} messages, ` +
              `${stats.participants.length} participants, ` +
              `${stats.hasUnread ? chalk.blue('unread') : 'all read'}`
          )
        );
        console.log('');
      });

      console.log(
        chalk.gray(
          `Showing ${Math.min(limit, threads.length)} of ${threads.length} threads (thread view)`
        )
      );
    } else {
      // Flat view
      console.log(formatEmailList(emails));
      console.log();

      const totalPages = Math.ceil(total / limit);
      console.log(
        chalk.gray(`Page ${page} of ${totalPages} (${total} total emails)`)
      );
    }

    if (unreadOnly) {
      console.log(chalk.gray('Showing unread emails only'));
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    logger.error('List command failed', { error: error.message });
    process.exit(1);
  }
}

module.exports = listCommand;
