import chalk from 'chalk';
import inquirer from 'inquirer';

import config from '../../config';
import logger from '../../utils/logger';

/**
 * Config command - Interactive configuration wizard
 */
async function configCommand(options) {
  try {
    if (options.show) {
      showConfig();
      return;
    }

    if (options.set) {
      setConfigValue(options.set);
      return;
    }

    // Interactive configuration wizard
    await configWizard();
  } catch (error) {
    console.error(chalk.red('Configuration error:'), error.message);
    logger.error('Config command failed', { error: error.message });
    process.exit(1);
  }
}

/**
 * Show current configuration
 */
function showConfig() {
  const currentConfig = config.load();
  console.log(chalk.bold.cyan('Current Configuration:'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.bold('IMAP:'));
  console.log(`  Host: ${currentConfig.imap.host || chalk.gray('(not set)')}`);
  console.log(`  Port: ${currentConfig.imap.port}`);
  console.log(`  Secure: ${currentConfig.imap.secure}`);
  console.log(`  User: ${currentConfig.imap.user || chalk.gray('(not set)')}`);
  console.log(
    `  Password: ${currentConfig.imap.password ? chalk.gray('(set)') : chalk.gray('(not set)')}`
  );
  console.log();
  console.log(chalk.bold('SMTP:'));
  console.log(`  Host: ${currentConfig.smtp.host || chalk.gray('(not set)')}`);
  console.log(`  Port: ${currentConfig.smtp.port}`);
  console.log(`  Secure: ${currentConfig.smtp.secure}`);
  console.log(`  User: ${currentConfig.smtp.user || chalk.gray('(not set)')}`);
  console.log(
    `  Password: ${currentConfig.smtp.password ? chalk.gray('(set)') : chalk.gray('(not set)')}`
  );
}

/**
 * Set configuration value
 */
function setConfigValue(keyValue) {
  const [key, value] = keyValue.split('=');
  if (!key || value === undefined) {
    console.error(chalk.red('Invalid format. Use: --set key=value'));
    process.exit(1);
  }

  config.load();
  config.set(key, value);
  config.save();
  console.log(chalk.green(`✓ Configuration updated: ${key} = ${value}`));
}

/**
 * Interactive configuration wizard
 */
async function configWizard() {
  console.log(chalk.bold.cyan('Mail Client Configuration Wizard'));
  console.log(chalk.gray('Configure your IMAP and SMTP settings\n'));

  const currentConfig = config.exists() ? config.load() : null;

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'imapHost',
      message: 'IMAP Host:',
      default: currentConfig?.imap.host,
    },
    {
      type: 'number',
      name: 'imapPort',
      message: 'IMAP Port:',
      default: currentConfig?.imap.port || 993,
    },
    {
      type: 'confirm',
      name: 'imapSecure',
      message: 'Use TLS/SSL for IMAP?',
      default: currentConfig?.imap.secure !== false,
    },
    {
      type: 'input',
      name: 'imapUser',
      message: 'IMAP Username (email):',
      default: currentConfig?.imap.user,
    },
    {
      type: 'password',
      name: 'imapPassword',
      message: 'IMAP Password:',
      mask: '*',
    },
    {
      type: 'input',
      name: 'smtpHost',
      message: 'SMTP Host:',
      default: currentConfig?.smtp.host,
    },
    {
      type: 'number',
      name: 'smtpPort',
      message: 'SMTP Port:',
      default: currentConfig?.smtp.port || 465,
    },
    {
      type: 'confirm',
      name: 'smtpSecure',
      message: 'Use TLS/SSL for SMTP?',
      default: currentConfig?.smtp.secure !== false,
    },
    {
      type: 'input',
      name: 'smtpUser',
      message: 'SMTP Username (email):',
      default: currentConfig?.smtp.user,
    },
    {
      type: 'password',
      name: 'smtpPassword',
      message: 'SMTP Password:',
      mask: '*',
    },
  ]);

  const newConfig = {
    imap: {
      host: answers.imapHost,
      port: answers.imapPort,
      secure: answers.imapSecure,
      user: answers.imapUser,
      password: answers.imapPassword,
    },
    smtp: {
      host: answers.smtpHost,
      port: answers.smtpPort,
      secure: answers.smtpSecure,
      user: answers.smtpUser,
      password: answers.smtpPassword,
    },
    storage: currentConfig?.storage || {
      dataDir: './data',
      maxAttachmentSize: 10485760,
    },
    sync: currentConfig?.sync || {
      autoSync: false,
      syncInterval: 300000,
      folders: ['INBOX'],
    },
  };

  config.save(newConfig);
  console.log(chalk.green('\n✓ Configuration saved successfully!'));
}

module.exports = configCommand;
