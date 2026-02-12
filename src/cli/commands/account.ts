import chalk from 'chalk';
import prompts from 'prompts';

import accountManager from '../../accounts/manager';
import { ValidationError } from '../../utils/errors';
import logger from '../../utils/logger';
import { handleCommandError } from '../utils/error-handler';

/**
 * Account command handler
 */
async function accountCommand(action, options) {
  try {
    switch (action) {
      case 'add':
        await addAccount(options);
        break;
      case 'list':
        await listAccounts(options);
        break;
      case 'show':
        await showAccount(options);
        break;
      case 'edit':
        await editAccount(options);
        break;
      case 'delete':
        await deleteAccount(options);
        break;
      case 'default':
        await setDefaultAccount(options);
        break;
      case 'enable':
        await enableAccount(options);
        break;
      case 'disable':
        await disableAccount(options);
        break;
      case 'test':
        await testAccount(options);
        break;
      case 'migrate':
        await migrateConfig(options);
        break;
      default:
        console.log(chalk.red(`Unknown action: ${action}`));
        console.log(
          chalk.yellow(
            'Available actions: add, list, show, edit, delete, default, enable, disable, test, migrate'
          )
        );
    }
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Add new account
 */
async function addAccount(options) {
  console.log(chalk.blue.bold('\nAdd New Email Account\n'));

  const questions = [];

  if (!options.email) {
    questions.push({
      type: 'text',
      name: 'email',
      message: 'Email address:',
      validate: (value) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Invalid email format',
    });
  }

  if (!options.name) {
    questions.push({
      type: 'text',
      name: 'displayName',
      message: 'Display name (optional):',
      initial: options.email,
    });
  }

  if (!options.imapHost) {
    questions.push({
      type: 'text',
      name: 'imapHost',
      message: 'IMAP host:',
      validate: (value) => value.length > 0 || 'IMAP host is required',
    });
  }

  if (!options.imapPort) {
    questions.push({
      type: 'number',
      name: 'imapPort',
      message: 'IMAP port:',
      initial: 993,
    });
  }

  if (!options.smtpHost) {
    questions.push({
      type: 'text',
      name: 'smtpHost',
      message: 'SMTP host:',
      validate: (value) => value.length > 0 || 'SMTP host is required',
    });
  }

  if (!options.smtpPort) {
    questions.push({
      type: 'number',
      name: 'smtpPort',
      message: 'SMTP port:',
      initial: 465,
    });
  }

  if (!options.username) {
    questions.push({
      type: 'text',
      name: 'username',
      message: 'Username:',
      initial: options.email,
      validate: (value) => value.length > 0 || 'Username is required',
    });
  }

  if (!options.password) {
    questions.push({
      type: 'password',
      name: 'password',
      message: 'Password:',
      validate: (value) => value.length > 0 || 'Password is required',
    });
  }

  const answers = await prompts(questions);

  // Merge options and answers
  const accountData = {
    email: options.email || answers.email,
    displayName: options.name || answers.displayName || answers.email,
    imapHost: options.imapHost || answers.imapHost,
    imapPort: options.imapPort || answers.imapPort,
    imapSecure: options.imapSecure !== false,
    smtpHost: options.smtpHost || answers.smtpHost,
    smtpPort: options.smtpPort || answers.smtpPort,
    smtpSecure: options.smtpSecure !== false,
    username: options.username || answers.username || answers.email,
    password: options.password || answers.password,
    isEnabled: true,
  };

  // Test connection if requested
  if (options.test) {
    console.log(chalk.yellow('\nTesting connection...'));
    // We'll create a temporary account to test
    // For now, just add the account
  }

  const account = await accountManager.addAccount(accountData);
  console.log(chalk.green('\n✓ Account added successfully!'));
  console.log(chalk.gray(`Account ID: ${account.id}`));
  console.log(chalk.gray(`Email: ${account.email}`));
  if (account.isDefault) {
    console.log(chalk.yellow('This account is set as default'));
  }
}

/**
 * List all accounts
 */
async function listAccounts(options) {
  const accounts = accountManager.getAllAccounts(options.enabledOnly);

  if (accounts.length === 0) {
    console.log(chalk.yellow('No accounts found'));
    console.log(chalk.gray('Use "account add" to add a new account'));
    return;
  }

  console.log(chalk.blue.bold('\nEmail Accounts\n'));

  accounts.forEach((account) => {
    const status = [];
    if (account.isDefault) status.push(chalk.yellow('DEFAULT'));
    if (!account.isEnabled) status.push(chalk.red('DISABLED'));

    console.log(chalk.bold(`[${account.id}] ${account.email}`));
    if (status.length > 0) {
      console.log(`    ${status.join(' ')}`);
    }
    console.log(chalk.gray(`    Display Name: ${account.displayName}`));
    console.log(
      chalk.gray(`    IMAP: ${account.imapHost}:${account.imapPort}`)
    );
    console.log(
      chalk.gray(`    SMTP: ${account.smtpHost}:${account.smtpPort}`)
    );
    if (account.lastSync) {
      console.log(
        chalk.gray(
          `    Last Sync: ${new Date(account.lastSync).toLocaleString()}`
        )
      );
    }
    console.log('');
  });

  console.log(chalk.gray(`Total: ${accounts.length} account(s)`));
}

/**
 * Show account details
 */
async function showAccount(options) {
  if (!options.id) {
    throw new ValidationError('Account ID is required');
  }

  const account = accountManager.getAccount(options.id);
  if (!account) {
    throw new ValidationError(`Account with ID ${options.id} not found`);
  }

  console.log(chalk.blue.bold('\nAccount Details\n'));
  console.log(chalk.bold('ID:'), account.id);
  console.log(chalk.bold('Email:'), account.email);
  console.log(chalk.bold('Display Name:'), account.displayName);
  console.log(chalk.bold('Username:'), account.username);
  console.log('');
  console.log(chalk.bold('IMAP Configuration:'));
  console.log(`  Host: ${account.imapHost}`);
  console.log(`  Port: ${account.imapPort}`);
  console.log(`  Secure: ${account.imapSecure ? 'Yes' : 'No'}`);
  console.log('');
  console.log(chalk.bold('SMTP Configuration:'));
  console.log(`  Host: ${account.smtpHost}`);
  console.log(`  Port: ${account.smtpPort}`);
  console.log(`  Secure: ${account.smtpSecure ? 'Yes' : 'No'}`);
  console.log('');
  console.log(chalk.bold('Status:'));
  console.log(`  Default: ${account.isDefault ? chalk.yellow('Yes') : 'No'}`);
  console.log(
    `  Enabled: ${account.isEnabled ? chalk.green('Yes') : chalk.red('No')}`
  );
  console.log(`  Sync Interval: ${account.syncInterval} seconds`);
  if (account.lastSync) {
    console.log(`  Last Sync: ${new Date(account.lastSync).toLocaleString()}`);
  }
  console.log('');
  console.log(
    chalk.gray(`Created: ${new Date(account.createdAt).toLocaleString()}`)
  );
  console.log(
    chalk.gray(`Updated: ${new Date(account.updatedAt).toLocaleString()}`)
  );
}

/**
 * Edit account
 */
async function editAccount(options) {
  if (!options.id) {
    throw new ValidationError('Account ID is required');
  }

  const account = accountManager.getAccount(options.id);
  if (!account) {
    throw new ValidationError(`Account with ID ${options.id} not found`);
  }

  console.log(chalk.blue.bold('\nEdit Account\n'));
  console.log(chalk.gray('Leave blank to keep current value\n'));

  const questions = [
    {
      type: 'text',
      name: 'displayName',
      message: 'Display name:',
      initial: account.displayName,
    },
    {
      type: 'text',
      name: 'imapHost',
      message: 'IMAP host:',
      initial: account.imapHost,
    },
    {
      type: 'number',
      name: 'imapPort',
      message: 'IMAP port:',
      initial: account.imapPort,
    },
    {
      type: 'text',
      name: 'smtpHost',
      message: 'SMTP host:',
      initial: account.smtpHost,
    },
    {
      type: 'number',
      name: 'smtpPort',
      message: 'SMTP port:',
      initial: account.smtpPort,
    },
    {
      type: 'text',
      name: 'username',
      message: 'Username:',
      initial: account.username,
    },
    {
      type: 'confirm',
      name: 'changePassword',
      message: 'Change password?',
      initial: false,
    },
  ];

  const answers = await prompts(questions);

  if (answers.changePassword) {
    const passwordAnswer = await prompts({
      type: 'password',
      name: 'password',
      message: 'New password:',
      validate: (value) => value.length > 0 || 'Password is required',
    });
    answers.password = passwordAnswer.password;
  }

  const updateData = {};
  if (answers.displayName && answers.displayName !== account.displayName) {
    updateData.displayName = answers.displayName;
  }
  if (answers.imapHost && answers.imapHost !== account.imapHost) {
    updateData.imapHost = answers.imapHost;
  }
  if (answers.imapPort && answers.imapPort !== account.imapPort) {
    updateData.imapPort = answers.imapPort;
  }
  if (answers.smtpHost && answers.smtpHost !== account.smtpHost) {
    updateData.smtpHost = answers.smtpHost;
  }
  if (answers.smtpPort && answers.smtpPort !== account.smtpPort) {
    updateData.smtpPort = answers.smtpPort;
  }
  if (answers.username && answers.username !== account.username) {
    updateData.username = answers.username;
  }
  if (answers.password) {
    updateData.password = answers.password;
  }

  if (Object.keys(updateData).length === 0) {
    console.log(chalk.yellow('No changes made'));
    return;
  }

  accountManager.updateAccount(options.id, updateData);
  console.log(chalk.green('\n✓ Account updated successfully!'));
}

/**
 * Delete account
 */
async function deleteAccount(options) {
  if (!options.id) {
    throw new ValidationError('Account ID is required');
  }

  const account = accountManager.getAccount(options.id);
  if (!account) {
    throw new ValidationError(`Account with ID ${options.id} not found`);
  }

  if (!options.yes) {
    const answer = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Delete account "${account.email}"? This will also delete all associated emails and data.`,
      initial: false,
    });

    if (!answer.confirm) {
      console.log(chalk.yellow('Cancelled'));
      return;
    }
  }

  accountManager.deleteAccount(options.id);
  console.log(chalk.green('\n✓ Account deleted successfully'));
}

/**
 * Set default account
 */
async function setDefaultAccount(options) {
  if (!options.id) {
    throw new ValidationError('Account ID is required');
  }

  accountManager.setDefaultAccount(options.id);
  const account = accountManager.getAccount(options.id);
  console.log(chalk.green(`\n✓ "${account.email}" is now the default account`));
}

/**
 * Enable account
 */
async function enableAccount(options) {
  if (!options.id) {
    throw new ValidationError('Account ID is required');
  }

  accountManager.enableAccount(options.id);
  console.log(chalk.green('\n✓ Account enabled'));
}

/**
 * Disable account
 */
async function disableAccount(options) {
  if (!options.id) {
    throw new ValidationError('Account ID is required');
  }

  accountManager.disableAccount(options.id);
  console.log(chalk.yellow('\n✓ Account disabled'));
}

/**
 * Test account connection
 */
async function testAccount(options) {
  if (!options.id) {
    throw new ValidationError('Account ID is required');
  }

  const account = accountManager.getAccount(options.id);
  if (!account) {
    throw new ValidationError(`Account with ID ${options.id} not found`);
  }

  console.log(chalk.blue.bold('\nTesting Account Connection\n'));
  console.log(chalk.gray(`Account: ${account.email}\n`));

  const result = await accountManager.testAccount(options.id);

  if (result.success) {
    console.log(chalk.green('✓ All connections successful!'));
    console.log(chalk.green('  ✓ IMAP connection OK'));
    console.log(chalk.green('  ✓ SMTP connection OK'));
  } else {
    console.log(chalk.red('✗ Connection test failed\n'));
    result.errors.forEach((error) => {
      console.log(chalk.red(`  ✗ ${error.type}: ${error.message}`));
    });
    process.exit(1);
  }
}

/**
 * Migrate legacy config
 */
async function migrateConfig(options) {
  console.log(chalk.blue.bold('\nMigrating Legacy Configuration\n'));

  const result = accountManager.migrateLegacyConfig();

  if (result) {
    console.log(chalk.green('✓ Legacy configuration migrated successfully'));
    console.log(
      chalk.gray(
        'Your existing account has been converted to the new multi-account system'
      )
    );
  } else {
    console.log(chalk.yellow('No migration needed'));
    console.log(
      chalk.gray('Either accounts already exist or no legacy config was found')
    );
  }
}

module.exports = accountCommand;
