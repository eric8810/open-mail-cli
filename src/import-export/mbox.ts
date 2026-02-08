import { promises as fs } from 'fs';

import { simpleParser } from 'mailparser';

import { StorageError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * MBOX Format Handler
 * Handles parsing and generating MBOX format mailboxes
 */
class MboxHandler {
  /**
   * Parse MBOX file
   * @param {string} filePath - Path to MBOX file
   * @param {Function} onEmail - Callback for each parsed email
   * @returns {Promise<number>} Number of emails parsed
   */
  async parse(filePath, onEmail) {
    try {
      logger.debug('Parsing MBOX file', { filePath });

      const mboxContent = await fs.readFile(filePath, 'utf8');
      const emails = this._splitMboxMessages(mboxContent);

      let count = 0;
      for (const emailContent of emails) {
        try {
          const parsed = await simpleParser(emailContent);

          const emailData = {
            messageId: parsed.messageId,
            from: this._formatAddress(parsed.from),
            to: this._formatAddress(parsed.to),
            cc: this._formatAddress(parsed.cc),
            bcc: this._formatAddress(parsed.bcc),
            subject: parsed.subject || '(No Subject)',
            date: parsed.date
              ? parsed.date.toISOString()
              : new Date().toISOString(),
            bodyText: parsed.text || '',
            bodyHtml: parsed.html || '',
            headers: parsed.headers,
            attachments: [],
          };

          // Process attachments
          if (parsed.attachments && parsed.attachments.length > 0) {
            emailData.attachments = parsed.attachments.map((att) => ({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
              content: att.content,
            }));
          }

          await onEmail(emailData);
          count++;
        } catch (error) {
          logger.warn('Failed to parse email in MBOX', {
            error: error.message,
          });
        }
      }

      logger.info('MBOX file parsed successfully', { filePath, count });
      return count;
    } catch (error) {
      logger.error('Failed to parse MBOX file', {
        filePath,
        error: error.message,
      });
      throw new StorageError(`Failed to parse MBOX file: ${error.message}`);
    }
  }

  /**
   * Generate MBOX file from emails
   * @param {Array<Object>} emails - Array of email data
   * @param {string} filePath - Output file path
   * @returns {Promise<void>}
   */
  async generate(emails, filePath) {
    try {
      logger.debug('Generating MBOX file', { filePath, count: emails.length });

      const mboxContent = this._buildMboxContent(emails);
      await fs.writeFile(filePath, mboxContent, 'utf8');

      logger.info('MBOX file generated successfully', {
        filePath,
        count: emails.length,
      });
    } catch (error) {
      logger.error('Failed to generate MBOX file', {
        filePath,
        error: error.message,
      });
      throw new StorageError(`Failed to generate MBOX file: ${error.message}`);
    }
  }

  /**
   * Append email to existing MBOX file
   * @param {Object} emailData - Email data
   * @param {string} filePath - MBOX file path
   * @returns {Promise<void>}
   */
  async append(emailData, filePath) {
    try {
      const emailContent = this._buildEmailContent(emailData);
      const mboxEntry = this._wrapInMboxFormat(emailContent, emailData.date);

      await fs.appendFile(filePath, mboxEntry, 'utf8');

      logger.debug('Email appended to MBOX', { filePath });
    } catch (error) {
      logger.error('Failed to append to MBOX file', {
        filePath,
        error: error.message,
      });
      throw new StorageError(`Failed to append to MBOX file: ${error.message}`);
    }
  }

  /**
   * Split MBOX content into individual messages
   * @param {string} mboxContent - MBOX file content
   * @returns {Array<string>} Array of email contents
   */
  _splitMboxMessages(mboxContent) {
    const messages = [];
    const lines = mboxContent.split('\n');
    let currentMessage = [];
    let inMessage = false;

    for (const line of lines) {
      // MBOX format: messages start with "From " line
      if (line.startsWith('From ') && inMessage) {
        // Save previous message
        messages.push(currentMessage.join('\n'));
        currentMessage = [];
      } else if (line.startsWith('From ')) {
        inMessage = true;
        continue; // Skip the "From " line
      }

      if (inMessage) {
        currentMessage.push(line);
      }
    }

    // Add last message
    if (currentMessage.length > 0) {
      messages.push(currentMessage.join('\n'));
    }

    return messages;
  }

  /**
   * Build MBOX content from emails
   * @param {Array<Object>} emails - Array of email data
   * @returns {string} MBOX content
   */
  _buildMboxContent(emails) {
    const entries = emails.map((email) => {
      const emailContent = this._buildEmailContent(email);
      return this._wrapInMboxFormat(emailContent, email.date);
    });

    return entries.join('');
  }

  /**
   * Build email content
   * @param {Object} emailData - Email data
   * @returns {string} Email content
   */
  _buildEmailContent(emailData) {
    const lines = [];

    // Add headers
    if (emailData.messageId) {
      lines.push(`Message-ID: ${emailData.messageId}`);
    }
    if (emailData.date) {
      const date = new Date(emailData.date);
      lines.push(`Date: ${date.toUTCString()}`);
    }
    if (emailData.from) {
      lines.push(`From: ${emailData.from}`);
    }
    if (emailData.to) {
      lines.push(`To: ${emailData.to}`);
    }
    if (emailData.cc) {
      lines.push(`Cc: ${emailData.cc}`);
    }
    if (emailData.subject) {
      lines.push(`Subject: ${emailData.subject}`);
    }

    // Add MIME headers
    lines.push('MIME-Version: 1.0');

    if (emailData.bodyHtml && emailData.bodyText) {
      // Multipart alternative
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      lines.push('');
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/plain; charset=utf-8');
      lines.push('');
      lines.push(emailData.bodyText);
      lines.push('');
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/html; charset=utf-8');
      lines.push('');
      lines.push(emailData.bodyHtml);
      lines.push('');
      lines.push(`--${boundary}--`);
    } else if (emailData.bodyHtml) {
      lines.push('Content-Type: text/html; charset=utf-8');
      lines.push('');
      lines.push(emailData.bodyHtml);
    } else {
      lines.push('Content-Type: text/plain; charset=utf-8');
      lines.push('');
      lines.push(emailData.bodyText || '');
    }

    return lines.join('\r\n');
  }

  /**
   * Wrap email content in MBOX format
   * @param {string} emailContent - Email content
   * @param {string} date - Email date
   * @returns {string} MBOX formatted entry
   */
  _wrapInMboxFormat(emailContent, date) {
    const emailDate = date ? new Date(date) : new Date();
    const fromLine = `From MAILER-DAEMON ${emailDate.toString()}\r\n`;

    // Escape lines starting with "From " (MBOX requirement)
    const escapedContent = emailContent.replace(/^From /gm, '>From ');

    return fromLine + escapedContent + '\r\n\r\n';
  }

  /**
   * Format address for display
   * @param {Object|Array} address - Address object or array
   * @returns {string} Formatted address
   */
  _formatAddress(address) {
    if (!address) return '';

    if (Array.isArray(address)) {
      return address
        .map((addr) => {
          if (addr.name) {
            return `"${addr.name}" <${addr.address}>`;
          }
          return addr.address;
        })
        .join(', ');
    }

    if (address.value && Array.isArray(address.value)) {
      return this._formatAddress(address.value);
    }

    if (address.name) {
      return `"${address.name}" <${address.address}>`;
    }

    return address.address || address.toString();
  }
}

module.exports = new MboxHandler();
