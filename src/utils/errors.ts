/**
 * Base class for mail client errors.
 */
export class MailClientError extends Error {
  code: string;

  /**
   * Create a typed mail client error.
   */
  constructor(message: string, code = 'MAIL_CLIENT_ERROR') {
    super(message);
    this.name = 'MailClientError';
    this.code = code;
    Error.captureStackTrace?.(this, new.target);
  }
}

/**
 * Configuration-related failure.
 */
export class ConfigError extends MailClientError {
  /**
   * Create a config error instance.
   */
  constructor(message: string, code = 'CONFIG_ERROR') {
    super(message, code);
    this.name = 'ConfigError';
  }
}

/**
 * Network connection failure.
 */
export class ConnectionError extends MailClientError {
  /**
   * Create a connection error instance.
   */
  constructor(message: string, code = 'CONNECTION_ERROR') {
    super(message, code);
    this.name = 'ConnectionError';
  }
}

/**
 * Authentication failure.
 */
export class AuthenticationError extends MailClientError {
  /**
   * Create an authentication error instance.
   */
  constructor(message: string, code = 'AUTH_ERROR') {
    super(message, code);
    this.name = 'AuthenticationError';
  }
}

/**
 * Synchronization failure.
 */
export class SyncError extends MailClientError {
  /**
   * Create a sync error instance.
   */
  constructor(message: string, code = 'SYNC_ERROR') {
    super(message, code);
    this.name = 'SyncError';
  }
}

/**
 * Storage read/write failure.
 */
export class StorageError extends MailClientError {
  /**
   * Create a storage error instance.
   */
  constructor(message: string, code = 'STORAGE_ERROR') {
    super(message, code);
    this.name = 'StorageError';
  }
}

/**
 * Validation failure.
 */
export class ValidationError extends MailClientError {
  /**
   * Create a validation error instance.
   */
  constructor(message: string, code = 'VALIDATION_ERROR') {
    super(message, code);
    this.name = 'ValidationError';
  }
}
