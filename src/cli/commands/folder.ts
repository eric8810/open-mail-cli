import { Command } from 'commander';

import config from '../../config';
import IMAPClient from '../../imap/client';
import emailModel from '../../storage/models/email';
import folderModel from '../../storage/models/folder';
import logger from '../../utils/logger';
import { formatTable } from '../utils/formatter';

/**
 * Folder management commands
 */
const folderCommand = new Command('folder');

folderCommand.description('Manage email folders');

/**
 * Create folder command
 */
folderCommand
  .command('create <name>')
  .description('Create a new folder')
  .option('-p, --parent <parent>', 'Parent folder name')
  .option('-f, --favorite', 'Mark as favorite')
  .action(async (name, options) => {
    try {
      logger.info('Creating folder', { name, parent: options.parent });

      const imapConfig = config.get('imap');
      const client = new IMAPClient(imapConfig);

      await client.connect();
      await client.createFolder(name);

      let parentId = null;
      if (options.parent) {
        const parentFolder = folderModel.findByName(options.parent);
        if (parentFolder) {
          parentId = parentFolder.id;
        }
      }

      folderModel.create({
        name,
        delimiter: '/',
        parentId,
        isFavorite: options.favorite || false,
      });

      client.disconnect();

      console.log(`Folder "${name}" created successfully`);
    } catch (error) {
      logger.error('Failed to create folder', { error: error.message });
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * List folders command
 */
folderCommand
  .command('list')
  .description('List all folders')
  .option('-t, --tree', 'Display as tree structure')
  .action(async (options) => {
    try {
      logger.info('Listing folders');

      const folders = folderModel.findAll();

      if (folders.length === 0) {
        console.log('No folders found');
        return;
      }

      if (options.tree) {
        displayFolderTree(folders);
      } else {
        const tableData = folders.map((folder) => ({
          Name: folder.name,
          Unread: folder.unreadCount,
          Total: folder.totalCount,
          Favorite: folder.isFavorite ? 'Yes' : 'No',
          'Last Sync': folder.lastSync
            ? new Date(folder.lastSync).toLocaleString()
            : 'Never',
        }));

        console.log(formatTable(tableData));
      }
    } catch (error) {
      logger.error('Failed to list folders', { error: error.message });
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Display folders as tree structure
 */
function displayFolderTree(folders) {
  const folderMap = new Map();
  const rootFolders = [];

  folders.forEach((folder) => {
    folderMap.set(folder.id, { ...folder, children: [] });
  });

  folders.forEach((folder) => {
    if (folder.parentId) {
      const parent = folderMap.get(folder.parentId);
      if (parent) {
        parent.children.push(folderMap.get(folder.id));
      } else {
        rootFolders.push(folderMap.get(folder.id));
      }
    } else {
      rootFolders.push(folderMap.get(folder.id));
    }
  });

  function printTree(folder, prefix = '', isLast = true) {
    const connector = isLast ? '└── ' : '├── ';
    const favorite = folder.isFavorite ? ' ★' : '';
    const counts = ` (${folder.unreadCount}/${folder.totalCount})`;
    console.log(prefix + connector + folder.name + favorite + counts);

    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    folder.children.forEach((child, index) => {
      printTree(child, childPrefix, index === folder.children.length - 1);
    });
  }

  rootFolders.forEach((folder, index) => {
    printTree(folder, '', index === rootFolders.length - 1);
  });
}

/**
 * Rename folder command
 */
folderCommand
  .command('rename <old-name> <new-name>')
  .description('Rename a folder')
  .action(async (oldName, newName) => {
    try {
      logger.info('Renaming folder', { oldName, newName });

      const imapConfig = config.get('imap');
      const client = new IMAPClient(imapConfig);

      await client.connect();
      await client.renameFolder(oldName, newName);

      folderModel.rename(oldName, newName);

      client.disconnect();

      console.log(`Folder "${oldName}" renamed to "${newName}" successfully`);
    } catch (error) {
      logger.error('Failed to rename folder', { error: error.message });
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Delete folder command
 */
folderCommand
  .command('delete <name>')
  .description('Delete a folder')
  .action(async (name) => {
    try {
      logger.info('Deleting folder', { name });

      const imapConfig = config.get('imap');
      const client = new IMAPClient(imapConfig);

      await client.connect();
      await client.deleteFolder(name);

      folderModel.deleteByName(name);

      client.disconnect();

      console.log(`Folder "${name}" deleted successfully`);
    } catch (error) {
      logger.error('Failed to delete folder', { error: error.message });
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Move email(s) to folder command
 */
folderCommand
  .command('move <email-ids> <folder>')
  .description('Move email(s) to a folder (comma-separated IDs for batch)')
  .action(async (emailIds, folder) => {
    try {
      const ids = emailIds.split(',').map((id) => parseInt(id.trim()));
      logger.info('Moving emails to folder', { ids, folder });

      const imapConfig = config.get('imap');
      const client = new IMAPClient(imapConfig);

      await client.connect();

      const uids = [];
      for (const id of ids) {
        const email = emailModel.findById(id);
        if (!email) {
          console.warn(`Email ID ${id} not found, skipping`);
          continue;
        }

        await client.openFolder(email.folder, false);
        uids.push(email.uid);
      }

      if (uids.length > 0) {
        if (uids.length === 1) {
          await client.moveEmail(uids[0], folder);
        } else {
          await client.batchMoveEmails(uids, folder);
        }

        ids.forEach((id) => {
          emailModel.updateFolder(id, folder);
        });

        console.log(
          `${uids.length} email(s) moved to "${folder}" successfully`
        );
      } else {
        console.log('No valid emails found to move');
      }

      client.disconnect();
    } catch (error) {
      logger.error('Failed to move emails', { error: error.message });
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Copy email(s) to folder command
 */
folderCommand
  .command('copy <email-ids> <folder>')
  .description('Copy email(s) to a folder (comma-separated IDs for batch)')
  .action(async (emailIds, folder) => {
    try {
      const ids = emailIds.split(',').map((id) => parseInt(id.trim()));
      logger.info('Copying emails to folder', { ids, folder });

      const imapConfig = config.get('imap');
      const client = new IMAPClient(imapConfig);

      await client.connect();

      const uids = [];
      for (const id of ids) {
        const email = emailModel.findById(id);
        if (!email) {
          console.warn(`Email ID ${id} not found, skipping`);
          continue;
        }

        await client.openFolder(email.folder, false);
        uids.push(email.uid);
      }

      if (uids.length > 0) {
        if (uids.length === 1) {
          await client.copyEmail(uids[0], folder);
        } else {
          await client.batchCopyEmails(uids, folder);
        }

        console.log(
          `${uids.length} email(s) copied to "${folder}" successfully`
        );
      } else {
        console.log('No valid emails found to copy');
      }

      client.disconnect();
    } catch (error) {
      logger.error('Failed to copy emails', { error: error.message });
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

module.exports = folderCommand;
