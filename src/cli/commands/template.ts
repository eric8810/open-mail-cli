import chalk from 'chalk';

import templateManager from '../../templates/manager';
import logger from '../../utils/logger';
import { handleCommandError } from '../utils/error-handler';

/**
 * Template command handler
 */
async function templateCommand(action, options = {}) {
  try {
    switch (action) {
      case 'create':
        await createTemplate(options);
        break;
      case 'list':
        await listTemplates(options);
        break;
      case 'show':
        await showTemplate(options);
        break;
      case 'edit':
        await editTemplate(options);
        break;
      case 'delete':
        await deleteTemplate(options);
        break;
      case 'use':
        await useTemplate(options);
        break;
      default:
        console.error(chalk.red(`Unknown action: ${action}`));
        console.log('Available actions: create, list, show, edit, delete, use');
        process.exit(1);
    }
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Create a new template
 */
async function createTemplate(options) {
  const { name, subject, text, html, account } = options;

  if (!name) {
    throw new Error('Template name is required (--name)');
  }

  if (!subject) {
    throw new Error('Template subject is required (--subject)');
  }

  if (!text && !html) {
    throw new Error('Template content is required (--text or --html)');
  }

  const id = await templateManager.create({
    name,
    subject,
    text,
    html,
    accountId: account,
  });

  console.log(chalk.green(`✓ Template created successfully`));
  console.log(`  ID: ${id}`);
  console.log(`  Name: ${name}`);
  console.log(`  Subject: ${subject}`);
}

/**
 * List all templates
 */
async function listTemplates(options) {
  const { account } = options;
  const templates = await templateManager.getAll(account);

  if (templates.length === 0) {
    console.log(chalk.yellow('No templates found'));
    return;
  }

  console.log(chalk.bold(`\nTemplates (${templates.length}):\n`));

  templates.forEach((tpl) => {
    const enabledBadge = tpl.isEnabled
      ? chalk.green(' [ENABLED]')
      : chalk.gray(' [DISABLED]');
    const accountInfo = tpl.accountId
      ? chalk.gray(` (Account: ${tpl.accountId})`)
      : '';

    console.log(
      `${chalk.cyan(`#${tpl.id}`)} ${chalk.bold(tpl.name)}${enabledBadge}${accountInfo}`
    );
    console.log(chalk.gray(`  Subject: ${tpl.subject}`));

    if (tpl.variables && tpl.variables.length > 0) {
      console.log(chalk.gray(`  Variables: ${tpl.variables.join(', ')}`));
    }

    if (tpl.bodyText) {
      const preview = tpl.bodyText.substring(0, 60).replace(/\n/g, ' ');
      console.log(
        chalk.gray(`  Text: ${preview}${tpl.bodyText.length > 60 ? '...' : ''}`)
      );
    }

    if (tpl.bodyHtml) {
      console.log(chalk.gray(`  HTML: Yes`));
    }

    console.log(
      chalk.gray(`  Created: ${new Date(tpl.createdAt).toLocaleString()}`)
    );
    console.log();
  });
}

/**
 * Show template details
 */
async function showTemplate(options) {
  const { id, name } = options;

  if (!id && !name) {
    throw new Error('Template ID (--id) or name (--name) is required');
  }

  let template;
  if (id) {
    template = await templateManager.getById(id);
  } else {
    template = await templateManager.getByName(name);
  }

  if (!template) {
    console.log(chalk.yellow(`Template not found`));
    return;
  }

  console.log(chalk.bold(`\nTemplate #${template.id}: ${template.name}\n`));
  console.log(`${chalk.bold('Subject:')} ${template.subject}`);
  console.log(
    `${chalk.bold('Status:')} ${template.isEnabled ? chalk.green('Enabled') : chalk.gray('Disabled')}`
  );

  if (template.accountId) {
    console.log(`${chalk.bold('Account ID:')} ${template.accountId}`);
  }

  if (template.variables && template.variables.length > 0) {
    console.log(`${chalk.bold('Variables:')} ${template.variables.join(', ')}`);
  }

  if (template.bodyText) {
    console.log(`\n${chalk.bold('Text Content:')}`);
    console.log(chalk.gray(template.bodyText));
  }

  if (template.bodyHtml) {
    console.log(`\n${chalk.bold('HTML Content:')}`);
    console.log(chalk.gray(template.bodyHtml));
  }

  console.log(
    `\n${chalk.gray('Created:')} ${new Date(template.createdAt).toLocaleString()}`
  );
  console.log(
    `${chalk.gray('Updated:')} ${new Date(template.updatedAt).toLocaleString()}`
  );
}

/**
 * Edit a template
 */
async function editTemplate(options) {
  const { id, name, subject, text, html, account, enabled } = options;

  if (!id) {
    throw new Error('Template ID is required (--id)');
  }

  const updateData = {};

  if (name !== undefined) updateData.name = name;
  if (subject !== undefined) updateData.subject = subject;
  if (text !== undefined) updateData.text = text;
  if (html !== undefined) updateData.html = html;
  if (account !== undefined) updateData.accountId = account;
  if (enabled !== undefined) updateData.isEnabled = enabled;

  if (Object.keys(updateData).length === 0) {
    throw new Error('No update data provided');
  }

  const updated = await templateManager.update(id, updateData);

  if (updated) {
    console.log(chalk.green(`✓ Template #${id} updated successfully`));
  } else {
    console.log(chalk.yellow(`No changes made to template #${id}`));
  }
}

/**
 * Delete a template
 */
async function deleteTemplate(options) {
  const { id } = options;

  if (!id) {
    throw new Error('Template ID is required (--id)');
  }

  const deleted = await templateManager.delete(id);

  if (deleted) {
    console.log(chalk.green(`✓ Template #${id} deleted successfully`));
  } else {
    console.log(chalk.yellow(`Template #${id} not found`));
  }
}

/**
 * Use template to generate email content
 */
async function useTemplate(options) {
  const { id, name, vars } = options;

  if (!id && !name) {
    throw new Error('Template ID (--id) or name (--name) is required');
  }

  let template;
  if (id) {
    template = await templateManager.getById(id);
  } else {
    template = await templateManager.getByName(name);
  }

  if (!template) {
    console.log(chalk.yellow(`Template not found`));
    return;
  }

  const variables = {};
  if (vars) {
    vars.split(',').forEach((pair) => {
      const [key, value] = pair.split('=');
      if (key && value) {
        variables[key.trim()] = value.trim();
      }
    });
  }

  const rendered = templateManager.renderTemplate(template, variables);

  console.log(chalk.bold(`\nRendered Email:\n`));
  console.log(`${chalk.bold('Subject:')} ${rendered.subject}`);

  if (rendered.text) {
    console.log(`\n${chalk.bold('Text Content:')}`);
    console.log(rendered.text);
  }

  if (rendered.html) {
    console.log(`\n${chalk.bold('HTML Content:')}`);
    console.log(chalk.gray(rendered.html));
  }

  if (template.variables && template.variables.length > 0) {
    const missingVars = template.variables.filter(
      (v) => !variables[v] && !['date', 'time', 'datetime'].includes(v)
    );
    if (missingVars.length > 0) {
      console.log(
        chalk.yellow(`\nNote: Missing variables: ${missingVars.join(', ')}`)
      );
    }
  }
}

module.exports = templateCommand;
