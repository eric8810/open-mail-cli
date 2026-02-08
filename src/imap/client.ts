import { simpleParser, Attachment } from 'mailparser';
import Imap from 'node-imap';

import type {
  ImapConfig,
  ImapMessage,
  ImapFolder,
  ImapMessageAttributes,
} from '../types/imap';

import { ConnectionError, AuthenticationError } from '../utils/errors';
import logger from '../utils/logger';

interface FetchOptions {
  batchSize?: number;
  fetchBody?: boolean;
}

interface EmailData {
  uid: number | null;
  attributes: ImapMessageAttributes | null;
  body: string;
  headers: string | null;
}

interface ParsedEmailResult {
  uid: number;
  messageId?: string;
  from: string;
  to: string;
  cc: string;
  subject: string;
  date: string;
  bodyText: string;
  bodyHtml: string;
  attachments: Attachment[];
  flags: string[];
}

interface FetchEmailBodyResult {
  bodyText: string;
  bodyHtml: string;
  attachments: Attachment[];
}

interface Boxes {
  [key: string]: Imap.Mailbox;
}

interface BoxWithChildren extends Imap.Mailbox {
  children?: Boxes;
}

class IMAPClient {
  private config: ImapConfig;
  private imap: Imap | null;
  private connected: boolean;

  constructor(config: ImapConfig) {
    this.config = config;
    this.imap = null;
    this.connected = false;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.imap = new Imap({
          user: this.config.user,
          password: this.config.password,
          host: this.config.host,
          port: this.config.port,
          tls: this.config.secure,
          tlsOptions: { rejectUnauthorized: false },
        });

        this.imap.once('ready', () => {
          this.connected = true;
          logger.info('IMAP connection established', {
            host: this.config.host,
          });
          resolve();
        });

        this.imap.once('error', (err: Error) => {
          logger.error('IMAP connection error', { error: err.message });
          if (err.message.includes('auth')) {
            reject(
              new AuthenticationError(`Authentication failed: ${err.message}`)
            );
          } else {
            reject(new ConnectionError(`Connection failed: ${err.message}`));
          }
        });

        this.imap.once('end', () => {
          this.connected = false;
          logger.info('IMAP connection ended');
        });

        this.imap.connect();
      } catch (error) {
        const err = error as Error;
        logger.error('Failed to connect to IMAP', { error: err.message });
        reject(new ConnectionError(`Failed to connect: ${err.message}`));
      }
    });
  }

  disconnect(): void {
    if (this.imap && this.connected) {
      this.imap.end();
      logger.info('IMAP disconnected');
    }
  }

  getImap(): Imap | null {
    return this.imap;
  }

  listFolders(): Promise<ImapFolder[]> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      this.imap!.getBoxes((err: Error | null, boxes: Boxes) => {
        if (err) {
          logger.error('Failed to list folders', { error: err.message });
          return reject(
            new ConnectionError(`Failed to list folders: ${err.message}`)
          );
        }

        const folders = this._flattenBoxes(boxes);
        logger.debug('Folders listed', { count: folders.length });
        resolve(folders);
      });
    });
  }

  openFolder(folderName = 'INBOX', readOnly = true): Promise<Imap.Box> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      this.imap!.openBox(
        folderName,
        readOnly,
        (err: Error | null, box: Imap.Box) => {
          if (err) {
            logger.error('Failed to open folder', {
              folder: folderName,
              error: err.message,
            });
            return reject(
              new ConnectionError(`Failed to open folder: ${err.message}`)
            );
          }

          logger.debug('Folder opened', {
            folder: folderName,
            messages: box.messages?.total || 0,
          });
          resolve(box);
        }
      );
    });
  }

  fetchEmails(
    criteria: string[] = ['ALL'],
    options: FetchOptions = {}
  ): Promise<ImapMessage[]> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      const searchStartTime = Date.now();
      this.imap!.search(criteria, async (err: Error | null, uids: number[]) => {
        if (err) {
          logger.error('Failed to search emails', { error: err.message });
          return reject(
            new ConnectionError(`Failed to search emails: ${err.message}`)
          );
        }

        if (!uids || uids.length === 0) {
          logger.debug('No emails found');
          return resolve([]);
        }

        logger.info('[PERF] Email search completed', {
          count: uids.length,
          duration: `${Date.now() - searchStartTime}ms`,
        });

        const batchSize = options.batchSize || 100;
        const fetchBody = options.fetchBody || false;
        const allEmails: ImapMessage[] = [];

        try {
          for (let i = 0; i < uids.length; i += batchSize) {
            const batchUids = uids.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(uids.length / batchSize);

            logger.info('[PERF] Fetching batch', {
              batch: `${batchNum}/${totalBatches}`,
              uids: `${i + 1}-${Math.min(i + batchSize, uids.length)}`,
              count: batchUids.length,
              mode: fetchBody ? 'full' : 'headers-only',
            });

            const batchEmails = await this._fetchBatch(batchUids, fetchBody);
            allEmails.push(...batchEmails);

            logger.info('[PERF] Batch fetched', {
              batch: `${batchNum}/${totalBatches}`,
              count: batchEmails.length,
              total: allEmails.length,
            });
          }

          logger.info('[PERF] All batches fetched', {
            totalCount: allEmails.length,
            duration: `${Date.now() - searchStartTime}ms`,
          });

          resolve(allEmails);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private _fetchBatch(
    uids: number[],
    fetchBody = false
  ): Promise<ImapMessage[]> {
    return new Promise((resolve, reject) => {
      const fetchStartTime = Date.now();
      const emails: ImapMessage[] = [];
      const totalInBatch = uids.length;
      let completedInBatch = 0;
      let totalBytesReceived = 0;

      const fetchOptions: Imap.FetchOptions = {
        bodies: fetchBody ? '' : 'HEADER',
        struct: true,
      };

      const fetch = this.imap!.fetch(uids, fetchOptions);

      fetch.on('message', (msg: Imap.ImapMessage, seqno: number) => {
        const msgStartTime = Date.now();
        const emailData: EmailData = {
          uid: null,
          attributes: null,
          body: '',
          headers: null,
        };
        let bytesReceived = 0;

        msg.on(
          'body',
          (stream: NodeJS.ReadableStream, info: Imap.MessageBodyInfo) => {
            let buffer = '';
            stream.on('data', (chunk: Buffer) => {
              const chunkSize = chunk.length;
              bytesReceived += chunkSize;
              totalBytesReceived += chunkSize;
              buffer += chunk.toString('utf8');

              if (
                fetchBody &&
                bytesReceived > 100 * 1024 &&
                bytesReceived % (50 * 1024) < chunkSize
              ) {
                logger.debug('[PERF] Receiving large email', {
                  uid: emailData.uid || 'unknown',
                  received: `${Math.round(bytesReceived / 1024)}KB`,
                  progress: `${completedInBatch + 1}/${totalInBatch}`,
                });
              }
            });
            stream.once('end', () => {
              if (info.which === 'HEADER') {
                emailData.headers = buffer;
              } else {
                emailData.body = buffer;
              }
            });
          }
        );

        msg.once('attributes', (attrs: Imap.MessageAttributes) => {
          emailData.uid = attrs.uid;
          emailData.attributes = attrs;
        });

        msg.once('end', () => {
          completedInBatch++;
          emails.push({
            uid: emailData.uid!,
            attributes: emailData.attributes!,
            body: emailData.body,
            headers: emailData.headers,
          });

          const elapsedTime = Date.now() - fetchStartTime;
          const avgTimePerMsg = elapsedTime / completedInBatch;
          const estimatedRemaining = Math.round(
            (avgTimePerMsg * (totalInBatch - completedInBatch)) / 1000
          );

          logger.info('[PERF] Message fetched', {
            uid: emailData.uid,
            progress: `${completedInBatch}/${totalInBatch}`,
            percentage: `${Math.round((completedInBatch / totalInBatch) * 100)}%`,
            size: `${Math.round(bytesReceived / 1024)}KB`,
            duration: `${Date.now() - msgStartTime}ms`,
            totalReceived: `${Math.round(totalBytesReceived / 1024)}KB`,
            estimatedRemaining:
              estimatedRemaining > 0 ? `${estimatedRemaining}s` : 'finishing',
          });
        });
      });

      fetch.once('error', (err: Error) => {
        logger.error('Fetch batch error', { error: err.message });
        reject(new ConnectionError(`Fetch batch error: ${err.message}`));
      });

      fetch.once('end', () => {
        const totalDuration = Date.now() - fetchStartTime;
        const avgSpeed = totalBytesReceived / (totalDuration / 1000);

        logger.info('[PERF] Batch fetch completed', {
          count: emails.length,
          duration: `${totalDuration}ms`,
          totalSize: `${Math.round(totalBytesReceived / 1024)}KB`,
          avgSpeed: `${Math.round(avgSpeed / 1024)}KB/s`,
          avgPerMessage:
            emails.length > 0
              ? `${Math.round(totalDuration / emails.length)}ms`
              : 'N/A',
        });
        resolve(emails);
      });
    });
  }

  fetchEmailById(uid: number): Promise<ImapMessage> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      const fetch = this.imap!.fetch([uid], {
        bodies: '',
        struct: true,
      });

      const emailData: EmailData = {
        uid: null,
        attributes: null,
        body: '',
        headers: null,
      };

      fetch.on('message', (msg: Imap.ImapMessage) => {
        msg.on('body', (stream: NodeJS.ReadableStream) => {
          let buffer = '';
          stream.on('data', (chunk: Buffer) => {
            buffer += chunk.toString('utf8');
          });
          stream.once('end', () => {
            emailData.body = buffer;
          });
        });

        msg.once('attributes', (attrs: Imap.MessageAttributes) => {
          emailData.uid = attrs.uid;
          emailData.attributes = attrs;
        });
      });

      fetch.once('error', (err: Error) => {
        logger.error('Fetch error', { uid, error: err.message });
        reject(new ConnectionError(`Fetch error: ${err.message}`));
      });

      fetch.once('end', () => {
        logger.debug('Email fetched', { uid });
        resolve({
          uid: emailData.uid!,
          attributes: emailData.attributes!,
          body: emailData.body,
          headers: emailData.headers,
        });
      });
    });
  }

  async fetchEmailBody(uid: number): Promise<FetchEmailBodyResult> {
    const startTime = Date.now();
    try {
      logger.info('[PERF] Fetching email body on demand', { uid });

      const emailData = await this.fetchEmailById(uid);
      const parsed = await this.parseEmail(emailData);

      logger.info('[PERF] Email body fetched', {
        uid,
        duration: `${Date.now() - startTime}ms`,
        bodyTextSize: `${Math.round((parsed.bodyText?.length || 0) / 1024)}KB`,
        bodyHtmlSize: `${Math.round((parsed.bodyHtml?.length || 0) / 1024)}KB`,
      });

      return {
        bodyText: parsed.bodyText,
        bodyHtml: parsed.bodyHtml,
        attachments: parsed.attachments,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to fetch email body', { uid, error: err.message });
      throw error;
    }
  }

  markAsRead(uid: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      this.imap!.addFlags(uid, ['\\Seen'], (err: Error | null) => {
        if (err) {
          logger.error('Failed to mark as read', { uid, error: err.message });
          return reject(
            new ConnectionError(`Failed to mark as read: ${err.message}`)
          );
        }
        logger.debug('Email marked as read', { uid });
        resolve();
      });
    });
  }

  markAsUnread(uid: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      this.imap!.delFlags(uid, ['\\Seen'], (err: Error | null) => {
        if (err) {
          logger.error('Failed to mark as unread', { uid, error: err.message });
          return reject(
            new ConnectionError(`Failed to mark as unread: ${err.message}`)
          );
        }
        logger.debug('Email marked as unread', { uid });
        resolve();
      });
    });
  }

  moveEmail(uid: number, targetFolder: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      this.imap!.move(uid, targetFolder, (err: Error | null) => {
        if (err) {
          logger.error('Failed to move email', {
            uid,
            targetFolder,
            error: err.message,
          });
          return reject(
            new ConnectionError(`Failed to move email: ${err.message}`)
          );
        }
        logger.debug('Email moved', { uid, targetFolder });
        resolve();
      });
    });
  }

  copyEmail(uid: number, targetFolder: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      this.imap!.copy(uid, targetFolder, (err: Error | null) => {
        if (err) {
          logger.error('Failed to copy email', {
            uid,
            targetFolder,
            error: err.message,
          });
          return reject(
            new ConnectionError(`Failed to copy email: ${err.message}`)
          );
        }
        logger.debug('Email copied', { uid, targetFolder });
        resolve();
      });
    });
  }

  createFolder(folderName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      this.imap!.addBox(folderName, (err: Error | null) => {
        if (err) {
          logger.error('Failed to create folder', {
            folderName,
            error: err.message,
          });
          return reject(
            new ConnectionError(`Failed to create folder: ${err.message}`)
          );
        }
        logger.debug('Folder created on server', { folderName });
        resolve();
      });
    });
  }

  deleteFolder(folderName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      this.imap!.delBox(folderName, (err: Error | null) => {
        if (err) {
          logger.error('Failed to delete folder', {
            folderName,
            error: err.message,
          });
          return reject(
            new ConnectionError(`Failed to delete folder: ${err.message}`)
          );
        }
        logger.debug('Folder deleted from server', { folderName });
        resolve();
      });
    });
  }

  renameFolder(oldName: string, newName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      this.imap!.renameBox(oldName, newName, (err: Error | null) => {
        if (err) {
          logger.error('Failed to rename folder', {
            oldName,
            newName,
            error: err.message,
          });
          return reject(
            new ConnectionError(`Failed to rename folder: ${err.message}`)
          );
        }
        logger.debug('Folder renamed on server', { oldName, newName });
        resolve();
      });
    });
  }

  batchMoveEmails(uids: number[], targetFolder: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      if (!uids || uids.length === 0) {
        return resolve();
      }

      this.imap!.move(uids, targetFolder, (err: Error | null) => {
        if (err) {
          logger.error('Failed to batch move emails', {
            count: uids.length,
            targetFolder,
            error: err.message,
          });
          return reject(
            new ConnectionError(`Failed to batch move emails: ${err.message}`)
          );
        }
        logger.debug('Emails batch moved', {
          count: uids.length,
          targetFolder,
        });
        resolve();
      });
    });
  }

  batchCopyEmails(uids: number[], targetFolder: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      if (!uids || uids.length === 0) {
        return resolve();
      }

      this.imap!.copy(uids, targetFolder, (err: Error | null) => {
        if (err) {
          logger.error('Failed to batch copy emails', {
            count: uids.length,
            targetFolder,
            error: err.message,
          });
          return reject(
            new ConnectionError(`Failed to batch copy emails: ${err.message}`)
          );
        }
        logger.debug('Emails batch copied', {
          count: uids.length,
          targetFolder,
        });
        resolve();
      });
    });
  }

  deleteEmail(uid: number, permanent = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      if (permanent) {
        this.imap!.addFlags(uid, ['\\Deleted'], (err: Error | null) => {
          if (err) {
            logger.error('Failed to mark email for deletion', {
              uid,
              error: err.message,
            });
            return reject(
              new ConnectionError(`Failed to mark for deletion: ${err.message}`)
            );
          }

          this.imap!.expunge((expungeErr: Error | null) => {
            if (expungeErr) {
              logger.error('Failed to expunge email', {
                uid,
                error: expungeErr.message,
              });
              return reject(
                new ConnectionError(`Failed to expunge: ${expungeErr.message}`)
              );
            }
            logger.debug('Email permanently deleted', { uid });
            resolve();
          });
        });
      } else {
        this.moveEmail(uid, 'Trash').then(resolve).catch(reject);
      }
    });
  }

  batchDeleteEmails(uids: number[], permanent = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new ConnectionError('Not connected to IMAP server'));
      }

      if (!uids || uids.length === 0) {
        return resolve();
      }

      if (permanent) {
        this.imap!.addFlags(uids, ['\\Deleted'], (err: Error | null) => {
          if (err) {
            logger.error('Failed to mark emails for deletion', {
              count: uids.length,
              error: err.message,
            });
            return reject(
              new ConnectionError(`Failed to mark for deletion: ${err.message}`)
            );
          }

          this.imap!.expunge((expungeErr: Error | null) => {
            if (expungeErr) {
              logger.error('Failed to expunge emails', {
                count: uids.length,
                error: expungeErr.message,
              });
              return reject(
                new ConnectionError(`Failed to expunge: ${expungeErr.message}`)
              );
            }
            logger.debug('Emails permanently deleted', { count: uids.length });
            resolve();
          });
        });
      } else {
        this.imap!.move(uids, 'Trash', (err: Error | null) => {
          if (err) {
            logger.error('Failed to move emails to trash', {
              count: uids.length,
              error: err.message,
            });
            return reject(
              new ConnectionError(`Failed to move to trash: ${err.message}`)
            );
          }
          logger.debug('Emails moved to trash', { count: uids.length });
          resolve();
        });
      }
    });
  }

  async parseEmail(emailData: ImapMessage): Promise<ParsedEmailResult> {
    const parseStartTime = Date.now();
    try {
      const contentToParse = emailData.body || emailData.headers || '';
      const parsed = await simpleParser(contentToParse);

      const date = parsed.date || new Date();
      const dateString =
        date instanceof Date ? date.toISOString() : String(date);

      const result: ParsedEmailResult = {
        uid: emailData.uid,
        messageId: parsed.messageId || undefined,
        from: Array.isArray(parsed.from)
          ? parsed.from.map((f) => f.text).join(', ')
          : parsed.from?.text || '',
        to: Array.isArray(parsed.to)
          ? parsed.to.map((t) => t.text).join(', ')
          : parsed.to?.text || '',
        cc: Array.isArray(parsed.cc)
          ? parsed.cc.map((c) => c.text).join(', ')
          : parsed.cc?.text || '',
        subject: parsed.subject || '',
        date: dateString,
        bodyText: parsed.text || '',
        bodyHtml: parsed.html || '',
        attachments: parsed.attachments || [],
        flags: emailData.attributes?.flags || [],
      };

      logger.debug('[PERF] Email parsing completed', {
        uid: emailData.uid,
        duration: `${Date.now() - parseStartTime}ms`,
        mode: emailData.body ? 'full' : 'headers-only',
        bodyTextSize: result.bodyText
          ? `${Math.round(result.bodyText.length / 1024)}KB`
          : '0KB',
        bodyHtmlSize: result.bodyHtml
          ? `${Math.round(result.bodyHtml.length / 1024)}KB`
          : '0KB',
        attachmentCount: result.attachments.length,
      });

      return result;
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to parse email', { error: err.message });
      throw error;
    }
  }

  private _flattenBoxes(boxes: Boxes, prefix = ''): ImapFolder[] {
    const folders: ImapFolder[] = [];
    for (const [name, box] of Object.entries(boxes)) {
      const fullName = prefix ? `${prefix}${box.delimiter}${name}` : name;
      folders.push({
        name: fullName,
        delimiter: box.delimiter,
        flags: box.attribs || [],
      });
      const boxWithChildren = box as BoxWithChildren;
      if (boxWithChildren.children) {
        folders.push(...this._flattenBoxes(boxWithChildren.children, fullName));
      }
    }
    return folders;
  }
}

export default IMAPClient;
