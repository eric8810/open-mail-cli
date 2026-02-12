import chalk from 'chalk';
import inquirer from 'inquirer';

import notificationManager from '../../notifications/manager';
import logger from '../../utils/logger';
import { handleCommandError } from '../utils/error-handler';

/**
 * Notify command - Manage email notifications
 */
async function notifyCommand(action, options = {}) {
  try {
    switch (action) {
      case 'enable':
        return handleEnable();

      case 'disable':
        return handleDisable();

      case 'config':
        return handleConfig(options);

      case 'test':
        return handleTest();

      case 'status':
        return handleStatus();

      default:
        console.error(chalk.red(`Unknown notify command: ${action}`));
        console.log(
          'Available commands: enable, disable, config, test, status'
        );
        process.exit(1);
    }
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Enable notifications
 */
function handleEnable() {
  notificationManager.enable();
  console.log(chalk.green('✓ Notifications enabled'));
  console.log();
  console.log(
    chalk.gray('Use "notify config" to configure notification filters')
  );
  console.log(chalk.gray('Use "notify test" to test notifications'));
}

/**
 * Disable notifications
 */
function handleDisable() {
  notificationManager.disable();
  console.log(chalk.yellow('✓ Notifications disabled'));
}

/**
 * Configure notifications
 */
async function handleConfig(options) {
  const currentConfig = notificationManager.getConfig();

  console.log(chalk.blue('Current Notification Configuration:'));
  console.log();
  displayConfig(currentConfig);
  console.log();

  // Handle command-line options
  if (options.sender || options.tag || options.important !== undefined) {
    return handleConfigOptions(options);
  }

  // Interactive configuration
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to configure?',
      choices: [
        { name: 'Add sender filter', value: 'add-sender' },
        { name: 'Remove sender filter', value: 'remove-sender' },
        { name: 'Add tag filter', value: 'add-tag' },
        { name: 'Remove tag filter', value: 'remove-tag' },
        { name: 'Toggle important only', value: 'toggle-important' },
        { name: 'Toggle sound', value: 'toggle-sound' },
        { name: 'Toggle desktop notifications', value: 'toggle-desktop' },
        { name: 'Clear all filters', value: 'clear-filters' },
        { name: 'Back', value: 'back' },
      ],
    },
  ]);

  if (answers.action === 'back') {
    return;
  }

  await handleConfigAction(answers.action, currentConfig);
}

/**
 * Handle configuration options from command line
 */
function handleConfigOptions(options) {
  const filters = {};

  if (options.sender) {
    const senders = options.sender.split(',').map((s) => s.trim());
    filters.senders = senders;
    console.log(chalk.green(`✓ Sender filter set: ${senders.join(', ')}`));
  }

  if (options.tag) {
    const tags = options.tag.split(',').map((t) => t.trim());
    filters.tags = tags;
    console.log(chalk.green(`✓ Tag filter set: ${tags.join(', ')}`));
  }

  if (options.important !== undefined) {
    filters.importantOnly = options.important;
    console.log(chalk.green(`✓ Important only: ${options.important}`));
  }

  if (Object.keys(filters).length > 0) {
    notificationManager.updateFilters(filters);
  }
}

/**
 * Handle interactive configuration action
 */
async function handleConfigAction(action, currentConfig) {
  switch (action) {
    case 'add-sender': {
      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'sender',
          message: 'Enter sender email or domain:',
          validate: (input) =>
            input.trim().length > 0 || 'Sender cannot be empty',
        },
      ]);
      const senders = [...currentConfig.filters.senders, answer.sender.trim()];
      notificationManager.updateFilters({ senders });
      console.log(chalk.green(`✓ Added sender filter: ${answer.sender}`));
      break;
    }

    case 'remove-sender': {
      if (currentConfig.filters.senders.length === 0) {
        console.log(chalk.yellow('No sender filters to remove'));
        break;
      }
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'sender',
          message: 'Select sender to remove:',
          choices: currentConfig.filters.senders,
        },
      ]);
      const senders = currentConfig.filters.senders.filter(
        (s) => s !== answer.sender
      );
      notificationManager.updateFilters({ senders });
      console.log(chalk.green(`✓ Removed sender filter: ${answer.sender}`));
      break;
    }

    case 'add-tag': {
      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'tag',
          message: 'Enter tag name:',
          validate: (input) => input.trim().length > 0 || 'Tag cannot be empty',
        },
      ]);
      const tags = [...currentConfig.filters.tags, answer.tag.trim()];
      notificationManager.updateFilters({ tags });
      console.log(chalk.green(`✓ Added tag filter: ${answer.tag}`));
      break;
    }

    case 'remove-tag': {
      if (currentConfig.filters.tags.length === 0) {
        console.log(chalk.yellow('No tag filters to remove'));
        break;
      }
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'tag',
          message: 'Select tag to remove:',
          choices: currentConfig.filters.tags,
        },
      ]);
      const tags = currentConfig.filters.tags.filter((t) => t !== answer.tag);
      notificationManager.updateFilters({ tags });
      console.log(chalk.green(`✓ Removed tag filter: ${answer.tag}`));
      break;
    }

    case 'toggle-important': {
      const importantOnly = !currentConfig.filters.importantOnly;
      notificationManager.updateFilters({ importantOnly });
      console.log(
        chalk.green(
          `✓ Important only: ${importantOnly ? 'enabled' : 'disabled'}`
        )
      );
      break;
    }

    case 'toggle-sound': {
      const sound = !currentConfig.sound;
      notificationManager.updateSettings({ sound });
      console.log(chalk.green(`✓ Sound: ${sound ? 'enabled' : 'disabled'}`));
      break;
    }

    case 'toggle-desktop': {
      const desktop = !currentConfig.desktop;
      notificationManager.updateSettings({ desktop });
      console.log(
        chalk.green(
          `✓ Desktop notifications: ${desktop ? 'enabled' : 'disabled'}`
        )
      );
      break;
    }

    case 'clear-filters': {
      notificationManager.updateFilters({
        senders: [],
        tags: [],
        importantOnly: false,
      });
      console.log(chalk.green('✓ All filters cleared'));
      break;
    }
  }
}

/**
 * Test notifications
 */
async function handleTest() {
  console.log(chalk.blue('Sending test notification...'));

  try {
    await notificationManager.test();
    console.log(chalk.green('✓ Test notification sent'));
    console.log();
    console.log(chalk.gray('Check your system notifications'));
  } catch (error) {
    console.error(chalk.red('✗ Failed to send test notification'));
    console.error(chalk.red('Error:'), error.message);
    console.log();
    console.log(
      chalk.yellow(
        'Note: Desktop notifications may not work in all environments'
      )
    );
  }
}

/**
 * Show notification status
 */
function handleStatus() {
  const config = notificationManager.getConfig();
  const stats = notificationManager.getFilterStats();

  console.log(chalk.blue('Notification Status:'));
  console.log();

  if (config.enabled) {
    console.log(chalk.green('✓ Enabled'));
  } else {
    console.log(chalk.yellow('✗ Disabled'));
  }

  console.log();
  console.log(chalk.blue('Settings:'));
  console.log(
    chalk.gray(
      `  Desktop notifications: ${config.desktop ? 'enabled' : 'disabled'}`
    )
  );
  console.log(chalk.gray(`  Sound: ${config.sound ? 'enabled' : 'disabled'}`));

  console.log();
  console.log(chalk.blue('Filters:'));
  console.log(chalk.gray(`  Sender filters: ${stats.senderCount}`));
  console.log(chalk.gray(`  Tag filters: ${stats.tagCount}`));
  console.log(
    chalk.gray(`  Important only: ${stats.importantOnly ? 'yes' : 'no'}`)
  );

  if (config.filters.senders.length > 0) {
    console.log();
    console.log(chalk.blue('Sender Filters:'));
    config.filters.senders.forEach((sender) => {
      console.log(chalk.gray(`  - ${sender}`));
    });
  }

  if (config.filters.tags.length > 0) {
    console.log();
    console.log(chalk.blue('Tag Filters:'));
    config.filters.tags.forEach((tag) => {
      console.log(chalk.gray(`  - ${tag}`));
    });
  }
}

/**
 * Display configuration
 */
function displayConfig(config) {
  console.log(
    chalk.gray(`  Status: ${config.enabled ? 'enabled' : 'disabled'}`)
  );
  console.log(
    chalk.gray(`  Desktop: ${config.desktop ? 'enabled' : 'disabled'}`)
  );
  console.log(chalk.gray(`  Sound: ${config.sound ? 'enabled' : 'disabled'}`));
  console.log(
    chalk.gray(
      `  Important only: ${config.filters.importantOnly ? 'yes' : 'no'}`
    )
  );
  console.log(chalk.gray(`  Sender filters: ${config.filters.senders.length}`));
  console.log(chalk.gray(`  Tag filters: ${config.filters.tags.length}`));
}

module.exports = notifyCommand;
