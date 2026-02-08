import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ConfigManager } from '../../src/config/index.ts';

describe('config manager', () => {
  let tempDir = '';
  let manager: ConfigManager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-cli-config-'));
    manager = new ConfigManager(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads defaults when config file does not exist', () => {
    const config = manager.load();

    expect(config.imap.port).toBe(993);
    expect(config.smtp.port).toBe(465);
    expect(manager.exists()).toBe(false);
  });

  it('saves encrypted secrets and reloads decrypted values', () => {
    const baseConfig = manager.load();
    const config = {
      ...baseConfig,
      imap: {
        ...baseConfig.imap,
        host: 'imap.example.com',
        user: 'imap-user',
        password: 'imap-secret',
      },
      smtp: {
        ...baseConfig.smtp,
        host: 'smtp.example.com',
        user: 'smtp-user',
        password: 'smtp-secret',
      },
    };

    const saveResult = manager.save(config);
    const configFile = path.join(tempDir, 'config.json');
    const rawConfig = JSON.parse(fs.readFileSync(configFile, 'utf8')) as {
      imap: { password: string };
      smtp: { password: string };
    };
    const loaded = manager.load();

    expect(saveResult).toBe(true);
    expect(manager.exists()).toBe(true);
    expect(rawConfig.imap.password).not.toBe('imap-secret');
    expect(rawConfig.smtp.password).not.toBe('smtp-secret');
    expect(loaded.imap.password).toBe('imap-secret');
    expect(loaded.smtp.password).toBe('smtp-secret');
  });
});
