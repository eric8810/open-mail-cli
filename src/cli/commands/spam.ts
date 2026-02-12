import spamFilter from '../../spam/filter';
import emailModel from '../../storage/models/email';
import spamModel from '../../storage/models/spam';
import { ValidationError } from '../../utils/errors';
import { formatTable } from '../utils/formatter';
import { handleCommandError } from '../utils/error-handler';

/**
 * Spam management commands
 */

/**
 * Mark email as spam
 */
async function markAsSpam(emailId) {
  try {
    const email = await emailModel.findById(emailId);
    if (!email) {
      throw new ValidationError(`Email with ID ${emailId} not found`);
    }

    await emailModel.markAsSpam(emailId);
    console.log(`Email #${emailId} marked as spam`);

    // Learn from user feedback
    await spamFilter.learnFromFeedback(emailId, true);
    console.log('Spam filter updated based on your feedback');
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Unmark email as spam
 */
async function unmarkAsSpam(emailId) {
  try {
    const email = await emailModel.findById(emailId);
    if (!email) {
      throw new ValidationError(`Email with ID ${emailId} not found`);
    }

    await emailModel.unmarkAsSpam(emailId);
    console.log(`Email #${emailId} unmarked as spam`);

    // Learn from user feedback
    await spamFilter.learnFromFeedback(emailId, false);
    console.log('Spam filter updated based on your feedback');
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * List spam emails
 */
async function listSpam(options = {}) {
  try {
    const { limit = 20, offset = 0 } = options;
    const spamEmails = await emailModel.findSpam({ limit, offset });
    const totalCount = await emailModel.countSpam();

    if (spamEmails.length === 0) {
      console.log('No spam emails found');
      return;
    }

    console.log(`\nSpam Emails (${spamEmails.length} of ${totalCount}):\n`);

    const tableData = spamEmails.map((email) => ({
      ID: email.id,
      From: email.from.substring(0, 30),
      Subject: email.subject.substring(0, 40),
      Date: new Date(email.date).toLocaleDateString(),
    }));

    console.log(formatTable(tableData));
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Add email to blacklist
 */
async function addToBlacklist(emailAddress, reason) {
  try {
    await spamModel.addToBlacklist(emailAddress, reason);
    console.log(`Added ${emailAddress} to blacklist`);

    if (reason) {
      console.log(`Reason: ${reason}`);
    }
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Remove email from blacklist
 */
async function removeFromBlacklist(emailAddress) {
  try {
    const removed = await spamModel.removeFromBlacklist(emailAddress);

    if (removed) {
      console.log(`Removed ${emailAddress} from blacklist`);
    } else {
      console.log(`${emailAddress} was not in blacklist`);
    }
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * List blacklist
 */
async function listBlacklist() {
  try {
    const blacklist = await spamModel.getBlacklist();

    if (blacklist.length === 0) {
      console.log('Blacklist is empty');
      return;
    }

    console.log(`\nBlacklist (${blacklist.length} entries):\n`);

    const tableData = blacklist.map((entry) => ({
      ID: entry.id,
      Email: entry.email_address,
      Domain: entry.domain || 'N/A',
      Reason: (entry.reason || 'N/A').substring(0, 30),
      Added: new Date(entry.created_at).toLocaleDateString(),
    }));

    console.log(formatTable(tableData));
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Add email to whitelist
 */
async function addToWhitelist(emailAddress) {
  try {
    await spamModel.addToWhitelist(emailAddress);
    console.log(`Added ${emailAddress} to whitelist`);
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Remove email from whitelist
 */
async function removeFromWhitelist(emailAddress) {
  try {
    const removed = await spamModel.removeFromWhitelist(emailAddress);

    if (removed) {
      console.log(`Removed ${emailAddress} from whitelist`);
    } else {
      console.log(`${emailAddress} was not in whitelist`);
    }
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * List whitelist
 */
async function listWhitelist() {
  try {
    const whitelist = await spamModel.getWhitelist();

    if (whitelist.length === 0) {
      console.log('Whitelist is empty');
      return;
    }

    console.log(`\nWhitelist (${whitelist.length} entries):\n`);

    const tableData = whitelist.map((entry) => ({
      ID: entry.id,
      Email: entry.email_address,
      Domain: entry.domain || 'N/A',
      Added: new Date(entry.created_at).toLocaleDateString(),
    }));

    console.log(formatTable(tableData));
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Run spam filter on inbox
 */
async function runFilter(options = {}) {
  try {
    console.log('Initializing spam filter...');
    await spamFilter.initialize();

    console.log('Scanning inbox for spam...');

    // Get all non-spam, non-deleted emails
    const emails = await emailModel.findByFolder('INBOX', { limit: 100 });
    const unscannedEmails = emails.filter((e) => !e.isSpam && !e.isDeleted);

    if (unscannedEmails.length === 0) {
      console.log('No emails to scan');
      return;
    }

    console.log(`Scanning ${unscannedEmails.length} emails...`);

    let spamCount = 0;
    for (const email of unscannedEmails) {
      const result = await spamFilter.filterEmail(email.id);
      if (result.isSpam) {
        spamCount++;
        console.log(
          `  [SPAM] Email #${email.id}: ${email.subject.substring(0, 50)}`
        );
        console.log(
          `         Score: ${result.score}, Reasons: ${result.reasons.join(', ')}`
        );
      }
    }

    console.log(`\nScan complete: ${spamCount} spam emails detected`);
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Show spam statistics
 */
async function showStatistics() {
  try {
    await spamFilter.initialize();
    const stats = await spamFilter.getStatistics();

    console.log('\nSpam Filter Statistics:\n');
    console.log(`  Spam emails: ${stats.spamCount}`);
    console.log(`  Blacklist entries: ${stats.blacklistCount}`);
    console.log(`  Whitelist entries: ${stats.whitelistCount}`);
    console.log(`  Active rules: ${stats.rulesCount}`);
    console.log(`  Detection threshold: ${stats.threshold}`);
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Main spam command handler
 */
async function spamCommand(action, ...args) {
  try {
    switch (action) {
      case 'mark':
        if (!args[0]) {
          throw new ValidationError('Usage: mail-cli spam mark <email-id>');
        }
        await markAsSpam(parseInt(args[0]));
        break;

      case 'unmark':
        if (!args[0]) {
          throw new ValidationError('Usage: mail-cli spam unmark <email-id>');
        }
        await unmarkAsSpam(parseInt(args[0]));
        break;

      case 'list':
        await listSpam();
        break;

      case 'blacklist':
        const blacklistAction = args[0];
        if (blacklistAction === 'add') {
          if (!args[1]) {
            throw new ValidationError(
              'Usage: mail-cli spam blacklist add <email> [reason]'
            );
          }
          await addToBlacklist(args[1], args.slice(2).join(' '));
        } else if (blacklistAction === 'remove') {
          if (!args[1]) {
            throw new ValidationError(
              'Usage: mail-cli spam blacklist remove <email>'
            );
          }
          await removeFromBlacklist(args[1]);
        } else if (blacklistAction === 'list') {
          await listBlacklist();
        } else {
          throw new ValidationError(
            'Usage: mail-cli spam blacklist <add|remove|list> [email]'
          );
        }
        break;

      case 'whitelist':
        const whitelistAction = args[0];
        if (whitelistAction === 'add') {
          if (!args[1]) {
            throw new ValidationError(
              'Usage: mail-cli spam whitelist add <email>'
            );
          }
          await addToWhitelist(args[1]);
        } else if (whitelistAction === 'remove') {
          if (!args[1]) {
            throw new ValidationError(
              'Usage: mail-cli spam whitelist remove <email>'
            );
          }
          await removeFromWhitelist(args[1]);
        } else if (whitelistAction === 'list') {
          await listWhitelist();
        } else {
          throw new ValidationError(
            'Usage: mail-cli spam whitelist <add|remove|list> [email]'
          );
        }
        break;

      case 'filter':
        await runFilter();
        break;

      case 'stats':
        await showStatistics();
        break;

      default:
        console.log('Spam Management Commands:');
        console.log(
          '  mail-cli spam mark <email-id>           - Mark email as spam'
        );
        console.log(
          '  mail-cli spam unmark <email-id>         - Unmark email as spam'
        );
        console.log(
          '  mail-cli spam list                      - List spam emails'
        );
        console.log(
          '  mail-cli spam blacklist add <email>     - Add to blacklist'
        );
        console.log(
          '  mail-cli spam blacklist remove <email>  - Remove from blacklist'
        );
        console.log(
          '  mail-cli spam blacklist list            - List blacklist'
        );
        console.log(
          '  mail-cli spam whitelist add <email>     - Add to whitelist'
        );
        console.log(
          '  mail-cli spam whitelist remove <email>  - Remove from whitelist'
        );
        console.log(
          '  mail-cli spam whitelist list            - List whitelist'
        );
        console.log(
          '  mail-cli spam filter                    - Run spam filter on inbox'
        );
        console.log(
          '  mail-cli spam stats                     - Show spam statistics'
        );
    }
  } catch (error) {
    handleCommandError(error);
  }
}

module.exports = spamCommand;
