import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AuthenticationError,
  ConfigError,
  ConnectionError,
  MailClientError,
  ValidationError,
} from '../../src/utils/errors.ts';
import {
  getExitCode,
  handleCommandError,
} from '../../src/cli/utils/error-handler.ts';

describe('error-handler', () => {
  describe('getExitCode', () => {
    it('returns 2 for ValidationError', () => {
      expect(getExitCode(new ValidationError('bad input'))).toBe(2);
    });

    it('returns 2 for ConfigError', () => {
      expect(getExitCode(new ConfigError('missing key'))).toBe(2);
    });

    it('returns 3 for ConnectionError', () => {
      expect(getExitCode(new ConnectionError('timeout'))).toBe(3);
    });

    it('returns 4 for AuthenticationError', () => {
      expect(getExitCode(new AuthenticationError('bad creds'))).toBe(4);
    });

    it('returns 1 for generic MailClientError', () => {
      expect(getExitCode(new MailClientError('something'))).toBe(1);
    });

    it('returns 1 for plain Error', () => {
      expect(getExitCode(new Error('oops'))).toBe(1);
    });

    it('returns 1 for non-Error values', () => {
      expect(getExitCode('string error')).toBe(1);
      expect(getExitCode(42)).toBe(1);
      expect(getExitCode(null)).toBe(1);
    });
  });

  describe('handleCommandError', () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation(() => undefined as never);
      stderrSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('outputs JSON when format is "json"', () => {
      const err = new ValidationError('bad input');
      handleCommandError(err, 'json');

      const output = stderrSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({
        error: { code: 'VALIDATION_ERROR', message: 'bad input' },
      });
      expect(exitSpy).toHaveBeenCalledWith(2);
    });

    it('outputs chalk-coloured text by default', () => {
      const err = new ConnectionError('timeout');
      handleCommandError(err);

      // First call should have two args: chalk.red('Error:') and message
      expect(stderrSpy.mock.calls[0].length).toBe(2);
      expect(stderrSpy.mock.calls[0][1]).toBe('timeout');
      expect(exitSpy).toHaveBeenCalledWith(3);
    });

    it('wraps non-Error values in Error', () => {
      handleCommandError('raw string');

      expect(stderrSpy.mock.calls[0][1]).toBe('raw string');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('uses UNKNOWN_ERROR code for non-MailClientError', () => {
      handleCommandError(new Error('plain'), 'json');

      const parsed = JSON.parse(stderrSpy.mock.calls[0][0]);
      expect(parsed.error.code).toBe('UNKNOWN_ERROR');
    });
  });
});
