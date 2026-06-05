import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import {
  getPendingItems,
  getQueueStats,
  markAsPrinted,
  markAsSkipped,
  markAsFailed,
  retryFailed,
  cleanupOldItems,
  getConnectionInfo,
} from '../printQueueService';
import type { PrintQueueItem, PrintQueueStats, ConnectionInfo } from '../printQueueService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

function paginatedOf<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const mockItem: PrintQueueItem = {
  id: 'pq-1',
  sale_id: 'sale-1',
  school_id: 'school-1',
  sale_code: 'V-001',
  sale_total: 50000,
  client_name: 'Juan',
  school_name: 'Colegio A',
  source_device: 'device-1',
  status: 'pending',
  print_receipt: true,
  open_drawer: false,
  created_at: '2026-04-10T10:00:00',
  processed_at: null,
  error_message: null,
  retry_count: 0,
};

describe('printQueueService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getPendingItems', () => {
    it('returns paginated pending items', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([mockItem]) });

      const result = await getPendingItems();

      expect(apiClient.get).toHaveBeenCalledWith('/global/print-queue/pending', { params: { limit: 50 } });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('pq-1');
    });

    it('accepts custom limit', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: paginatedOf([]) });

      await getPendingItems(10);

      expect(apiClient.get).toHaveBeenCalledWith('/global/print-queue/pending', { params: { limit: 10 } });
    });

    it('wraps plain array into paginated response', async () => {
      (apiClient.get as Mock).mockResolvedValue({ data: [mockItem] });

      const result = await getPendingItems();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getQueueStats', () => {
    it('returns queue statistics', async () => {
      const stats: PrintQueueStats = { pending_count: 3, printed_today: 10, skipped_today: 1, failed_today: 0 };
      (apiClient.get as Mock).mockResolvedValue({ data: stats });

      const result = await getQueueStats();

      expect(apiClient.get).toHaveBeenCalledWith('/global/print-queue/stats');
      expect(result.pending_count).toBe(3);
    });
  });

  describe('markAsPrinted', () => {
    it('patches item status to printed', async () => {
      const printed = { ...mockItem, status: 'printed' as const };
      (apiClient.patch as Mock).mockResolvedValue({ data: printed });

      const result = await markAsPrinted('pq-1');

      expect(apiClient.patch).toHaveBeenCalledWith('/global/print-queue/pq-1/printed');
      expect(result.status).toBe('printed');
    });
  });

  describe('markAsSkipped', () => {
    it('patches item status to skipped', async () => {
      const skipped = { ...mockItem, status: 'skipped' as const };
      (apiClient.patch as Mock).mockResolvedValue({ data: skipped });

      const result = await markAsSkipped('pq-1');

      expect(apiClient.patch).toHaveBeenCalledWith('/global/print-queue/pq-1/skipped');
      expect(result.status).toBe('skipped');
    });
  });

  describe('markAsFailed', () => {
    it('patches item with error message', async () => {
      const failed = { ...mockItem, status: 'failed' as const, error_message: 'printer offline' };
      (apiClient.patch as Mock).mockResolvedValue({ data: failed });

      const result = await markAsFailed('pq-1', 'printer offline');

      expect(apiClient.patch).toHaveBeenCalledWith('/global/print-queue/pq-1/failed', null, {
        params: { error_message: 'printer offline' },
      });
      expect(result.error_message).toBe('printer offline');
    });
  });

  describe('retryFailed', () => {
    it('retries a failed item', async () => {
      const retried = { ...mockItem, status: 'pending' as const, retry_count: 1 };
      (apiClient.patch as Mock).mockResolvedValue({ data: retried });

      const result = await retryFailed('pq-1');

      expect(apiClient.patch).toHaveBeenCalledWith('/global/print-queue/pq-1/retry');
      expect(result.retry_count).toBe(1);
    });
  });

  describe('cleanupOldItems', () => {
    it('deletes old items with default days', async () => {
      (apiClient.delete as Mock).mockResolvedValue({ data: { deleted_count: 5, days: 7 } });

      const result = await cleanupOldItems();

      expect(apiClient.delete).toHaveBeenCalledWith('/global/print-queue/cleanup', { params: { days: 7 } });
      expect(result.deleted_count).toBe(5);
    });

    it('accepts custom days parameter', async () => {
      (apiClient.delete as Mock).mockResolvedValue({ data: { deleted_count: 2, days: 3 } });

      await cleanupOldItems(3);

      expect(apiClient.delete).toHaveBeenCalledWith('/global/print-queue/cleanup', { params: { days: 3 } });
    });
  });

  describe('getConnectionInfo', () => {
    it('returns SSE connection info', async () => {
      const info: ConnectionInfo = { total_connections: 4, unique_users: 2 };
      (apiClient.get as Mock).mockResolvedValue({ data: info });

      const result = await getConnectionInfo();

      expect(apiClient.get).toHaveBeenCalledWith('/global/print-queue/connection-info');
      expect(result.total_connections).toBe(4);
    });
  });

  describe('error propagation', () => {
    it('propagates API errors from getPendingItems', async () => {
      (apiClient.get as Mock).mockRejectedValue(new Error('Network error'));
      await expect(getPendingItems()).rejects.toThrow('Network error');
    });

    it('propagates API errors from markAsPrinted', async () => {
      (apiClient.patch as Mock).mockRejectedValue(new Error('Not found'));
      await expect(markAsPrinted('bad-id')).rejects.toThrow('Not found');
    });
  });
});
