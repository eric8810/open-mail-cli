import { promises as fs } from 'fs';

import { simpleParser } from 'mailparser';

import { StorageError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * EML Format Handler
 * Handles parsing and generating EML format emails
 */
class EmlHandler {
  /**
   * Parse EML file
   * @param {string} filePath - Path to EML file
   * @returns {Promise<Object>} Parsed email data
   */
  async parse(filePath) {
    try {
      logger.debug('Parsing EML file', { filePath });

      const emlContent = await fs.readFile(filePath, 'utf8');
      const parsed = await simpleParser(emlContent);

      // Extract email data
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

      logger.debug('EML file parsed successfully', {
        messageId: emailData.messageId,
        attachmentCount: emailData.attachments.length,
      });

      return emailData;
    } catch (error) {
      logger.error('Failed to parse EML file', {
        filePath,
        error: error.message,
      });
      throw new StorageError(`Failed to parse EML file: ${error.message}`);
    }
  }

  /**
   * Generate EML file from email data
   * @param {Object} emailData - Email data
   * @param {string} filePath - Output file path
   * @returns {Promise<void>}
   */
  async generate(emailData, filePath) {
    try {
      logger.debug('Generating EML file', { filePath });

      const emlContent = this._buildEmlContent(emailData);
      await fs.writeFile(filePath, emlContent, 'utf8');

      logger.info('EML file generated successfully', { filePath });
    } catch (error) {
      logger.error('Failed to generate EML file', {
        filePath,
        error: error.message,
      });
      throw new StorageError(`Failed to generate EML file: ${error.message}`);
    }
  }

  /**
   * Build EML content from email data
   * @param {Object} emailData - Email data
   * @returns {string} EML content
   */
  _buildEmlContent(emailData) {
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
      lines.push('Content-Transfer-Encoding: 8bit');
      lines.push('');
      lines.push(emailData.bodyText);
      lines.push('');
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/html; charset=utf-8');
      lines.push('Content-Transfer-Encoding: 8bit');
      lines.push('');
      lines.push(emailData.bodyHtml);
      lines.push('');
      lines.push(`--${boundary}--`);
    } else if (emailData.bodyHtml) {
      // HTML only
      lines.push('Content-Type: text/html; charset=utf-8');
      lines.push('Content-Transfer-Encoding: 8bit');
      lines.push('');
      lines.push(emailData.bodyHtml);
    } else {
      // Plain text only
      lines.push('Content-Type: text/plain; charset=utf-8');
      lines.push('Content-Transfer-Encoding: 8bit');
      lines.push('');
      lines.push(emailData.bodyText || '');
    }

    return lines.join('\r\n');
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

module.exports = new EmlHandler();
