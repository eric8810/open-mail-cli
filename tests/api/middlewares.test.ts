import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { errorHandler } from '../../src/api/middlewares/error';
import { localhostOnly } from '../../src/api/middlewares/localhost';

vi.mock('../../src/utils/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../src/storage/models/email', () => ({
  default: {
    findByFolder: vi.fn(),
    countByFolder: vi.fn(),
    findById: vi.fn(),
    markAsRead: vi.fn(),
    markAsStarred: vi.fn(),
  },
}));

vi.mock('../../src/accounts/manager', () => ({
  default: {
    getAllAccounts: vi.fn(),
    getAccount: vi.fn(),
    addAccount: vi.fn(),
  },
}));

vi.mock('../../src/sync/account-manager', () => ({
  default: { syncAccount: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../src/smtp/client', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/smtp/composer', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/config', () => ({
  default: { load: vi.fn().mockReturnValue({ smtp: {} }) },
}));

describe('error handler middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.onError(errorHandler);
  });

  it('returns 404 for NotFoundError', async () => {
    app.get('/test', () => {
      const err = new Error('Thing not found');
      err.name = 'NotFoundError';
      throw err;
    });

    const res = await app.request('/test');
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Thing not found');
  });

  it('returns 400 for ValidationError', async () => {
    app.get('/test', () => {
      const err = new Error('Invalid input');
      err.name = 'ValidationError';
      throw err;
    });

    const res = await app.request('/test');
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Invalid input');
  });

  it('returns 500 for generic errors', async () => {
    app.get('/test', () => {
      throw new Error('Something broke');
    });

    const res = await app.request('/test');
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
  });
});

describe('localhost middleware', () => {
  function createAppWithMiddleware() {
    const app = new Hono();
    app.use('*', localhostOnly as MiddlewareHandler);
    app.get('/test', (c) => c.json({ ok: true }));
    return app;
  }

  it('allows requests with no forwarded headers (defaults to 127.0.0.1)', async () => {
    const app = createAppWithMiddleware();
    const res = await app.request('/test');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('allows requests from 127.0.0.1', async () => {
    const app = createAppWithMiddleware();
    const req = new Request('http://localhost/test', {
      headers: { 'x-forwarded-for': '127.0.0.1' },
    });
    const res = await app.request(req);

    expect(res.status).toBe(200);
  });

  it('allows requests from ::1', async () => {
    const app = createAppWithMiddleware();
    const req = new Request('http://localhost/test', {
      headers: { 'x-forwarded-for': '::1' },
    });
    const res = await app.request(req);

    expect(res.status).toBe(200);
  });

  it('allows requests from localhost', async () => {
    const app = createAppWithMiddleware();
    const req = new Request('http://localhost/test', {
      headers: { 'x-forwarded-for': 'localhost' },
    });
    const res = await app.request(req);

    expect(res.status).toBe(200);
  });

  it('denies requests from external IPs', async () => {
    const app = createAppWithMiddleware();
    const req = new Request('http://localhost/test', {
      headers: { 'x-forwarded-for': '192.168.1.100' },
    });
    const res = await app.request(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('ACCESS_DENIED');
  });

  it('checks x-real-ip header as fallback', async () => {
    const app = createAppWithMiddleware();
    const req = new Request('http://localhost/test', {
      headers: { 'x-real-ip': '10.0.0.1' },
    });
    const res = await app.request(req);

    expect(res.status).toBe(403);
  });
});

describe('health endpoint', () => {
  it('returns 200 with status ok', async () => {
    const { createTestApp } = await import('./setup');
    const app = createTestApp();
    const res = await app.request('/health');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });
});
