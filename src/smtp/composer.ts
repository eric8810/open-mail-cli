import fs from 'fs';
import path from 'path';

import type { Signature } from '../types/index';

import logger from '../utils/logger';

interface EmailData {
  from: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  html: string;
  attachments: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
  }>;
  inReplyTo: string | null;
  references: string | null;
}

interface OriginalEmail {
  date: string;
  from: string;
  bodyText: string;
  to?: string;
  cc?: string;
  references?: string;
  messageId?: string;
}

class EmailComposer {
  private emailData: EmailData;

  constructor() {
    this.emailData = {
      from: null,
      to: [],
      cc: [],
      bcc: [],
      subject: '',
      text: '',
      html: '',
      attachments: [],
      inReplyTo: null,
      references: null,
    };
  }

  setFrom(address: string): this {
    this.emailData.from = address;
    return this;
  }

  setTo(addresses: string | string[]): this {
    this.emailData.to = Array.isArray(addresses) ? addresses : [addresses];
    return this;
  }

  setCc(addresses: string | string[]): this {
    this.emailData.cc = Array.isArray(addresses) ? addresses : [addresses];
    return this;
  }

  setBcc(addresses: string | string[]): this {
    this.emailData.bcc = Array.isArray(addresses) ? addresses : [addresses];
    return this;
  }

  setSubject(subject: string): this {
    this.emailData.subject = subject;
    return this;
  }

  setBody(text: string, html: string | null = null): this {
    this.emailData.text = text;
    if (html) {
      this.emailData.html = html;
    }
    return this;
  }

  addAttachment(filePath: string, filename: string | null = null): this {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const attachmentName = filename || path.basename(filePath);
      this.emailData.attachments.push({
        filename: attachmentName,
        path: filePath,
      });

      logger.debug('Attachment added', { filename: attachmentName });
      return this;
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to add attachment', {
        filePath,
        error: err.message,
      });
      throw error;
    }
  }

  addAttachmentFromBuffer(
    buffer: Buffer,
    filename: string,
    contentType = 'application/octet-stream'
  ): this {
    this.emailData.attachments.push({
      filename,
      content: buffer,
      contentType,
    });
    logger.debug('Attachment added from buffer', { filename });
    return this;
  }

  compose(): EmailData {
    if (!this.emailData.to || this.emailData.to.length === 0) {
      throw new Error('Recipient (to) is required');
    }

    if (!this.emailData.subject) {
      throw new Error('Subject is required');
    }

    if (!this.emailData.text && !this.emailData.html) {
      throw new Error('Email body (text or html) is required');
    }

    logger.debug('Email composed', {
      to: this.emailData.to,
      subject: this.emailData.subject,
      attachments: this.emailData.attachments.length,
    });

    return { ...this.emailData };
  }

  setInReplyTo(messageId: string): this {
    this.emailData.inReplyTo = messageId;
    return this;
  }

  setReferences(references: string): this {
    this.emailData.references = references;
    return this;
  }

  quoteOriginalEmail(originalEmail: OriginalEmail): string {
    const header = `On ${originalEmail.date}, ${originalEmail.from} wrote:\n\n`;
    const quoted = originalEmail.bodyText
      .split('\n')
      .map((line) => '> ' + line)
      .join('\n');
    return header + quoted;
  }

  buildReferences(originalEmail: OriginalEmail): string {
    const refs: string[] = [];
    if (originalEmail.references) {
      refs.push(originalEmail.references);
    }
    if (originalEmail.messageId) {
      refs.push(originalEmail.messageId);
    }
    return refs.join(' ');
  }

  getAllRecipients(originalEmail: OriginalEmail, selfEmail: string): string[] {
    const recipients: string[] = [];

    if (originalEmail.from && originalEmail.from !== selfEmail) {
      recipients.push(originalEmail.from);
    }

    if (originalEmail.to) {
      const toAddresses = originalEmail.to.split(',').map((e) => e.trim());
      toAddresses.forEach((addr) => {
        if (addr && addr !== selfEmail && !recipients.includes(addr)) {
          recipients.push(addr);
        }
      });
    }

    if (originalEmail.cc) {
      const ccAddresses = originalEmail.cc.split(',').map((e) => e.trim());
      ccAddresses.forEach((addr) => {
        if (addr && addr !== selfEmail && !recipients.includes(addr)) {
          recipients.push(addr);
        }
      });
    }

    return recipients;
  }

  addSignature(signature: Signature | null): this {
    if (!signature) {
      return this;
    }

    if (signature.contentHtml && this.emailData.html) {
      this.emailData.html += '\n\n' + signature.contentHtml;
    } else if (signature.contentHtml && !this.emailData.html) {
      this.emailData.html = signature.contentHtml;
    }

    if (signature.contentText) {
      this.emailData.text += '\n\n' + signature.contentText;
    }

    logger.debug('Signature added to email');
    return this;
  }

  reset(): this {
    this.emailData = {
      from: null,
      to: [],
      cc: [],
      bcc: [],
      subject: '',
      text: '',
      html: '',
      attachments: [],
      inReplyTo: null,
      references: null,
    };
    return this;
  }
}

export default EmailComposer;
