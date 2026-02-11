/**
 * Event type constants for the mail client event system.
 */
export const EventTypes = {
  EMAIL_RECEIVED: 'email:received',
  EMAIL_SENT: 'email:sent',
  EMAIL_READ: 'email:read',
  EMAIL_DELETED: 'email:deleted',
  EMAIL_STARRED: 'email:starred',
  EMAIL_FLAGGED: 'email:flagged',
  SYNC_COMPLETED: 'sync:completed',
  SYNC_ERROR: 'sync:error',
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];

/**
 * Core event payload emitted by the event bus.
 */
export interface MailEvent {
  type: EventType | string;
  timestamp: Date;
  data: Record<string, unknown>;
  accountId?: string;
}

/**
 * Webhook configuration stored in the config file.
 */
export interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  enabled: boolean;
  retryCount?: number;
}

/**
 * Script trigger configuration.
 */
export interface ScriptTriggerConfig {
  id: string;
  command: string;
  events: string[];
  enabled: boolean;
  timeout?: number;
}
