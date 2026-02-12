import chalk from 'chalk';

import {
  AuthenticationError,
  ConfigError,
  ConnectionError,
  MailClientError,
  ValidationError,
} from '../../utils/errors';
import logger from '../../utils/logger';

/**
 * Map error types to CLI exit codes.
 *
 * 0 = success
 * 1 = general error
 * 2 = parameter / validation error
 * 3 = network / connection error
 * 4 = authentication error
 * 5 = permission error
 */
export function getExitCode(error: unknown): number {
  if (error instanceof ValidationError || error instanceof ConfigError) {
    return 2;
  }
  if (error instanceof ConnectionError) {
    return 3;
  }
  if (error instanceof AuthenticationError) {
    return 4;
  }
  // Any other MailClientError or unknown → general
  return 1;
}

/**
 * Unified command error handler.
 *
 * Outputs the error in the requested format (JSON for machine consumers,
 * chalk-coloured text for humans), logs it, and exits with the appropriate
 * exit code.
 */
export function handleCommandError(error: unknown, format?: string): never {
  const err = error instanceof Error ? error : new Error(String(error));
  const code = error instanceof MailClientError ? error.code : 'UNKNOWN_ERROR';
  const exitCode = getExitCode(error);

  if (format === 'json') {
    console.error(JSON.stringify({ error: { code, message: err.message } }));
  } else {
    console.error(chalk.red('Error:'), err.message);
  }

  logger.error(err.message, { code, exitCode });
  process.exit(exitCode);
}
