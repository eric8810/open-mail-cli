#!/usr/bin/env node

import createCLI from './cli/index';
import database from './storage/database';
import logger from './utils/logger';

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    database.initialize();

    const program = createCLI();
    await program.parseAsync(process.argv);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Application error', { error: errorMessage });
    console.error('Fatal error:', errorMessage);
    process.exit(1);
  }
}

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error: error.message });
  console.error('Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

main();
