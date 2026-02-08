/**
 * SMTP client connection configuration.
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

/**
 * Attachment payload accepted by SMTP sender.
 */
export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
  cid?: string;
}

/**
 * Outbound email payload used by send/reply/forward flows.
 */
export interface EmailSendData {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string | string[];
}
