import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestApp, jsonRequest } from './setup';

const mockEmailModel = vi.hoisted(() => ({
  findByFolder: vi.fn(),
  countByFolder: vi.fn(),
  findById: vi.fn(),
  markAsRead: vi.fn(),
  markAsStarred: vi.fn(),
}));

vi.mock('../../src/storage/models/email', () => ({
  default: mockEmailModel,
}));

vi.mock('../../src/smtp/client', () => {
  return {
    default: class MockSMTPClient {
      sendEmail = vi.fn().mockResolvedValue({
        messageId: 'test-msg-id',
        response: '250 OK',
      });
      disconnect = vi.fn();
    },
  };
});

vi.mock('../../src/smtp/composer', () => {
  return {
    default: class MockEmailComposer {
      setTo = vi.fn().mockReturnThis();
      setSubject = vi.fn().mockReturnThis();
      setBody = vi.fn().mockReturnThis();
      setCc = vi.fn().mockReturnThis();
      setBcc = vi.fn().mockReturnThis();
      setReplyTo = vi.fn().mockReturnThis();
      compose = vi.fn().mockReturnValue({ raw: 'composed-email' });
    },
  };
});

vi.mock('../../src/config', () => ({
  default: {
    load: vi.fn().mockReturnValue({
      smtp: { host: 'smtp.test.com', user: 'user@test.com', password: 'pass' },
    }),
  },
}));

vi.mock('../../src/utils/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
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

const sampleEmail = {
  id: 1,
  message_id: '<test@example.com>',
  from_address: 'sender@example.com',
  to_address: 'recipient@example.com',
  subject: 'Test Email',
  date: '2026-01-01T00:00:00Z',
  folder: 'INBOX',
  is_read: false,
  is_starred: false,
};

describe('email API', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('GET /api/emails', () => {
    it('returns emails with pagination meta', async () => {
      mockEmailModel.findByFolder.mockReturnValue([sampleEmail]);
      mockEmailModel.countByFolder.mockReturnValue(1);

      const res = await app.request('/api/emails');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].subject).toBe('Test Email');
      expect(body.meta).toEqual({ total: 1, limit: 20, offset: 0 });
    });

    it('passes query params to model', async () => {
      mockEmailModel.findByFolder.mockReturnValue([]);
      mockEmailModel.countByFolder.mockReturnValue(0);

      await app.request('/api/emails?folder=Sent&limit=10&offset=5');

      expect(mockEmailModel.findByFolder).toHaveBeenCalledWith('Sent', {
        limit: 10,
        offset: 5,
      });
      expect(mockEmailModel.countByFolder).toHaveBeenCalledWith('Sent');
    });

    it('returns empty list', async () => {
      mockEmailModel.findByFolder.mockReturnValue([]);
      mockEmailModel.countByFolder.mockReturnValue(0);

      const res = await app.request('/api/emails');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
      expect(body.meta.total).toBe(0);
    });
  });

  describe('GET /api/emails/:id', () => {
    it('returns email when found', async () => {
      mockEmailModel.findById.mockReturnValue(sampleEmail);

      const res = await app.request('/api/emails/1');
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.subject).toBe('Test Email');
    });

    it('returns 404 when not found', async () => {
      mockEmailModel.findById.mockReturnValue(null);

      const res = await app.request('/api/emails/999');
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid id', async () => {
      const res = await app.request('/api/emails/abc');
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('INVALID_ID');
    });
  });

  describe('POST /api/emails', () => {
    const validPayload = {
      to: 'recipient@example.com',
      subject: 'Hello',
      body: 'Test body',
    };

    it('sends email and returns 201', async () => {
      const req = jsonRequest('/api/emails', {
        method: 'POST',
        body: validPayload,
      });
      const res = await app.request(req);
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.data.status).toBe('sent');
      expect(body.data.message_id).toBe('test-msg-id');
    });

    it('returns 400 when SMTP is not configured', async () => {
      const config = await import('../../src/config');
      vi.mocked(config.default.load).mockReturnValueOnce({
        smtp: { host: '', user: '', password: '' },
      } as ReturnType<typeof config.default.load>);

      const req = jsonRequest('/api/emails', {
        method: 'POST',
        body: validPayload,
      });
      const res = await app.request(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('SMTP_NOT_CONFIGURED');
    });

    it('returns 400 for missing required fields', async () => {
      const req = jsonRequest('/api/emails', {
        method: 'POST',
        body: { to: 'not-an-email' },
      });
      const res = await app.request(req);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/emails/:id/mark-read', () => {
    it('marks email as read', async () => {
      const res = await app.request('/api/emails/1/mark-read?read=true', {
        method: 'POST',
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.id).toBe(1);
      expect(body.data.is_read).toBe(true);
      expect(mockEmailModel.markAsRead).toHaveBeenCalledWith(1);
    });

    it('returns 400 for invalid id', async () => {
      const res = await app.request('/api/emails/abc/mark-read', {
        method: 'POST',
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('INVALID_ID');
    });
  });

  describe('POST /api/emails/:id/star', () => {
    it('stars an email', async () => {
      const res = await app.request('/api/emails/1/star?starred=true', {
        method: 'POST',
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.id).toBe(1);
      expect(body.data.is_starred).toBe(true);
      expect(mockEmailModel.markAsStarred).toHaveBeenCalledWith(1);
    });

    it('returns 400 for invalid id', async () => {
      const res = await app.request('/api/emails/abc/star', {
        method: 'POST',
      });
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('INVALID_ID');
    });
  });
});
