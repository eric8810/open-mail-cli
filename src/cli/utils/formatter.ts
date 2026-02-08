import chalk from 'chalk';

import { formatDate, truncate } from '../../utils/helpers';

/**
 * Format email list for display
 */
function formatEmailList(emails) {
  if (!emails || emails.length === 0) {
    return chalk.yellow('No emails found.');
  }

  const rows = [];
  rows.push([
    chalk.bold('ID'),
    chalk.bold('From'),
    chalk.bold('Subject'),
    chalk.bold('Date'),
    chalk.bold('Status'),
  ]);

  for (const email of emails) {
    const status = email.isRead ? chalk.gray('Read') : chalk.green('Unread');
    rows.push([
      email.id.toString(),
      truncate(email.from, 25),
      truncate(email.subject, 40),
      formatDate(email.date),
      status,
    ]);
  }

  return formatTable(rows);
}

/**
 * Format email details for display
 */
function formatEmailDetails(email, attachments = []) {
  const lines = [];
  lines.push(chalk.bold.cyan('Email Details'));
  lines.push(chalk.gray('─'.repeat(60)));
  lines.push(`${chalk.bold('ID:')} ${email.id}`);
  lines.push(`${chalk.bold('From:')} ${email.from}`);
  lines.push(`${chalk.bold('To:')} ${email.to}`);
  if (email.cc) {
    lines.push(`${chalk.bold('CC:')} ${email.cc}`);
  }
  lines.push(`${chalk.bold('Subject:')} ${email.subject}`);
  lines.push(`${chalk.bold('Date:')} ${email.date}`);
  lines.push(`${chalk.bold('Status:')} ${email.isRead ? 'Read' : 'Unread'}`);

  if (attachments.length > 0) {
    lines.push(`${chalk.bold('Attachments:')} ${attachments.length}`);
    attachments.forEach((att) => {
      lines.push(`  - ${att.filename} (${formatFileSize(att.size)})`);
    });
  }

  lines.push(chalk.gray('─'.repeat(60)));
  lines.push(chalk.bold('Body:'));
  lines.push(email.bodyText || email.bodyHtml || chalk.gray('(No content)'));

  return lines.join('\n');
}

/**
 * Format simple table
 */
function formatTable(rows) {
  if (!rows || rows.length === 0) return '';

  const colWidths = [];
  for (let i = 0; i < rows[0].length; i++) {
    colWidths[i] = Math.max(...rows.map((row) => stripAnsi(row[i]).length));
  }

  const lines = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.map((cell, j) => {
      const stripped = stripAnsi(cell);
      const padding = ' '.repeat(colWidths[j] - stripped.length);
      return cell + padding;
    });
    lines.push(cells.join('  '));

    if (i === 0) {
      lines.push(colWidths.map((w) => '─'.repeat(w)).join('  '));
    }
  }

  return lines.join('\n');
}

/**
 * Strip ANSI codes for length calculation
 */
function stripAnsi(str) {
  let output = '';
  let index = 0;

  while (index < str.length) {
    const currentChar = str[index];
    const nextChar = str[index + 1];

    if (currentChar === '\u001b' && nextChar === '[') {
      index += 2;
      while (index < str.length && str[index] !== 'm') {
        index += 1;
      }
      if (index < str.length) {
        index += 1;
      }
      continue;
    }

    output += currentChar;
    index += 1;
  }

  return output;
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Format sync results
 */
function formatSyncResults(results) {
  const lines = [];
  lines.push(chalk.bold.green('Sync Results'));
  lines.push(chalk.gray('─'.repeat(60)));

  for (const [folder, result] of Object.entries(results.folders)) {
    if (result.error) {
      lines.push(`${chalk.red('✗')} ${folder}: ${chalk.red(result.error)}`);
    } else {
      lines.push(
        `${chalk.green('✓')} ${folder}: ${result.newEmails} new emails`
      );
    }
  }

  lines.push(chalk.gray('─'.repeat(60)));
  lines.push(`${chalk.bold('Total new emails:')} ${results.totalNew}`);
  if (results.totalErrors > 0) {
    lines.push(`${chalk.bold('Errors:')} ${chalk.red(results.totalErrors)}`);
  }

  return lines.join('\n');
}

export {
  formatEmailList,
  formatEmailDetails,
  formatTable,
  formatFileSize,
  formatSyncResults,
};
