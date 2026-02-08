import type { AppConfig } from '../types/config';

/**
 * Storage-level runtime options.
 */
export interface StorageConfig {
  dataDir: string;
  maxAttachmentSize: number;
}

/**
 * Sync runtime options.
 */
export interface SyncConfig {
  autoSync: boolean;
  syncInterval: number;
  folders: string[];
  enableDaemon: boolean;
  selectiveSyncEnabled: boolean;
  syncSince: string | null;
  concurrentFolders: number;
  retryOnError: boolean;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Notification filtering options.
 */
export interface NotificationFiltersConfig {
  senders: string[];
  tags: string[];
  importantOnly: boolean;
}

/**
 * Notification runtime options.
 */
export interface NotificationsConfig {
  enabled: boolean;
  desktop: boolean;
  sound: boolean;
  filters: NotificationFiltersConfig;
}

/**
 * Full runtime configuration shape.
 */
export interface DefaultConfig extends AppConfig {
  storage: StorageConfig;
  sync: SyncConfig;
  notifications: NotificationsConfig;
}

/**
 * Default configuration values.
 */
const defaults: DefaultConfig = {
  imap: {
    host: '',
    port: 993,
    secure: true,
    user: '',
    password: '',
  },
  smtp: {
    host: '',
    port: 465,
    secure: true,
    user: '',
    password: '',
  },
  storage: {
    dataDir: './data',
    maxAttachmentSize: 10 * 1024 * 1024,
  },
  sync: {
    autoSync: false,
    syncInterval: 300000,
    folders: ['INBOX'],
    enableDaemon: false,
    selectiveSyncEnabled: false,
    syncSince: null,
    concurrentFolders: 3,
    retryOnError: true,
    maxRetries: 3,
    retryDelay: 5000,
  },
  notifications: {
    enabled: false,
    desktop: true,
    sound: true,
    filters: {
      senders: [],
      tags: [],
      importantOnly: false,
    },
  },
};

export default defaults;
