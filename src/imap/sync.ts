import fs from 'fs';
import path from 'path';

import type { ImapConfig } from '../types/imap';
import type { Attachment } from 'mailparser';

import IMAPClient from './client';
import contactManager from '../contacts/manager';
import filterEngine from '../filters/engine';
import notificationManager from '../notifications/manager';
import spamFilter from '../spam/filter';
import attachmentModel from '../storage/models/attachment';
import emailModel from '../storage/models/email';
import folderModel from '../storage/models/folder';
import { SyncError } from '../utils/errors';
import { getDataDir } from '../utils/helpers';
import logger from '../utils/logger';

interface SyncConfig extends ImapConfig {
  accountId: number;
  enableSpamFilter?: boolean;
  enableFilters?: boolean;
}

interface SyncResult {
  success: boolean;
  folders: { [key: string]: FolderSyncResult | { error: string } };
  totalNew: number;
  totalErrors: number;
  spamDetected: number;
  filtersApplied: number;
}

interface FolderSyncResult {
  newEmails: number;
  totalEmails: number;
  spamDetected?: number;
  filtersApplied?: number;
}

interface DraftData {
  from?: string;
  to?: string;
  cc?: string;
  subject?: string;
  bodyText?: string;
  messageId?: string;
}

class IMAPSync {
  private config: SyncConfig;
  private accountId: number;
  private client: IMAPClient | null;
  private attachmentDir: string;
  private enableSpamFilter: boolean;
  private spamFilterInitialized: boolean;
  private enableFilters: boolean;

  constructor(config: SyncConfig) {
    this.config = config;
    this.accountId = config.accountId;
    this.client = null;
    this.attachmentDir = path.join(getDataDir(), 'attachments');
    this.enableSpamFilter = config.enableSpamFilter !== false;
    this.spamFilterInitialized = false;
    this.enableFilters = config.enableFilters !== false;
  }

  private async _initializeSpamFilter(): Promise<void> {
    if (this.enableSpamFilter && !this.spamFilterInitialized) {
      try {
        await spamFilter.initialize();
        this.spamFilterInitialized = true;
        logger.info('Spam filter initialized for sync');
      } catch (error) {
        const err = error as Error;
        logger.error('Failed to initialize spam filter', {
          error: err.message,
        });
        this.enableSpamFilter = false;
      }
    }
  }

  private _ensureAttachmentDir(): void {
    if (!fs.existsSync(this.attachmentDir)) {
      fs.mkdirSync(this.attachmentDir, { recursive: true });
      logger.info('Created attachment directory', { path: this.attachmentDir });
    }
  }

  async syncFolders(folders = ['INBOX']): Promise<SyncResult> {
    const syncStartTime = Date.now();
    try {
      logger.info('[PERF] Starting sync process');

      const connectStartTime = Date.now();
      this.client = new IMAPClient(this.config);
      await this.client.connect();
      logger.info('[PERF] IMAP connection established', {
        duration: `${Date.now() - connectStartTime}ms`,
      });

      const spamFilterStartTime = Date.now();
      await this._initializeSpamFilter();
      if (this.enableSpamFilter) {
        logger.info('[PERF] Spam filter initialized', {
          duration: `${Date.now() - spamFilterStartTime}ms`,
        });
      }

      const results: SyncResult = {
        success: true,
        folders: {},
        totalNew: 0,
        totalErrors: 0,
        spamDetected: 0,
        filtersApplied: 0,
      };

      for (const folderName of folders) {
        const folderStartTime = Date.now();
        try {
          logger.info('[PERF] Starting folder sync', { folder: folderName });
          const result = await this.syncFolder(folderName);
          results.folders[folderName] = result;
          results.totalNew += result.newEmails;
          results.spamDetected += result.spamDetected || 0;
          results.filtersApplied += result.filtersApplied || 0;
          logger.info('[PERF] Folder sync completed', {
            folder: folderName,
            duration: `${Date.now() - folderStartTime}ms`,
            newEmails: result.newEmails,
          });
        } catch (error) {
          const err = error as Error;
          logger.error('Failed to sync folder', {
            folder: folderName,
            error: err.message,
          });
          results.folders[folderName] = { error: err.message };
          results.totalErrors++;
        }
      }

      this.client.disconnect();
      logger.info('[PERF] Sync completed', {
        totalDuration: `${Date.now() - syncStartTime}ms`,
        totalNew: results.totalNew,
        totalErrors: results.totalErrors,
        spamDetected: results.spamDetected,
      });
      return results;
    } catch (error) {
      const err = error as Error;
      logger.error('Sync failed', { error: err.message });
      if (this.client) {
        this.client.disconnect();
      }
      throw new SyncError(`Sync failed: ${err.message}`);
    }
  }

  async syncFolder(folderName: string): Promise<FolderSyncResult> {
    logger.info('Syncing folder', { folder: folderName });

    const openFolderStartTime = Date.now();
    const box = await this.client!.openFolder(folderName, true);
    logger.info('[PERF] Folder opened', {
      folder: folderName,
      duration: `${Date.now() - openFolderStartTime}ms`,
      totalMessages: box.messages?.total || 0,
    });

    const lastUid = this._getLastUid(folderName);

    let criteria: string[] = ['ALL'];
    if (lastUid > 0) {
      criteria = [`UID ${lastUid + 1}:*`];
      logger.debug('Incremental sync', {
        folder: folderName,
        fromUid: lastUid + 1,
      });
    } else {
      logger.debug('Full sync', { folder: folderName });
    }

    const fetchStartTime = Date.now();
    const emails = await this.client!.fetchEmails(criteria);
    logger.info('[PERF] Fetched emails from server', {
      folder: folderName,
      count: emails.length,
      duration: `${Date.now() - fetchStartTime}ms`,
    });

    let newEmails = 0;
    let spamDetected = 0;
    let filtersApplied = 0;
    const processingStartTime = Date.now();

    for (const emailData of emails) {
      const emailStartTime = Date.now();
      try {
        const existing = emailModel.findByUid(emailData.uid, folderName);
        if (existing) {
          logger.debug('Email already exists', { uid: emailData.uid });
          continue;
        }

        const parseStartTime = Date.now();
        const parsed = await this.client!.parseEmail(emailData);
        logger.debug('[PERF] Email parsed', {
          uid: emailData.uid,
          duration: `${Date.now() - parseStartTime}ms`,
        });

        if (parsed.messageId) {
          const existingByMessageId = emailModel.findByMessageId(
            parsed.messageId
          );
          if (existingByMessageId) {
            logger.debug('Email with same message_id already exists', {
              uid: emailData.uid,
              messageId: parsed.messageId,
            });
            continue;
          }
        }

        const dbStartTime = Date.now();
        const emailId = emailModel.create({
          uid: parsed.uid,
          messageId: parsed.messageId || '',
          folder: folderName,
          accountId: this.accountId,
          from: parsed.from,
          to: parsed.to,
          cc: parsed.cc,
          subject: parsed.subject,
          date: parsed.date,
          bodyText: parsed.bodyText,
          bodyHtml: parsed.bodyHtml,
          hasAttachments: parsed.attachments.length > 0,
          isRead: parsed.flags.includes('\\Seen'),
          flags: parsed.flags,
        });
        logger.debug('[PERF] Email saved to database', {
          uid: parsed.uid,
          duration: `${Date.now() - dbStartTime}ms`,
        });

        if (parsed.attachments.length > 0) {
          const attachmentStartTime = Date.now();
          await this._saveAttachments(emailId, parsed.attachments);
          logger.debug('[PERF] Attachments saved', {
            emailId,
            count: parsed.attachments.length,
            duration: `${Date.now() - attachmentStartTime}ms`,
          });
        }

        if (this.enableSpamFilter && folderName === 'INBOX') {
          try {
            const spamStartTime = Date.now();
            const email = emailModel.findById(emailId);
            const spamResult = await spamFilter.detectSpam(email);

            if (spamResult.isSpam) {
              await emailModel.markAsSpam(emailId);
              logger.info('Email marked as spam during sync', {
                emailId,
                score: spamResult.score,
                reasons: spamResult.reasons,
              });
              spamDetected++;
            }
            logger.debug('[PERF] Spam filter processed', {
              emailId,
              duration: `${Date.now() - spamStartTime}ms`,
            });
          } catch (error) {
            logger.error('Spam filter failed for email', {
              emailId,
              error: (error as Error).message,
            });
          }
        }

        if (this.enableFilters) {
          try {
            const filterStartTime = Date.now();
            const email = emailModel.findById(emailId);
            const filterResult = await filterEngine.applyFilters(email, {
              accountId: this.accountId,
            });

            if (filterResult.matched) {
              logger.info('Filters applied to email during sync', {
                emailId,
                filtersCount: filterResult.appliedFilters.length,
                filters: filterResult.appliedFilters.map(
                  (f: { filterName: string }) => f.filterName
                ),
              });
              filtersApplied++;
            }
            logger.debug('[PERF] Filter engine processed', {
              emailId,
              duration: `${Date.now() - filterStartTime}ms`,
            });
          } catch (error) {
            logger.error('Filter engine failed for email', {
              emailId,
              error: (error as Error).message,
            });
          }
        }

        try {
          const contactStartTime = Date.now();

          if (parsed.from) {
            await contactManager.autoCollectContact(parsed.from);
          }

          if (folderName === 'Sent' || folderName === 'SENT') {
            const recipients = [
              ...(parsed.to ? parsed.to.split(',') : []),
              ...(parsed.cc ? parsed.cc.split(',') : []),
            ];

            for (const recipient of recipients) {
              await contactManager.autoCollectContact(recipient.trim());
            }
          }

          logger.debug('[PERF] Contact auto-collection completed', {
            emailId,
            duration: `${Date.now() - contactStartTime}ms`,
          });
        } catch (error) {
          logger.debug('Contact auto-collection failed', {
            emailId,
            error: (error as Error).message,
          });
        }

        if (folderName === 'INBOX') {
          try {
            const email = emailModel.findById(emailId);
            if (email && !email.isSpam) {
              await notificationManager.notify(email);
            }
          } catch (error) {
            logger.debug('Notification failed', {
              emailId,
              error: (error as Error).message,
            });
          }
        }

        newEmails++;
        logger.debug('[PERF] Email processing completed', {
          uid: parsed.uid,
          id: emailId,
          totalDuration: `${Date.now() - emailStartTime}ms`,
        });
      } catch (error) {
        logger.error('Failed to save email', {
          uid: emailData.uid,
          error: (error as Error).message,
        });
      }
    }

    logger.info('[PERF] All emails processed', {
      folder: folderName,
      count: emails.length,
      duration: `${Date.now() - processingStartTime}ms`,
      avgPerEmail:
        emails.length > 0
          ? `${Math.round((Date.now() - processingStartTime) / emails.length)}ms`
          : 'N/A',
    });

    folderModel.upsert({
      name: folderName,
      delimiter: '/',
      flags: [],
      lastSync: new Date().toISOString(),
    });

    logger.info('Folder sync completed', {
      folder: folderName,
      newEmails,
      spamDetected,
      filtersApplied,
    });
    return {
      newEmails,
      totalEmails: box.messages?.total || 0,
      spamDetected,
      filtersApplied,
    };
  }

  private async _saveAttachments(
    emailId: number,
    attachments: Attachment[]
  ): Promise<void> {
    this._ensureAttachmentDir();

    for (const attachment of attachments) {
      try {
        const filename = attachment.filename || `attachment_${Date.now()}`;
        const sanitizedFilename = this._sanitizeFilename(filename);
        const filePath = path.join(
          this.attachmentDir,
          `${emailId}_${sanitizedFilename}`
        );

        fs.writeFileSync(filePath, attachment.content);

        attachmentModel.create({
          emailId,
          filename: sanitizedFilename,
          contentType: attachment.contentType,
          size: attachment.size,
          filePath,
        });

        logger.debug('Attachment saved', {
          emailId,
          filename: sanitizedFilename,
        });
      } catch (error) {
        logger.error('Failed to save attachment', {
          emailId,
          error: (error as Error).message,
        });
      }
    }
  }

  private _getLastUid(folderName: string): number {
    try {
      const emails = emailModel.findByFolder(folderName, {
        limit: 1,
        offset: 0,
      });
      if (emails.length > 0) {
        return emails[0].uid;
      }
      return 0;
    } catch (error) {
      logger.error('Failed to get last UID', {
        folder: folderName,
        error: (error as Error).message,
      });
      return 0;
    }
  }

  private _sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 255);
  }

  async syncDrafts(): Promise<{ synced: number; total: number }> {
    try {
      logger.info('Syncing drafts from server');

      if (!this.client) {
        this.client = new IMAPClient(this.config);
        await this.client.connect();
      }

      await this.client.openFolder('Drafts', true);

      const emails = await this.client.fetchEmails(['ALL']);
      logger.info('Fetched drafts from server', { count: emails.length });

      let syncedDrafts = 0;
      for (const emailData of emails) {
        try {
          const existing = emailModel.findByUid(emailData.uid, 'Drafts');
          if (existing) {
            logger.debug('Draft already exists', { uid: emailData.uid });
            continue;
          }

          const parsed = await this.client.parseEmail(emailData);

          emailModel.saveDraft({
            uid: parsed.uid,
            messageId: parsed.messageId,
            from: parsed.from,
            to: parsed.to,
            cc: parsed.cc,
            subject: parsed.subject,
            bodyText: parsed.bodyText,
            bodyHtml: parsed.bodyHtml,
          });

          syncedDrafts++;
          logger.debug('Draft synced', { uid: parsed.uid });
        } catch (error) {
          logger.error('Failed to sync draft', {
            uid: emailData.uid,
            error: (error as Error).message,
          });
        }
      }

      logger.info('Drafts sync completed', { synced: syncedDrafts });
      return { synced: syncedDrafts, total: emails.length };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to sync drafts', { error: err.message });
      throw new SyncError(`Failed to sync drafts: ${err.message}`);
    }
  }

  async uploadDraft(draftData: DraftData): Promise<boolean> {
    try {
      logger.info('Uploading draft to server');

      if (!this.client) {
        this.client = new IMAPClient(this.config);
        await this.client.connect();
      }

      await this.client.openFolder('Drafts', false);

      const message = this._composeDraftMessage(draftData);

      await this._appendMessage('Drafts', message, ['\\Draft']);

      logger.info('Draft uploaded to server');
      return true;
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to upload draft', { error: err.message });
      throw new SyncError(`Failed to upload draft: ${err.message}`);
    }
  }

  private _composeDraftMessage(draftData: DraftData): string {
    const lines: string[] = [];

    if (draftData.from) {
      lines.push(`From: ${draftData.from}`);
    }
    if (draftData.to) {
      lines.push(`To: ${draftData.to}`);
    }
    if (draftData.cc) {
      lines.push(`Cc: ${draftData.cc}`);
    }
    if (draftData.subject) {
      lines.push(`Subject: ${draftData.subject}`);
    }
    lines.push(`Date: ${new Date().toUTCString()}`);
    lines.push(
      `Message-ID: ${draftData.messageId || `<draft-${Date.now()}@local>`}`
    );
    lines.push('MIME-Version: 1.0');
    lines.push('Content-Type: text/plain; charset=utf-8');
    lines.push('');

    lines.push(draftData.bodyText || '');

    return lines.join('\r\n');
  }

  private _appendMessage(
    folderName: string,
    message: string,
    flags: string[] = []
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = this.client?.getImap();
      if (!imap) {
        return reject(new SyncError('IMAP client not connected'));
      }

      imap.append(
        message,
        { mailbox: folderName, flags },
        (err: Error | null) => {
          if (err) {
            logger.error('Failed to append message', {
              folder: folderName,
              error: err.message,
            });
            return reject(
              new SyncError(`Failed to append message: ${err.message}`)
            );
          }
          logger.debug('Message appended', { folder: folderName });
          resolve();
        }
      );
    });
  }
}

export default IMAPSync;
