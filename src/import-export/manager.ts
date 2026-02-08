import { promises as fs } from 'fs';
import path from 'path';

import emlHandler from './eml';
import mboxHandler from './mbox';
import attachmentModel from '../storage/models/attachment';
import emailModel from '../storage/models/email';
import { StorageError } from '../utils/errors';
import { getDataDir } from '../utils/helpers';
import logger from '../utils/logger';

/**
 * Import/Export Manager
 * High-level operations for importing and exporting emails
 */
class ImportExportManager {
  /**
   * Export single email to EML file
   * @param {number} emailId - Email ID
   * @param {string} filePath - Output file path
   * @returns {Promise<void>}
   */
  async exportEmailToEml(emailId, filePath) {
    try {
      logger.info('Exporting email to EML', { emailId, filePath });

      const email = emailModel.findById(emailId);
      if (!email) {
        throw new StorageError('Email not found');
      }

      // Get attachments
      const attachments = attachmentModel.findByEmailId(emailId);

      // Read attachment contents
      const attachmentsWithContent = [];
      for (const att of attachments) {
        try {
          const content = await fs.readFile(att.filePath);
          attachmentsWithContent.push({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
            content,
          });
        } catch (error) {
          logger.warn('Failed to read attachment file', {
            filePath: att.filePath,
            error: error.message,
          });
        }
      }

      const emailData = {
        messageId: email.messageId,
        from: email.fromAddress,
        to: email.toAddress,
        cc: email.ccAddress,
        subject: email.subject,
        date: email.date,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        attachments: attachmentsWithContent,
      };

      await emlHandler.generate(emailData, filePath);

      logger.info('Email exported to EML successfully', { emailId, filePath });
    } catch (error) {
      logger.error('Failed to export email to EML', {
        emailId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Export folder to MBOX file
   * @param {string} folderName - Folder name
   * @param {string} filePath - Output file path
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<number>} Number of emails exported
   */
  async exportFolderToMbox(folderName, filePath, onProgress = null) {
    try {
      logger.info('Exporting folder to MBOX', { folderName, filePath });

      // Get all emails from folder (no limit)
      const emails = emailModel.findByFolder(folderName, {
        limit: 999999,
        offset: 0,
      });

      if (emails.length === 0) {
        logger.warn('No emails found in folder', { folderName });
        return 0;
      }

      const emailsData = [];
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        const attachments = attachmentModel.findByEmailId(email.id);

        // Read attachment contents
        const attachmentsWithContent = [];
        for (const att of attachments) {
          try {
            const content = await fs.readFile(att.filePath);
            attachmentsWithContent.push({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
              content,
            });
          } catch (error) {
            logger.warn('Failed to read attachment file', {
              filePath: att.filePath,
              error: error.message,
            });
          }
        }

        emailsData.push({
          messageId: email.messageId,
          from: email.fromAddress,
          to: email.toAddress,
          cc: email.ccAddress,
          subject: email.subject,
          date: email.date,
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          attachments: attachmentsWithContent,
        });

        if (onProgress) {
          onProgress(i + 1, emails.length);
        }
      }

      await mboxHandler.generate(emailsData, filePath);

      logger.info('Folder exported to MBOX successfully', {
        folderName,
        filePath,
        count: emails.length,
      });

      return emails.length;
    } catch (error) {
      logger.error('Failed to export folder to MBOX', {
        folderName,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Export all emails to MBOX file
   * @param {string} filePath - Output file path
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<number>} Number of emails exported
   */
  async exportAllToMbox(filePath, onProgress = null) {
    try {
      logger.info('Exporting all emails to MBOX', { filePath });

      // Use search with no filters to get all emails
      const emails = emailModel.search({ limit: 999999, offset: 0 });

      if (emails.length === 0) {
        logger.warn('No emails found');
        return 0;
      }

      const emailsData = [];
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        const attachments = attachmentModel.findByEmailId(email.id);

        // Read attachment contents
        const attachmentsWithContent = [];
        for (const att of attachments) {
          try {
            const content = await fs.readFile(att.filePath);
            attachmentsWithContent.push({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
              content,
            });
          } catch (error) {
            logger.warn('Failed to read attachment file', {
              filePath: att.filePath,
              error: error.message,
            });
          }
        }

        emailsData.push({
          messageId: email.messageId,
          from: email.fromAddress,
          to: email.toAddress,
          cc: email.ccAddress,
          subject: email.subject,
          date: email.date,
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          attachments: attachmentsWithContent,
        });

        if (onProgress) {
          onProgress(i + 1, emails.length);
        }
      }

      await mboxHandler.generate(emailsData, filePath);

      logger.info('All emails exported to MBOX successfully', {
        filePath,
        count: emails.length,
      });

      return emails.length;
    } catch (error) {
      logger.error('Failed to export all emails to MBOX', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Import EML file
   * @param {string} filePath - EML file path
   * @param {string} folder - Target folder (default: INBOX)
   * @param {number} accountId - Account ID
   * @returns {Promise<Object>} Import result
   */
  async importEml(filePath, folder = 'INBOX', accountId = null) {
    try {
      logger.info('Importing EML file', { filePath, folder });

      const emailData = await emlHandler.parse(filePath);

      // Check for duplicate based on Message-ID
      if (emailData.messageId) {
        const existing = emailModel.findByMessageId(emailData.messageId);
        if (existing) {
          logger.warn('Email already exists (duplicate Message-ID)', {
            messageId: emailData.messageId,
          });
          return {
            success: false,
            reason: 'duplicate',
            messageId: emailData.messageId,
          };
        }
      }

      // Create email record
      const emailId = emailModel.create({
        uid: null,
        messageId: emailData.messageId,
        folder,
        from: emailData.from,
        to: emailData.to,
        cc: emailData.cc,
        subject: emailData.subject,
        date: emailData.date,
        bodyText: emailData.bodyText,
        bodyHtml: emailData.bodyHtml,
        hasAttachments: emailData.attachments.length > 0,
        isRead: false,
        flags: [],
        accountId,
      });

      // Save attachments
      if (emailData.attachments.length > 0) {
        const dataDir = getDataDir();
        const attachmentsDir = path.join(dataDir, 'attachments');

        // Ensure attachments directory exists
        await fs.mkdir(attachmentsDir, { recursive: true });

        for (const attachment of emailData.attachments) {
          // Save attachment content to file
          const attachmentPath = path.join(
            attachmentsDir,
            `${emailId}_${attachment.filename}`
          );
          await fs.writeFile(attachmentPath, attachment.content);

          attachmentModel.create({
            emailId,
            filename: attachment.filename,
            contentType: attachment.contentType,
            size: attachment.size,
            filePath: attachmentPath,
          });
        }
      }

      logger.info('EML file imported successfully', { filePath, emailId });

      return {
        success: true,
        emailId,
        attachmentCount: emailData.attachments.length,
      };
    } catch (error) {
      logger.error('Failed to import EML file', {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Import MBOX file
   * @param {string} filePath - MBOX file path
   * @param {string} folder - Target folder (default: INBOX)
   * @param {number} accountId - Account ID
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Import result
   */
  async importMbox(
    filePath,
    folder = 'INBOX',
    accountId = null,
    onProgress = null
  ) {
    try {
      logger.info('Importing MBOX file', { filePath, folder });

      let imported = 0;
      let skipped = 0;
      let errors = 0;

      const onEmail = async (emailData) => {
        try {
          // Check for duplicate based on Message-ID
          if (emailData.messageId) {
            const existing = emailModel.findByMessageId(emailData.messageId);
            if (existing) {
              logger.debug('Skipping duplicate email', {
                messageId: emailData.messageId,
              });
              skipped++;
              if (onProgress) {
                onProgress({ imported, skipped, errors });
              }
              return;
            }
          }

          // Create email record
          const emailId = emailModel.create({
            uid: null,
            messageId: emailData.messageId,
            folder,
            from: emailData.from,
            to: emailData.to,
            cc: emailData.cc,
            subject: emailData.subject,
            date: emailData.date,
            bodyText: emailData.bodyText,
            bodyHtml: emailData.bodyHtml,
            hasAttachments: emailData.attachments.length > 0,
            isRead: false,
            flags: [],
            accountId,
          });

          // Save attachments
          if (emailData.attachments.length > 0) {
            const dataDir = getDataDir();
            const attachmentsDir = path.join(dataDir, 'attachments');

            // Ensure attachments directory exists
            await fs.mkdir(attachmentsDir, { recursive: true });

            for (const attachment of emailData.attachments) {
              // Save attachment content to file
              const attachmentPath = path.join(
                attachmentsDir,
                `${emailId}_${attachment.filename}`
              );
              await fs.writeFile(attachmentPath, attachment.content);

              attachmentModel.create({
                emailId,
                filename: attachment.filename,
                contentType: attachment.contentType,
                size: attachment.size,
                filePath: attachmentPath,
              });
            }
          }

          imported++;
          if (onProgress) {
            onProgress({ imported, skipped, errors });
          }
        } catch (error) {
          logger.error('Failed to import email from MBOX', {
            error: error.message,
          });
          errors++;
          if (onProgress) {
            onProgress({ imported, skipped, errors });
          }
        }
      };

      await mboxHandler.parse(filePath, onEmail);

      logger.info('MBOX file imported successfully', {
        filePath,
        imported,
        skipped,
        errors,
      });

      return { success: true, imported, skipped, errors };
    } catch (error) {
      logger.error('Failed to import MBOX file', {
        filePath,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Batch export emails to MBOX
   * @param {Array<number>} emailIds - Array of email IDs
   * @param {string} filePath - Output file path
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<number>} Number of emails exported
   */
  async batchExportToMbox(emailIds, filePath, onProgress = null) {
    try {
      logger.info('Batch exporting emails to MBOX', {
        count: emailIds.length,
        filePath,
      });

      const emailsData = [];
      for (let i = 0; i < emailIds.length; i++) {
        const emailId = emailIds[i];
        const email = emailModel.findById(emailId);

        if (!email) {
          logger.warn('Email not found, skipping', { emailId });
          continue;
        }

        const attachments = attachmentModel.findByEmailId(emailId);

        emailsData.push({
          messageId: email.messageId,
          from: email.fromAddress,
          to: email.toAddress,
          cc: email.ccAddress,
          subject: email.subject,
          date: email.date,
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          attachments,
        });

        if (onProgress) {
          onProgress(i + 1, emailIds.length);
        }
      }

      await mboxHandler.generate(emailsData, filePath);

      logger.info('Batch export to MBOX completed', {
        filePath,
        count: emailsData.length,
      });

      return emailsData.length;
    } catch (error) {
      logger.error('Failed to batch export to MBOX', { error: error.message });
      throw error;
    }
  }
}

module.exports = new ImportExportManager();
