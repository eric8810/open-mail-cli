import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestApp, jsonRequest } from './setup';

const mockAccountManager = vi.hoisted(() => ({
  getAllAccounts: vi.fn(),
  getAccount: vi.fn(),
  addAccount: vi.fn(),
}));

vi.mock('../../src/accounts/manager', () => ({
  default: mockAccountManager,
}));

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

vi.mock('../../src/smtp/client', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/smtp/composer', () => ({
  default: vi.fn(),
}));

vi.mock('../../src/config', () => ({
  default: { load: vi.fn().mockReturnValue({ smtp: {} }) },
}));

vi.mock('../../src/sync/account-manager', () => ({
  default: { syncAccount: vi.fn().mockResolvedValue(undefined) },
}));

const sampleAccount = {
  id: 1,
  email: 'user@example.com',
  name: 'Test User',
  enabled: true,
};

describe('account API', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /api/accounts', () => {
    it('returns list of accounts', async () => {
      mockAccountManager.getAllAccounts.mockReturnValue([sampleAccount]);

      const res = await app.request('/api/accounts');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].email).toBe('user@example.com');
    });

    it('returns empty list when no accounts', async () => {
      mockAccountManager.getAllAccounts.mockReturnValue([]);

      const res = await app.request('/api/accounts');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
    });

    it('handles null from getAllAccounts', async () => {
      mockAccountManager.getAllAccounts.mockReturnValue(null);

      const res = await app.request('/api/accounts');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
    });
  });

  describe('GET /api/accounts/:id', () => {
    it('returns account when found', async () => {
      mockAccountManager.getAccount.mockReturnValue(sampleAccount);

      const res = await app.request('/api/accounts/1');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.email).toBe('user@example.com');
      expect(body.data.name).toBe('Test User');
    });

    it('returns 404 when not found', async () => {
      mockAccountManager.getAccount.mockReturnValue(null);

      const res = await app.request('/api/accounts/999');
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid id', async () => {
      const res = await app.request('/api/accounts/abc');
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('INVALID_ID');
    });
  });

  describe('POST /api/accounts', () => {
    it('creates account and returns 201', async () => {
      mockAccountManager.addAccount.mockResolvedValue(1);
      mockAccountManager.getAccount.mockReturnValue(sampleAccount);

      const req = jsonRequest('/api/accounts', {
        method: 'POST',
        body: {
          email: 'new@example.com',
          name: 'New User',
          imap_host: 'imap.example.com',
          imap_port: 993,
          imap_secure: true,
          smtp_host: 'smtp.example.com',
          smtp_port: 587,
          smtp_secure: true,
          username: 'new@example.com',
          password: 'secret',
        },
      });
      const res = await app.request(req);
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.id).toBe(1);
    });

    it('returns 400 for invalid payload', async () => {
      const req = jsonRequest('/api/accounts', {
        method: 'POST',
        body: { email: 'not-valid' },
      });
      const res = await app.request(req);

      expect(res.status).toBe(400);
    });
  });
});
