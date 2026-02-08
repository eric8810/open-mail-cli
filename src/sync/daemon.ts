import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import { getDataDir } from '../utils/helpers';
import logger from '../utils/logger';

/**
 * Sync Daemon Manager
 * Manages background sync process using child_process
 */
class SyncDaemon {
  constructor() {
    this.dataDir = getDataDir();
    this.pidFile = path.join(this.dataDir, 'sync-daemon.pid');
    this.logFile = path.join(this.dataDir, 'sync-daemon.log');
    this.workerScript = path.join(__dirname, 'daemon-worker.js');
  }

  /**
   * Start daemon process
   */
  async start(options = {}) {
    // Check if already running
    if (this.isRunning()) {
      const pid = this._readPidFile();
      throw new Error(`Daemon already running with PID ${pid}`);
    }

    logger.info('Starting sync daemon', options);

    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Prepare daemon options
    const daemonOptions = {
      interval: options.interval || 300000, // 5 minutes default
      folders: options.folders || ['INBOX'],
      account: options.account || null,
    };

    // Spawn detached child process
    const child = spawn(
      process.execPath,
      [this.workerScript, JSON.stringify(daemonOptions)],
      {
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: process.env,
      }
    );

    // Write PID file
    this._writePidFile(child.pid);

    // Setup log file streaming
    const logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    // Detach from parent
    child.unref();

    logger.info('Sync daemon started', { pid: child.pid });

    return {
      pid: child.pid,
      logFile: this.logFile,
      options: daemonOptions,
    };
  }

  /**
   * Stop daemon process
   */
  async stop() {
    if (!this.isRunning()) {
      throw new Error('Daemon is not running');
    }

    const pid = this._readPidFile();
    logger.info('Stopping sync daemon', { pid });

    try {
      // Send SIGTERM to gracefully stop
      process.kill(pid, 'SIGTERM');

      // Wait for process to exit
      await this._waitForProcessExit(pid, 5000);

      // Remove PID file
      this._removePidFile();

      logger.info('Sync daemon stopped', { pid });
      return { success: true, pid };
    } catch (error) {
      logger.error('Failed to stop daemon', { pid, error: error.message });

      // Try force kill
      try {
        process.kill(pid, 'SIGKILL');
        this._removePidFile();
        logger.warn('Daemon force killed', { pid });
        return { success: true, pid, forcedKill: true };
      } catch (killError) {
        // Process might already be dead
        this._removePidFile();
        throw new Error(`Failed to stop daemon: ${error.message}`);
      }
    }
  }

  /**
   * Get daemon status
   */
  getStatus() {
    const isRunning = this.isRunning();
    const pid = isRunning ? this._readPidFile() : null;

    const status = {
      isRunning,
      pid,
      pidFile: this.pidFile,
      logFile: this.logFile,
    };

    // Get last sync info from log if available
    if (fs.existsSync(this.logFile)) {
      status.logSize = fs.statSync(this.logFile).size;
      status.lastModified = fs.statSync(this.logFile).mtime;
    }

    return status;
  }

  /**
   * Get daemon logs
   */
  getLogs(lines = 50) {
    if (!fs.existsSync(this.logFile)) {
      return '';
    }

    const content = fs.readFileSync(this.logFile, 'utf8');
    const logLines = content.split('\n').filter((line) => line.trim());

    // Return last N lines
    return logLines.slice(-lines).join('\n');
  }

  /**
   * Clear daemon logs
   */
  clearLogs() {
    if (fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, '');
      logger.info('Daemon logs cleared');
    }
  }

  /**
   * Check if daemon is running
   */
  isRunning() {
    if (!fs.existsSync(this.pidFile)) {
      return false;
    }

    const pid = this._readPidFile();
    if (!pid) {
      return false;
    }

    try {
      // Check if process exists (signal 0 doesn't kill, just checks)
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // Process doesn't exist, clean up stale PID file
      this._removePidFile();
      return false;
    }
  }

  /**
   * Write PID file
   * @private
   */
  _writePidFile(pid) {
    fs.writeFileSync(this.pidFile, pid.toString(), 'utf8');
  }

  /**
   * Read PID file
   * @private
   */
  _readPidFile() {
    try {
      const content = fs.readFileSync(this.pidFile, 'utf8');
      return parseInt(content.trim(), 10);
    } catch (error) {
      return null;
    }
  }

  /**
   * Remove PID file
   * @private
   */
  _removePidFile() {
    if (fs.existsSync(this.pidFile)) {
      fs.unlinkSync(this.pidFile);
    }
  }

  /**
   * Wait for process to exit
   * @private
   */
  _waitForProcessExit(pid, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkInterval = 100;

      const check = () => {
        try {
          process.kill(pid, 0);
          // Process still exists
          if (Date.now() - startTime > timeout) {
            reject(new Error('Timeout waiting for process to exit'));
          } else {
            setTimeout(check, checkInterval);
          }
        } catch (error) {
          // Process doesn't exist anymore
          resolve();
        }
      };

      check();
    });
  }
}

module.exports = SyncDaemon;
