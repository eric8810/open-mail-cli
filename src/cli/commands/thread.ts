import chalk from 'chalk';

import emailModel from '../../storage/models/email';
import threadModel from '../../storage/models/thread';
import analyzer from '../../threads/analyzer';
import builder from '../../threads/builder';
import logger from '../../utils/logger';

/**
 * Format thread tree for display
 */
function formatThreadTree(thread, options = {}) {
  const { expanded = true, depth = 0, prefix = '', isLast = true } = options;
  const lines = [];

  // Thread connector
  const connector = depth === 0 ? '' : isLast ? '└─ ' : '├─ ';
  const childPrefix = depth === 0 ? '' : isLast ? '   ' : '│  ';

  // Format email info
  const unreadMark = thread.isRead ? ' ' : chalk.bold.blue('●');
  const starMark = thread.isStarred ? chalk.yellow('★') : ' ';
  const from = thread.from || 'Unknown';
  const subject = thread.subject || '(No subject)';
  const date = new Date(thread.date).toLocaleString();

  // Main line
  lines.push(
    `${prefix}${connector}${unreadMark}${starMark} ` +
      `${chalk.cyan(from)} - ${chalk.white(subject)} ` +
      `${chalk.gray(date)}`
  );

  // Show children if expanded
  if (expanded && thread.children && thread.children.length > 0) {
    thread.children.forEach((child, index) => {
      const isLastChild = index === thread.children.length - 1;
      const childLines = formatThreadTree(child, {
        expanded,
        depth: depth + 1,
        prefix: prefix + childPrefix,
        isLast: isLastChild,
      });
      lines.push(...childLines);
    });
  } else if (thread.children && thread.children.length > 0) {
    lines.push(
      `${prefix}${childPrefix}${chalk.gray(`   [${thread.children.length} more messages...]`)}`
    );
  }

  return lines;
}

/**
 * Thread list command
 */
async function listThreads(options = {}) {
  try {
    const { folder = 'INBOX', limit = 20, accountId = null } = options;

    console.log(chalk.bold(`\nThreaded view of ${folder}:\n`));

    // Fetch emails
    const emails = await emailModel.findByFolder(folder, {
      limit: limit * 5, // Fetch more to build threads
      includeDeleted: false,
    });

    if (emails.length === 0) {
      console.log(chalk.gray('No emails found.'));
      return;
    }

    // Analyze relationships
    const relationships = analyzer.analyzeRelationships(emails);

    // Build threads
    const threads = builder.buildThreads(emails, relationships);

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
        `Showing ${Math.min(limit, threads.length)} of ${threads.length} threads`
      )
    );
  } catch (error) {
    logger.error('Failed to list threads', { error: error.message });
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Show thread command
 */
async function showThread(emailId, options = {}) {
  try {
    const { expanded = true } = options;

    // Fetch email
    const email = await emailModel.findById(emailId);
    if (!email) {
      console.error(chalk.red(`Email ${emailId} not found.`));
      process.exit(1);
    }

    // Fetch all emails in the same folder
    const emails = await emailModel.findByFolder(email.folder, {
      limit: 1000,
      includeDeleted: false,
    });

    // Analyze relationships
    const relationships = analyzer.analyzeRelationships(emails);

    // Build threads
    const threads = builder.buildThreads(emails, relationships);

    // Find the thread containing this email
    const thread = builder.findThreadByEmailId(threads, emailId);

    if (!thread) {
      console.error(chalk.red('Thread not found.'));
      process.exit(1);
    }

    // Display thread
    console.log(chalk.bold('\nThread:\n'));
    const stats = builder.getThreadStats(thread);
    const threadLines = formatThreadTree(thread, { expanded });

    console.log(threadLines.join('\n'));
    console.log('');
    console.log(chalk.bold('Thread Statistics:'));
    console.log(chalk.gray(`  Messages: ${stats.messageCount}`));
    console.log(chalk.gray(`  Participants: ${stats.participants.join(', ')}`));
    console.log(
      chalk.gray(
        `  First message: ${new Date(stats.firstDate).toLocaleString()}`
      )
    );
    console.log(
      chalk.gray(`  Last message: ${new Date(stats.lastDate).toLocaleString()}`)
    );
    console.log(chalk.gray(`  Max depth: ${stats.depth}`));
    console.log(chalk.gray(`  Unread: ${stats.hasUnread ? 'Yes' : 'No'}`));
  } catch (error) {
    logger.error('Failed to show thread', { error: error.message });
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Delete thread command
 */
async function deleteThread(emailId, options = {}) {
  try {
    const { permanent = false } = options;

    // Fetch email
    const email = await emailModel.findById(emailId);
    if (!email) {
      console.error(chalk.red(`Email ${emailId} not found.`));
      process.exit(1);
    }

    // Fetch all emails in the same folder
    const emails = await emailModel.findByFolder(email.folder, {
      limit: 1000,
      includeDeleted: false,
    });

    // Analyze relationships
    const relationships = analyzer.analyzeRelationships(emails);

    // Build threads
    const threads = builder.buildThreads(emails, relationships);

    // Find the thread containing this email
    const thread = builder.findThreadByEmailId(threads, emailId);

    if (!thread) {
      console.error(chalk.red('Thread not found.'));
      process.exit(1);
    }

    // Get all emails in thread
    const threadEmails = builder.flattenThread(thread);

    console.log(
      chalk.yellow(`\nDeleting thread with ${threadEmails.length} messages...`)
    );

    // Delete each email
    for (const threadEmail of threadEmails) {
      if (permanent) {
        await emailModel.permanentlyDelete(threadEmail.id);
      } else {
        await emailModel.moveToTrash(threadEmail.id);
      }
    }

    console.log(
      chalk.green(`✓ Thread deleted (${threadEmails.length} messages)`)
    );
  } catch (error) {
    logger.error('Failed to delete thread', { error: error.message });
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Move thread command
 */
async function moveThread(emailId, targetFolder, options = {}) {
  try {
    // Fetch email
    const email = await emailModel.findById(emailId);
    if (!email) {
      console.error(chalk.red(`Email ${emailId} not found.`));
      process.exit(1);
    }

    // Fetch all emails in the same folder
    const emails = await emailModel.findByFolder(email.folder, {
      limit: 1000,
      includeDeleted: false,
    });

    // Analyze relationships
    const relationships = analyzer.analyzeRelationships(emails);

    // Build threads
    const threads = builder.buildThreads(emails, relationships);

    // Find the thread containing this email
    const thread = builder.findThreadByEmailId(threads, emailId);

    if (!thread) {
      console.error(chalk.red('Thread not found.'));
      process.exit(1);
    }

    // Get all emails in thread
    const threadEmails = builder.flattenThread(thread);

    console.log(
      chalk.yellow(
        `\nMoving thread with ${threadEmails.length} messages to ${targetFolder}...`
      )
    );

    // Move each email
    for (const threadEmail of threadEmails) {
      await emailModel.move(threadEmail.id, targetFolder);
    }

    console.log(
      chalk.green(
        `✓ Thread moved to ${targetFolder} (${threadEmails.length} messages)`
      )
    );
  } catch (error) {
    logger.error('Failed to move thread', { error: error.message });
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

export { listThreads, showThread, deleteThread, moveThread, formatThreadTree };
