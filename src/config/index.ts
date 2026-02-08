import fs from 'node:fs';
import path from 'node:path';

import defaults, { type DefaultConfig } from './defaults';
import { validateConfig, type ConfigValidationResult } from './schema';
import { ConfigError } from '../utils/errors';
import { decrypt, encrypt, getConfigDir } from '../utils/helpers';
import logger from '../utils/logger';

/**
 * Runtime guard for object-like values.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Convert unknown error payload to displayable message.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Create deep clone for config objects.
 */
function cloneConfig(config: DefaultConfig): DefaultConfig {
  return JSON.parse(JSON.stringify(config)) as DefaultConfig;
}

/**
 * Merge persisted config with defaults.
 */
function mergeWithDefaults(config: Partial<DefaultConfig>): DefaultConfig {
  return {
    ...defaults,
    ...config,
    imap: {
      ...defaults.imap,
      ...(config.imap ?? {}),
    },
    smtp: {
      ...defaults.smtp,
      ...(config.smtp ?? {}),
    },
    storage: {
      ...defaults.storage,
      ...(config.storage ?? {}),
    },
    sync: {
      ...defaults.sync,
      ...(config.sync ?? {}),
    },
    notifications: {
      ...defaults.notifications,
      ...(config.notifications ?? {}),
      filters: {
        ...defaults.notifications.filters,
        ...(config.notifications?.filters ?? {}),
      },
    },
  };
}

/**
 * Configuration Manager.
 * Handles loading, saving, and validating configuration.
 */
export class ConfigManager {
  private configDir: string;
  private configFile: string;
  private config: DefaultConfig | null;

  /**
   * Create config manager.
   */
  constructor(configDir: string | null = null) {
    this.configDir = configDir ?? getConfigDir();
    this.configFile = path.join(this.configDir, 'config.json');
    this.config = null;
  }

  /**
   * Ensure config directory exists.
   */
  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
      logger.info('Created config directory', { path: this.configDir });
    }
  }

  /**
   * Load configuration from file.
   */
  load(): DefaultConfig {
    try {
      if (!fs.existsSync(this.configFile)) {
        logger.info('Config file not found, using defaults');
        this.config = cloneConfig(defaults);
        return this.config;
      }

      const data = fs.readFileSync(this.configFile, 'utf8');
      const parsedConfig = JSON.parse(data) as Partial<DefaultConfig>;
      const loadedConfig = mergeWithDefaults(parsedConfig);

      if (
        typeof loadedConfig.imap.password === 'string' &&
        loadedConfig.imap.password.length > 0
      ) {
        loadedConfig.imap.password = this.decrypt(loadedConfig.imap.password);
      }
      if (
        typeof loadedConfig.smtp.password === 'string' &&
        loadedConfig.smtp.password.length > 0
      ) {
        loadedConfig.smtp.password = this.decrypt(loadedConfig.smtp.password);
      }

      this.config = loadedConfig;
      logger.info('Configuration loaded successfully');
      return this.config;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to load configuration', { error: errorMessage });
      throw new ConfigError(`Failed to load configuration: ${errorMessage}`);
    }
  }

  /**
   * Save configuration to file.
   */
  save(config: DefaultConfig | null = null): boolean {
    try {
      this.ensureConfigDir();

      const configToSave = config ?? this.config;
      if (!configToSave) {
        throw new ConfigError('No configuration to save');
      }

      const validation = this.validate(configToSave);
      if (!validation.valid) {
        throw new ConfigError(
          `Invalid configuration: ${validation.errors.join(', ')}`
        );
      }

      const encryptedConfig = cloneConfig(configToSave);
      if (encryptedConfig.imap.password) {
        encryptedConfig.imap.password = this.encrypt(
          encryptedConfig.imap.password
        );
      }
      if (encryptedConfig.smtp.password) {
        encryptedConfig.smtp.password = this.encrypt(
          encryptedConfig.smtp.password
        );
      }

      fs.writeFileSync(
        this.configFile,
        JSON.stringify(encryptedConfig, null, 2)
      );
      this.config = configToSave;
      logger.info('Configuration saved successfully');
      return true;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Failed to save configuration', { error: errorMessage });
      throw new ConfigError(`Failed to save configuration: ${errorMessage}`);
    }
  }

  /**
   * Get configuration value by dot-separated key.
   */
  get<T = unknown>(key: string): T | undefined {
    if (!this.config) {
      this.load();
    }

    const keys = key.split('.');
    let value: unknown = this.config;

    for (const currentKey of keys) {
      if (!isRecord(value)) {
        return undefined;
      }
      value = value[currentKey];
    }

    return value as T;
  }

  /**
   * Set configuration value by dot-separated key.
   */
  set(key: string, value: unknown): void {
    if (!this.config) {
      this.load();
    }

    if (!this.config) {
      return;
    }

    const keys = key.split('.');
    let target: Record<string, unknown> = this.config as unknown as Record<
      string,
      unknown
    >;

    for (let index = 0; index < keys.length - 1; index += 1) {
      const segment = keys[index];
      const currentValue = target[segment];

      if (!isRecord(currentValue)) {
        target[segment] = {};
      }

      target = target[segment] as Record<string, unknown>;
    }

    target[keys[keys.length - 1]] = value;
  }

  /**
   * Validate configuration.
   */
  validate(config: DefaultConfig | null = null): ConfigValidationResult {
    const configToValidate = config ?? this.config;
    return validateConfig(configToValidate);
  }

  /**
   * Encrypt sensitive data.
   */
  encrypt(value: string): string {
    return encrypt(value);
  }

  /**
   * Decrypt sensitive data.
   */
  decrypt(value: string): string {
    return decrypt(value);
  }

  /**
   * Check if configuration exists on disk.
   */
  exists(): boolean {
    return fs.existsSync(this.configFile);
  }
}

const configManager = new ConfigManager();

// Keep CommonJS require() callers working during migration.
export function load(): DefaultConfig {
  return configManager.load();
}

export function save(config: DefaultConfig | null = null): boolean {
  return configManager.save(config);
}

export function get<T = unknown>(key: string): T | undefined {
  return configManager.get<T>(key);
}

export function set(key: string, value: unknown): void {
  configManager.set(key, value);
}

export function validate(
  config: DefaultConfig | null = null
): ConfigValidationResult {
  return configManager.validate(config);
}

export function encryptValue(value: string): string {
  return configManager.encrypt(value);
}

export function decryptValue(value: string): string {
  return configManager.decrypt(value);
}

export function exists(): boolean {
  return configManager.exists();
}

export default configManager;
