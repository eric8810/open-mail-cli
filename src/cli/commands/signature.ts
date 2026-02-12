import chalk from 'chalk';

import signatureManager from '../../signatures/manager';
import logger from '../../utils/logger';
import { handleCommandError } from '../utils/error-handler';

/**
 * Signature command handler
 */
async function signatureCommand(action, options = {}) {
  try {
    switch (action) {
      case 'create':
        await createSignature(options);
        break;
      case 'list':
        await listSignatures(options);
        break;
      case 'edit':
        await editSignature(options);
        break;
      case 'delete':
        await deleteSignature(options);
        break;
      case 'set-default':
        await setDefaultSignature(options);
        break;
      default:
        console.error(chalk.red(`Unknown action: ${action}`));
        console.log(
          'Available actions: create, list, edit, delete, set-default'
        );
        process.exit(1);
    }
  } catch (error) {
    handleCommandError(error);
  }
}

/**
 * Create a new signature
 */
async function createSignature(options) {
  const { name, text, html, default: isDefault, account } = options;

  if (!name) {
    throw new Error('Signature name is required (--name)');
  }

  if (!text && !html) {
    throw new Error('Signature content is required (--text or --html)');
  }

  const id = await signatureManager.create({
    name,
    text,
    html,
    isDefault: isDefault || false,
    accountEmail: account,
  });

  console.log(chalk.green(`✓ Signature created successfully`));
  console.log(`  ID: ${id}`);
  console.log(`  Name: ${name}`);
  if (isDefault) {
    console.log(chalk.yellow('  Set as default'));
  }
}

/**
 * List all signatures
 */
async function listSignatures(options) {
  const { account } = options;
  const signatures = await signatureManager.getAll(account);

  if (signatures.length === 0) {
    console.log(chalk.yellow('No signatures found'));
    return;
  }

  console.log(chalk.bold(`\nSignatures (${signatures.length}):\n`));

  signatures.forEach((sig) => {
    const defaultBadge = sig.isDefault ? chalk.yellow(' [DEFAULT]') : '';
    const accountInfo = sig.accountEmail
      ? chalk.gray(` (${sig.accountEmail})`)
      : '';

    console.log(
      `${chalk.cyan(`#${sig.id}`)} ${chalk.bold(sig.name)}${defaultBadge}${accountInfo}`
    );

    if (sig.contentText) {
      const preview = sig.contentText.substring(0, 60);
      console.log(
        chalk.gray(
          `  Text: ${preview}${sig.contentText.length > 60 ? '...' : ''}`
        )
      );
    }

    if (sig.contentHtml) {
      console.log(chalk.gray(`  HTML: Yes`));
    }

    console.log(
      chalk.gray(`  Created: ${new Date(sig.createdAt).toLocaleString()}`)
    );
    console.log();
  });
}

/**
 * Edit a signature
 */
async function editSignature(options) {
  const { id, name, text, html, default: isDefault, account } = options;

  if (!id) {
    throw new Error('Signature ID is required (--id)');
  }

  const updateData = {};

  if (name !== undefined) updateData.name = name;
  if (text !== undefined) updateData.text = text;
  if (html !== undefined) updateData.html = html;
  if (isDefault !== undefined) updateData.isDefault = isDefault;
  if (account !== undefined) updateData.accountEmail = account;

  if (Object.keys(updateData).length === 0) {
    throw new Error('No update data provided');
  }

  const updated = await signatureManager.update(id, updateData);

  if (updated) {
    console.log(chalk.green(`✓ Signature #${id} updated successfully`));
  } else {
    console.log(chalk.yellow(`No changes made to signature #${id}`));
  }
}

/**
 * Delete a signature
 */
async function deleteSignature(options) {
  const { id } = options;

  if (!id) {
    throw new Error('Signature ID is required (--id)');
  }

  const deleted = await signatureManager.delete(id);

  if (deleted) {
    console.log(chalk.green(`✓ Signature #${id} deleted successfully`));
  } else {
    console.log(chalk.yellow(`Signature #${id} not found`));
  }
}

/**
 * Set signature as default
 */
async function setDefaultSignature(options) {
  const { id } = options;

  if (!id) {
    throw new Error('Signature ID is required (--id)');
  }

  await signatureManager.setDefault(id);
  console.log(chalk.green(`✓ Signature #${id} set as default`));
}

module.exports = signatureCommand;
