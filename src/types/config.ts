import type { ImapConfig } from './imap';
import type { SmtpConfig } from './smtp';

/**
 * Application-level behavior options.
 */
export interface GeneralConfig {
  logLevel?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  syncInterval?: number;
  defaultFolder?: string;
  notificationEnabled?: boolean;
  [key: string]: unknown;
}

/**
 * Root application configuration object.
 */
export interface AppConfig {
  imap: ImapConfig;
  smtp: SmtpConfig;
  general?: GeneralConfig;
}
