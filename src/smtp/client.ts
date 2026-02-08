import nodemailer from 'nodemailer';

import type { SmtpConfig, EmailSendData } from '../types/smtp';

import { ConnectionError, AuthenticationError } from '../utils/errors';
import logger from '../utils/logger';

class SMTPClient {
  private config: SmtpConfig;
  private transporter: nodemailer.Transporter | null;

  constructor(config: SmtpConfig) {
    this.config = config;
    this.transporter = null;
  }

  async connect(): Promise<boolean> {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.password,
        },
      });

      await this.transporter.verify();
      logger.info('SMTP connection established', { host: this.config.host });
      return true;
    } catch (error) {
      const err = error as Error;
      logger.error('SMTP connection failed', { error: err.message });
      if (err.message.includes('auth')) {
        throw new AuthenticationError(`Authentication failed: ${err.message}`);
      } else {
        throw new ConnectionError(`Connection failed: ${err.message}`);
      }
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      if (!this.transporter) {
        await this.connect();
      }
      await this.transporter!.verify();
      return true;
    } catch (error) {
      const err = error as Error;
      logger.error('SMTP verification failed', { error: err.message });
      throw new ConnectionError(`Verification failed: ${err.message}`);
    }
  }

  async sendEmail(
    emailData: EmailSendData
  ): Promise<{ success: boolean; messageId: string; response: string }> {
    try {
      if (!this.transporter) {
        await this.connect();
      }

      const mailOptions: nodemailer.SendMailOptions = {
        from: emailData.from || this.config.user,
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        attachments: emailData.attachments,
        inReplyTo: emailData.inReplyTo,
        references: emailData.references,
      };

      const info = await this.transporter!.sendMail(mailOptions);
      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: emailData.to,
      });
      return {
        success: true,
        messageId: info.messageId || '',
        response: info.response || '',
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to send email', { error: err.message });
      throw new ConnectionError(`Failed to send email: ${err.message}`);
    }
  }

  disconnect(): void {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
      logger.info('SMTP connection closed');
    }
  }
}

export default SMTPClient;
