import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestApp } from './setup';

const mockSyncManager = vi.hoisted(() => ({
  syncAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/sync/account-manager', () => ({
  default: mockSyncManager,
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

vi.mock('../../src/accounts/manager', () => ({
  default: {
    getAllAccounts: vi.fn(),
    getAccount: vi.fn(),
    addAccount: vi.fn(),
  },
}));

describe('sync API', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
  });

  describe('POST /api/sync', () => {
    it('triggers sync and returns job id', async () => {
      const res = await app.request('/api/sync', { method: 'POST' });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.status).toBe('started');
      expect(body.data.job_id).toBeDefined();
      expect(body.data.job_id).toMatch(/^sync-/);
    });

    it('passes account_id query param', async () => {
      const res = await app.request('/api/sync?account_id=1', {
        method: 'POST',
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(mockSyncManager.syncAccount).toHaveBeenCalledWith(1, undefined);
    });
  });

  describe('GET /api/sync/status', () => {
    it('returns 400 when job_id is missing', async () => {
      const res = await app.request('/api/sync/status');
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe('MISSING_JOB_ID');
    });

    it('returns 404 for unknown job_id', async () => {
      const res = await app.request('/api/sync/status?job_id=nonexistent');
      const body = await res.json();

      expect(res.status).toBe(404);
      expect(body.error.code).toBe('JOB_NOT_FOUND');
    });

    it('returns status for a triggered job', async () => {
      // First trigger a sync to create a job
      const triggerRes = await app.request('/api/sync', { method: 'POST' });
      const triggerBody = await triggerRes.json();
      const jobId = triggerBody.data.job_id;

      const res = await app.request(`/api/sync/status?job_id=${jobId}`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.job_id).toBe(jobId);
      expect(body.data.status).toBeDefined();
    });
  });
});
