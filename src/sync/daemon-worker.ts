#!/usr/bin/env node
// @ts-nocheck

/**
 * Sync Daemon Worker
 * Background process that runs automatic email synchronization
 */

import SyncScheduler from './scheduler';
import logger from '../utils/logger';

// Parse options from command line
const optionsArg = process.argv[2];
let options = {};

try {
  if (optionsArg) {
    options = JSON.parse(optionsArg);
  }
} catch (error) {
  console.error('Failed to parse daemon options:', error.message);
  process.exit(1);
}

// Create scheduler
const scheduler = new SyncScheduler(options);

// Setup event handlers
scheduler.on('started', (info) => {
  logger.info('[DAEMON] Scheduler started', info);
  console.log(
    `[${new Date().toISOString()}] Daemon started - interval: ${info.interval}ms, folders: ${info.folders.join(', ')}`
  );
});

scheduler.on('sync-start', (info) => {
  logger.info('[DAEMON] Sync started', info);
  console.log(
    `[${new Date().toISOString()}] Sync started - folders: ${info.folders.join(', ')}`
  );
});

scheduler.on('sync-complete', (result) => {
  logger.info('[DAEMON] Sync completed', result);
  console.log(
    `[${new Date().toISOString()}] Sync completed - new: ${result.totalNew}, errors: ${result.totalErrors}, duration: ${result.duration}ms`
  );
});

scheduler.on('sync-error', (error) => {
  logger.error('[DAEMON] Sync failed', error);
  console.error(`[${new Date().toISOString()}] Sync failed - ${error.error}`);
});

scheduler.on('stopped', () => {
  logger.info('[DAEMON] Scheduler stopped');
  console.log(`[${new Date().toISOString()}] Daemon stopped`);
  process.exit(0);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('[DAEMON] Received SIGTERM, shutting down gracefully');
  console.log(
    `[${new Date().toISOString()}] Received SIGTERM, shutting down...`
  );
  scheduler.stop();
});

process.on('SIGINT', () => {
  logger.info('[DAEMON] Received SIGINT, shutting down gracefully');
  console.log(
    `[${new Date().toISOString()}] Received SIGINT, shutting down...`
  );
  scheduler.stop();
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('[DAEMON] Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  console.error(
    `[${new Date().toISOString()}] Uncaught exception: ${error.message}`
  );
  scheduler.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[DAEMON] Unhandled rejection', { reason });
  console.error(`[${new Date().toISOString()}] Unhandled rejection: ${reason}`);
});

// Start scheduler
(async () => {
  try {
    console.log(`[${new Date().toISOString()}] Starting sync daemon...`);
    await scheduler.start();
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Failed to start daemon: ${error.message}`
    );
    logger.error('[DAEMON] Failed to start', { error: error.message });
    process.exit(1);
  }
})();
