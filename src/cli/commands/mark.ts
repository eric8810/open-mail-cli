import chalk from 'chalk';

import { eventBus, EventTypes } from '../../events';
import emailModel from '../../storage/models/email';
import { ValidationError } from '../../utils/errors';
import { handleCommandError } from '../utils/error-handler';

/**
 * Star command - Mark email as starred
 */
function starCommand(emailId, options) {
  try {
    const id = parseInt(emailId);

    // Verify email exists
    const email = emailModel.findById(id);
    if (!email) {
      throw new ValidationError(`Email with ID ${id} not found`);
    }

    emailModel.markAsStarred(id);

    eventBus.emit({
      type: EventTypes.EMAIL_STARRED,
      timestamp: new Date(),
      data: { emailId: id, starred: true, subject: email.subject },
    });

    console.log(chalk.green('✓'), `Email #${id} marked as starred`);
    console.log(chalk.gray(`  Subject: ${email.subject}`));
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Unstar command - Remove starred mark from email
 */
function unstarCommand(emailId, options) {
  try {
    const id = parseInt(emailId);

    // Verify email exists
    const email = emailModel.findById(id);
    if (!email) {
      throw new ValidationError(`Email with ID ${id} not found`);
    }

    emailModel.unmarkAsStarred(id);

    eventBus.emit({
      type: EventTypes.EMAIL_STARRED,
      timestamp: new Date(),
      data: { emailId: id, starred: false, subject: email.subject },
    });

    console.log(chalk.green('✓'), `Email #${id} unmarked as starred`);
    console.log(chalk.gray(`  Subject: ${email.subject}`));
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Flag command - Mark email as important
 */
function flagCommand(emailId, options) {
  try {
    const id = parseInt(emailId);

    // Verify email exists
    const email = emailModel.findById(id);
    if (!email) {
      throw new ValidationError(`Email with ID ${id} not found`);
    }

    emailModel.markAsImportant(id);

    eventBus.emit({
      type: EventTypes.EMAIL_FLAGGED,
      timestamp: new Date(),
      data: { emailId: id, flagged: true, subject: email.subject },
    });

    console.log(chalk.green('✓'), `Email #${id} marked as important (flagged)`);
    console.log(chalk.gray(`  Subject: ${email.subject}`));
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Unflag command - Remove important mark from email
 */
function unflagCommand(emailId, options) {
  try {
    const id = parseInt(emailId);

    // Verify email exists
    const email = emailModel.findById(id);
    if (!email) {
      throw new ValidationError(`Email with ID ${id} not found`);
    }

    emailModel.unmarkAsImportant(id);

    eventBus.emit({
      type: EventTypes.EMAIL_FLAGGED,
      timestamp: new Date(),
      data: { emailId: id, flagged: false, subject: email.subject },
    });

    console.log(
      chalk.green('✓'),
      `Email #${id} unmarked as important (unflagged)`
    );
    console.log(chalk.gray(`  Subject: ${email.subject}`));
  } catch (error) {
    handleCommandError(error);
  }
}

export { starCommand, unstarCommand, flagCommand, unflagCommand };
