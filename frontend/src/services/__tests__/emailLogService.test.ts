import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import emailLogService, {
  getEmailLogs, getEmailStatistics, getRecentFailures, getQueueStatus, processQueue,
  EMAIL_TYPE_LABELS, EMAIL_STATUS_LABELS,
} from '../emailLogService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const mockLog = {
  id: 'log-1', email_type: 'order_confirmation' as const, recipient_email: 'test@test.com',
  recipient_name: 'Test', subject: 'Confirmacion', status: 'success' as const,
  error_message: null, sent_at: '2026-01-01T00:00:00',
};

describe('emailLogService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getEmailLogs', () => {
    it('fetches logs with default params', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { items: [mockLog], total: 1, skip: 0, limit: 100 } });
      const result = await getEmailLogs();
      expect(apiMock.get).toHaveBeenCalledWith('/global/email-logs', { params: { skip: 0, limit: 100 } });
      expect(result.items).toHaveLength(1);
    });

    it('passes all filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { items: [], total: 0, skip: 0, limit: 50 } });
      await getEmailLogs({
        start_date: '2026-01-01', end_date: '2026-01-31',
        email_type: 'verification', status: 'failed',
        recipient_email: 'test@test.com', skip: 10, limit: 50,
      });
      expect(apiMock.get).toHaveBeenCalledWith('/global/email-logs', {
        params: {
          start_date: '2026-01-01', end_date: '2026-01-31',
          email_type: 'verification', status: 'failed',
          recipient_email: 'test@test.com', skip: 10, limit: 50,
        },
      });
    });
  });

  describe('getEmailStatistics', () => {
    it('fetches stats with date range', async () => {
      const mockStats = { period_start: '2026-01-01', total_sent: 100, total_success: 95 };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockStats });
      const result = await getEmailStatistics('2026-01-01', '2026-01-31');
      expect(apiMock.get).toHaveBeenCalledWith('/global/email-logs/statistics', {
        params: { start_date: '2026-01-01', end_date: '2026-01-31' },
      });
      expect(result.total_sent).toBe(100);
    });

    it('fetches stats without date range', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { total_sent: 50 } });
      await getEmailStatistics();
      expect(apiMock.get).toHaveBeenCalledWith('/global/email-logs/statistics', { params: {} });
    });
  });

  describe('getRecentFailures', () => {
    it('fetches failures with default limit', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockLog]) });
      const result = await getRecentFailures();
      expect(apiMock.get).toHaveBeenCalledWith('/global/email-logs/failures', { params: { limit: 10 } });
      expect(result.items).toHaveLength(1);
    });

    it('wraps legacy array response', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockLog] });
      const result = await getRecentFailures(5);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getQueueStatus', () => {
    it('fetches queue status', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { pending_logs: 3 } });
      const result = await getQueueStatus();
      expect(apiMock.get).toHaveBeenCalledWith('/global/email-logs/queue-status');
      expect(result.pending_logs).toBe(3);
    });
  });

  describe('processQueue', () => {
    it('posts to process-queue endpoint', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { message: 'OK', processed: 5, remaining: 0 } });
      const result = await processQueue();
      expect(apiMock.post).toHaveBeenCalledWith('/global/email-logs/process-queue');
      expect(result.processed).toBe(5);
    });
  });

  describe('object export', () => {
    it('exports all functions on emailLogService object', () => {
      expect(emailLogService.getEmailLogs).toBe(getEmailLogs);
      expect(emailLogService.getEmailStatistics).toBe(getEmailStatistics);
      expect(emailLogService.getRecentFailures).toBe(getRecentFailures);
      expect(emailLogService.getQueueStatus).toBe(getQueueStatus);
      expect(emailLogService.processQueue).toBe(processQueue);
    });
  });

  describe('constants', () => {
    it('EMAIL_TYPE_LABELS has all expected types', () => {
      expect(EMAIL_TYPE_LABELS.verification).toBe('Codigo de Verificacion');
      expect(EMAIL_TYPE_LABELS.order_confirmation).toBe('Confirmacion de Encargo');
    });

    it('EMAIL_STATUS_LABELS has all statuses', () => {
      expect(EMAIL_STATUS_LABELS.success).toBe('Exitoso');
      expect(EMAIL_STATUS_LABELS.failed).toBe('Fallido');
      expect(EMAIL_STATUS_LABELS.dev_skipped).toBe('Omitido (Dev)');
    });
  });
});
