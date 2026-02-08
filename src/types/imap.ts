/**
 * IMAP client connection configuration.
 */
export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  tls?: boolean;
  connTimeout?: number;
  authTimeout?: number;
  tlsOptions?: {
    rejectUnauthorized?: boolean;
  };
}

/**
 * IMAP folder structure.
 */
export interface ImapFolder {
  name: string;
  delimiter: string;
  flags: string[];
}

/**
 * IMAP message attributes payload.
 */
export interface ImapMessageAttributes {
  uid: number;
  flags?: string[];
  date?: Date;
  [key: string]: unknown;
}

/**
 * Minimal IMAP message shape used by sync and parsing flows.
 */
export interface ImapMessage {
  uid: number;
  seqno?: number;
  subject?: string;
  from?: string;
  to?: string;
  cc?: string;
  date?: Date;
  body?: string;
  headers?: string | null;
  attributes?: ImapMessageAttributes;
}

/**
 * IMAP fetch options used during synchronization.
 */
export interface ImapFetchOptions {
  bodies?: string | string[];
  struct?: boolean;
  markSeen?: boolean;
  envelope?: boolean;
  size?: boolean;
}
