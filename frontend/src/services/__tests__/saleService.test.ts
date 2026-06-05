import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { saleService } from '../saleService';
import type { Sale, SaleListItem, SaleWithItems, PaginatedResponse } from '../../types/api';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]): PaginatedResponse<T> {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const mockSaleItem: SaleListItem = {
  id: 'sale-1',
  code: 'VTA-001',
  school_id: 'school-1',
  school_name: 'Colegio Test',
  client_id: null,
  client_name: null,
  total: 150000,
  paid_amount: 150000,
  status: 'completed',
  payment_method: 'cash',
  created_at: '2026-01-15T10:00:00',
  sale_date: '2026-01-15',
  is_historical: false,
  items_count: 2,
  source: 'desktop_app',
  user_id: null,
  user_name: null,
};

const mockSale: Sale = {
  id: 'sale-1',
  code: 'VTA-001',
  school_id: 'school-1',
  client_id: null,
  total: 150000,
  amount_paid: 150000,
  balance: 0,
  status: 'completed',
  payment_method: 'cash',
  created_at: '2026-01-15T10:00:00',
  sale_date: '2026-01-15',
  is_historical: false,
  notes: null,
} as unknown as Sale;

describe('saleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllSales', () => {
    it('fetches all sales with no filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockSaleItem]) });

      const result = await saleService.getAllSales();

      expect(apiMock.get).toHaveBeenCalledWith('/sales');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('appends query params from filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await saleService.getAllSales({
        school_id: 'school-1',
        status: 'completed',
        search: 'VTA',
        skip: 10,
        limit: 50,
        start_date: '2026-01-01',
        end_date: '2026-01-31',
        include_historical: false,
      });

      expect(apiMock.get).toHaveBeenCalledWith(
        '/sales?school_id=school-1&status=completed&search=VTA&skip=10&limit=50&include_historical=false&start_date=2026-01-01&end_date=2026-01-31'
      );
    });

    it('does not append empty optional filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await saleService.getAllSales({ school_id: undefined, status: undefined });

      expect(apiMock.get).toHaveBeenCalledWith('/sales');
    });
  });

  describe('getSales', () => {
    it('delegates to getAllSales with school_id filter', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockSaleItem]) });

      const result = await saleService.getSales('school-1');

      expect(apiMock.get).toHaveBeenCalledWith('/sales?school_id=school-1');
      expect(result.items[0].id).toBe('sale-1');
    });

    it('fetches all schools when no school_id provided', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await saleService.getSales();

      expect(apiMock.get).toHaveBeenCalledWith('/sales');
    });
  });

  describe('getSaleById', () => {
    it('fetches a single sale by ID', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockSale });

      const result = await saleService.getSaleById('sale-1');

      expect(apiMock.get).toHaveBeenCalledWith('/sales/sale-1');
      expect(result.id).toBe('sale-1');
    });
  });

  describe('getSale', () => {
    it('fetches school-specific sale', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockSale });

      const result = await saleService.getSale('school-1', 'sale-1');

      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/sales/sale-1');
      expect(result.id).toBe('sale-1');
    });
  });

  describe('getSaleDetails', () => {
    it('fetches full sale details without school_id', async () => {
      const mockWithItems = { ...mockSale, items: [] } as unknown as SaleWithItems;
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockWithItems });

      const result = await saleService.getSaleDetails('sale-1');

      expect(apiMock.get).toHaveBeenCalledWith('/sales/sale-1/details');
      expect(result.id).toBe('sale-1');
    });
  });

  describe('createSale', () => {
    it('posts sale data to school-specific endpoint', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockSale });

      const saleData = {
        school_id: 'school-1',
        items: [{ product_id: 'prod-1', quantity: 2, unit_price: 75000 }],
        payments: [{ amount: 150000, payment_method: 'cash' as const }],
      };

      const result = await saleService.createSale('school-1', saleData);

      expect(apiMock.post).toHaveBeenCalledWith('/schools/school-1/sales', saleData);
      expect(result.id).toBe('sale-1');
    });
  });

  describe('updateSale', () => {
    it('patches editable fields', async () => {
      const updated = { ...mockSale, notes: 'Updated notes' };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: updated });

      const result = await saleService.updateSale('school-1', 'sale-1', { notes: 'Updated notes' });

      expect(apiMock.patch).toHaveBeenCalledWith('/schools/school-1/sales/sale-1', { notes: 'Updated notes' });
      expect(result.notes).toBe('Updated notes');
    });
  });

  describe('cancelSale', () => {
    it('posts cancel request with reason', async () => {
      const cancelResponse = {
        id: 'sale-1',
        code: 'VTA-001',
        status: 'cancelled',
        cancelled_at: '2026-01-16T10:00:00',
        inventory_restored: true,
        transactions_reversed: true,
        receivables_cancelled: true,
        message: 'Venta cancelada exitosamente',
      };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: cancelResponse });

      const result = await saleService.cancelSale('school-1', 'sale-1', { reason: 'Error en la venta' });

      expect(apiMock.post).toHaveBeenCalledWith('/schools/school-1/sales/sale-1/cancel', { reason: 'Error en la venta' });
      expect(result.inventory_restored).toBe(true);
      expect(result.status).toBe('cancelled');
    });
  });

  describe('addPaymentToSale', () => {
    it('posts payment data to sale payments endpoint', async () => {
      const mockPayment = { id: 'pay-1', amount: 75000, payment_method: 'cash' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockPayment });

      const result = await saleService.addPaymentToSale('school-1', 'sale-1', {
        amount: 75000,
        payment_method: 'cash',
        apply_accounting: true,
      });

      expect(apiMock.post).toHaveBeenCalledWith(
        '/schools/school-1/sales/sale-1/payments',
        { amount: 75000, payment_method: 'cash', apply_accounting: true }
      );
      expect(result.id).toBe('pay-1');
    });
  });

  describe('sendReceiptEmail', () => {
    it('posts to send-receipt endpoint', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { message: 'Email enviado', success: true } });

      const result = await saleService.sendReceiptEmail('school-1', 'sale-1');

      expect(apiMock.post).toHaveBeenCalledWith('/schools/school-1/sales/sale-1/send-receipt');
      expect(result.success).toBe(true);
    });
  });

  describe('error propagation', () => {
    it('propagates API errors to caller', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Network Error'));

      await expect(saleService.getAllSales()).rejects.toThrow('Network Error');
    });

    it('propagates errors from getSaleById', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('HTTP 404'));

      await expect(saleService.getSaleById('nonexistent')).rejects.toThrow('HTTP 404');
    });
  });
});
