import type { DefaultConfig } from './defaults';

/**
 * Validation output for configuration payloads.
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Runtime guard for object-like values.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Read a string property from an unknown object.
 */
function getStringField(
  source: Record<string, unknown>,
  key: string
): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Read a number property from an unknown object.
 */
function getNumberField(
  source: Record<string, unknown>,
  key: string
): number | undefined {
  const value = source[key];
  return typeof value === 'number' ? value : undefined;
}

/**
 * Configuration schema validation.
 */
export function validateConfig(
  config: Partial<DefaultConfig> | unknown
): ConfigValidationResult {
  const errors: string[] = [];

  if (!isRecord(config)) {
    return {
      valid: false,
      errors: ['Config must be an object'],
    };
  }

  const imap = isRecord(config.imap) ? config.imap : null;
  const smtp = isRecord(config.smtp) ? config.smtp : null;

  if (imap) {
    if (!getStringField(imap, 'host')) {
      errors.push('IMAP host is required');
    }
    if (!getStringField(imap, 'user')) {
      errors.push('IMAP user is required');
    }
    if (!getStringField(imap, 'password')) {
      errors.push('IMAP password is required');
    }

    const imapPort = getNumberField(imap, 'port');
    if (imapPort === undefined || imapPort < 1 || imapPort > 65535) {
      errors.push('IMAP port must be between 1 and 65535');
    }
  }

  if (smtp) {
    if (!getStringField(smtp, 'host')) {
      errors.push('SMTP host is required');
    }
    if (!getStringField(smtp, 'user')) {
      errors.push('SMTP user is required');
    }
    if (!getStringField(smtp, 'password')) {
      errors.push('SMTP password is required');
    }

    const smtpPort = getNumberField(smtp, 'port');
    if (smtpPort === undefined || smtpPort < 1 || smtpPort > 65535) {
      errors.push('SMTP port must be between 1 and 65535');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
