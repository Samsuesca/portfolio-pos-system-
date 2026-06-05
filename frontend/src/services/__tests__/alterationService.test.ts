import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import alterationService from '../alterationService';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]) {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const mockAlteration = {
  id: 'alt-1',
  code: 'ARR-2026-0001',
  client_name: 'Ana Torres',
  description: 'Ajuste de bota',
  status: 'pending',
  type: 'repair',
  total_cost: 15000,
  total_paid: 0,
  is_paid: false,
  created_at: '2026-03-01T10:00:00',
};

const mockPayment = {
  id: 'pay-1',
  alteration_id: 'alt-1',
  amount: 15000,
  payment_method: 'cash',
  created_at: '2026-03-02T10:00:00',
};

const mockSummary = {
  total_count: 10,
  pending_count: 3,
  in_progress_count: 4,
  completed_count: 3,
  total_revenue: 150000,
  pending_revenue: 45000,
};

describe('alterationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('fetches all alterations with no filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockAlteration]) });

      const result = await alterationService.getAll();

      expect(apiMock.get).toHaveBeenCalledWith('/global/alterations');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].code).toBe('ARR-2026-0001');
    });

    it('appends query params from filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await alterationService.getAll({ skip: 10, limit: 5, status: 'pending' as never, is_paid: false });

      const url = (apiMock.get as Mock).mock.calls[0][0] as string;
      expect(url).toContain('skip=10');
      expect(url).toContain('limit=5');
      expect(url).toContain('status=pending');
      expect(url).toContain('is_paid=false');
    });

    it('propagates API errors', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(alterationService.getAll()).rejects.toThrow('Network error');
    });
  });

  describe('getSummary', () => {
    it('fetches summary statistics', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockSummary });

      const result = await alterationService.getSummary();

      expect(apiMock.get).toHaveBeenCalledWith('/global/alterations/summary');
      expect(result.total_count).toBe(10);
    });
  });

  describe('getById', () => {
    it('fetches alteration by ID', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockAlteration });

      const result = await alterationService.getById('alt-1');

      expect(apiMock.get).toHaveBeenCalledWith('/global/alterations/alt-1');
      expect(result.id).toBe('alt-1');
    });
  });

  describe('getByCode', () => {
    it('fetches alteration by code', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockAlteration });

      const result = await alterationService.getByCode('ARR-2026-0001');

      expect(apiMock.get).toHaveBeenCalledWith('/global/alterations/code/ARR-2026-0001');
      expect(result.code).toBe('ARR-2026-0001');
    });
  });

  describe('create', () => {
    it('posts a new alteration', async () => {
      const createData = { client_name: 'Ana Torres', description: 'Ajuste', type: 'repair', total_cost: 15000 };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockAlteration });

      const result = await alterationService.create(createData as never);

      expect(apiMock.post).toHaveBeenCalledWith('/global/alterations', createData);
      expect(result.id).toBe('alt-1');
    });
  });

  describe('update', () => {
    it('patches an existing alteration', async () => {
      const updateData = { description: 'Ajuste de bota actualizado' };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: { ...mockAlteration, ...updateData } });

      const result = await alterationService.update('alt-1', updateData as never);

      expect(apiMock.patch).toHaveBeenCalledWith('/global/alterations/alt-1', updateData);
      expect(result.description).toBe('Ajuste de bota actualizado');
    });
  });

  describe('updateStatus', () => {
    it('patches status only', async () => {
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: { ...mockAlteration, status: 'completed' } });

      const result = await alterationService.updateStatus('alt-1', 'completed' as never);

      expect(apiMock.patch).toHaveBeenCalledWith('/global/alterations/alt-1/status', { status: 'completed' });
      expect(result.status).toBe('completed');
    });
  });

  describe('recordPayment', () => {
    it('posts a payment for an alteration', async () => {
      const paymentData = { amount: 15000, payment_method: 'cash' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockPayment });

      const result = await alterationService.recordPayment('alt-1', paymentData as never);

      expect(apiMock.post).toHaveBeenCalledWith('/global/alterations/alt-1/pay', paymentData);
      expect(result.amount).toBe(15000);
    });
  });

  describe('getPayments', () => {
    it('fetches payments for an alteration', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockPayment] });

      const result = await alterationService.getPayments('alt-1');

      expect(apiMock.get).toHaveBeenCalledWith('/global/alterations/alt-1/payments');
      expect(result).toHaveLength(1);
    });
  });

  describe('cancel', () => {
    it('deletes an alteration', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: mockAlteration });

      const result = await alterationService.cancel('alt-1');

      expect(apiMock.delete).toHaveBeenCalledWith('/global/alterations/alt-1');
      expect(result.id).toBe('alt-1');
    });
  });
});
