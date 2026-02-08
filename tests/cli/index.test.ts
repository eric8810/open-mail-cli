import { describe, expect, it } from 'vitest';

const createCLI = require('../../src/cli/index.ts');

describe('cli index', () => {
  it('registers core commands', () => {
    const program = createCLI();
    const commandNames = program.commands.map(
      (command: { name: () => string }) => command.name()
    );

    expect(commandNames).toEqual(
      expect.arrayContaining([
        'config',
        'sync',
        'list',
        'read',
        'send',
        'account',
        'contact',
        'folder',
        'thread',
        'export',
        'import',
      ])
    );
  });
});
