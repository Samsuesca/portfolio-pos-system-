/**
 * Tests for the new aggregated /stats endpoint client functions and the
 * new orderService payment approval helpers.
 *
 * These cover the service layer added to consume backend endpoints that
 * replace the broken client-side reduce/filter/length pattern over
 * paginated responses.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { getGlobalExpensesStats } from '../globalAccountingService';
import { productService } from '../productService';
import workforceService from '../workforceService';
import { userService } from '../userService';
import { orderService } from '../orderService';

vi.mock('../../utils/api-client', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const apiMock = vi.mocked(apiClient);

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// globalAccountingService.getGlobalExpensesStats
// ============================================================================

describe('getGlobalExpensesStats', () => {
  const sampleStats = {
    total_amount: 9000000,
    total_count: 120,
    paid_amount: 6000000,
    paid_count: 60,
    pending_amount: 3000000,
    pending_count: 60,
    average_amount: 75000,
  };

  it('GETs the /expenses/stats endpoint with no params by default', async () => {
    (apiMock.get as Mock).mockResolvedValueOnce({ data: sampleStats });

    const result = await getGlobalExpensesStats();

    expect(apiMock.get).toHaveBeenCalledWith(
      '/global/accounting/expenses/stats',
      expect.objectContaining({ params: expect.any(Object) })
    );
    expect(result).toEqual(sampleStats);
  });

  it('forwards all filter params to the backend (snake_case)', async () => {
    (apiMock.get as Mock).mockResolvedValueOnce({ data: sampleStats });

    await getGlobalExpensesStats({
      category: 'rent',
      isPaid: false,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      minAmount: 50000,
      maxAmount: 500000,
      paymentAccountId: 'acc-1',
    });

    expect(apiMock.get).toHaveBeenCalledWith('/global/accounting/expenses/stats', {
      params: {
        category: 'rent',
        is_paid: false,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        min_amount: 50000,
        max_amount: 500000,
        payment_account_id: 'acc-1',
      },
    });
  });

  it('returns the raw stats payload (no PaginatedResponse unwrapping)', async () => {
    (apiMock.get as Mock).mockResolvedValueOnce({ data: sampleStats });
    const result = await getGlobalExpensesStats();
    // Stats endpoints return a single object, NOT { items: [...] }
    expect(result).not.toHaveProperty('items');
    expect(result.total_count).toBe(120);
  });
});

// ============================================================================
// productService.getGlobalProductsStats
// ============================================================================

describe('productService.getGlobalProductsStats', () => {
  const sampleStats = {
    total_products: 250,
    total_stock: 4200,
    out_of_stock_count: 12,
    low_stock_count: 8,
    with_orders_count: 45,
    total_pending_orders: 320,
  };

  it('GETs /global/products/stats', async () => {
    (apiMock.get as Mock).mockResolvedValueOnce({ data: sampleStats });

    const result = await productService.getGlobalProductsStats();

    expect(apiMock.get).toHaveBeenCalledWith(
      '/global/products/stats',
      expect.objectContaining({ params: undefined })
    );
    expect(result).toEqual(sampleStats);
  });

  it('forwards school_id and garment_type_id', async () => {
    (apiMock.get as Mock).mockResolvedValueOnce({ data: sampleStats });

    await productService.getGlobalProductsStats({
      school_id: 'school-1',
      garment_type_id: 'gt-2',
    });

    expect(apiMock.get).toHaveBeenCalledWith('/global/products/stats', {
      params: { school_id: 'school-1', garment_type_id: 'gt-2' },
    });
  });
});

// ============================================================================
// workforceService.getPerformanceStats
// ============================================================================

describe('workforceService.getPerformanceStats', () => {
  const sampleStats = {
    total_employees: 35,
    avg_score: 78,
    top_performers: 6,
    needs_attention: 3,
  };

  it('GETs /workforce/performance/stats', async () => {
    (apiMock.get as Mock).mockResolvedValueOnce({ data: sampleStats });

    const result = await workforceService.getPerformanceStats();

    expect(apiMock.get).toHaveBeenCalledWith(
      '/global/workforce/performance/stats',
      expect.objectContaining({ params: undefined })
    );
    expect(result).toEqual(sampleStats);
  });

  it('forwards period filters', async () => {
    (apiMock.get as Mock).mockResolvedValueOnce({ data: sampleStats });

    await workforceService.getPerformanceStats({
      period_start: '2026-04-01',
      period_end: '2026-04-30',
    });

    expect(apiMock.get).toHaveBeenCalledWith('/global/workforce/performance/stats', {
      params: { period_start: '2026-04-01', period_end: '2026-04-30' },
    });
  });
});

// ============================================================================
// userService.getUsers — is_active filter (regression for PayrollEmployeeModal)
// ============================================================================

describe('userService.getUsers — params dict signature', () => {
  function paginatedOf<T>(items: T[]) {
    return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
  }

  const mockUser = {
    id: 'u-1',
    username: 'alice',
    email: 'a@x.com',
    full_name: 'Alice',
    is_active: true,
    is_superuser: false,
    created_at: '2026-01-01T00:00:00',
    updated_at: null,
  };

  it('forwards is_active=true to the backend', async () => {
    (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockUser]) });

    await userService.getUsers({ is_active: true, limit: 100 });

    expect(apiMock.get).toHaveBeenCalledWith('/users', {
      params: { skip: 0, limit: 100, is_active: true },
    });
  });

  it('uses defaults when called with empty options', async () => {
    (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockUser]) });

    await userService.getUsers();

    expect(apiMock.get).toHaveBeenCalledWith('/users', {
      params: { skip: 0, limit: 100 },
    });
  });

  it('legacy array response is unwrapped into a paginated shape', async () => {
    (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockUser] });

    const result = await userService.getUsers({ skip: 0, limit: 50 });

    expect(result.items).toEqual([mockUser]);
  });
});

// ============================================================================
// orderService.approvePayment / rejectPayment
// ============================================================================

describe('orderService payment approval helpers', () => {
  const mockOrder = {
    id: 'order-1',
    code: 'ORD-001',
    school_id: 'school-1',
    status: 'pending',
    total: 100000,
    balance: 0,
    items_count: 2,
    items_delivered: 0,
    items_total: 2,
    created_at: '2026-05-01T00:00:00',
    delivery_type: 'pickup',
    delivery_fee: 0,
    delivery_address: null,
    delivery_neighborhood: null,
    user_id: null,
    user_name: null,
    school_name: 'Colegio Test',
    client_name: null,
    student_name: null,
    delivery_date: null,
    source: 'web_portal',
  };

  it('approvePayment POSTs to /schools/{schoolId}/orders/{orderId}/payment/approve', async () => {
    (apiMock.post as Mock).mockResolvedValueOnce({ data: mockOrder });

    const result = await orderService.approvePayment('school-1', 'order-1');

    expect(apiMock.post).toHaveBeenCalledWith(
      '/schools/school-1/orders/order-1/payment/approve'
    );
    expect(result.id).toBe('order-1');
  });

  it('rejectPayment POSTs reason in the body', async () => {
    (apiMock.post as Mock).mockResolvedValueOnce({ data: mockOrder });

    await orderService.rejectPayment('school-1', 'order-1', 'Comprobante ilegible');

    expect(apiMock.post).toHaveBeenCalledWith(
      '/schools/school-1/orders/order-1/payment/reject',
      { reason: 'Comprobante ilegible' }
    );
  });

  it('approvePayment propagates HTTP errors (e.g. 404 endpoint not found)', async () => {
    const err = new Error('Not Found');
    (apiMock.post as Mock).mockRejectedValueOnce(err);

    await expect(orderService.approvePayment('school-1', 'missing')).rejects.toThrow(
      'Not Found'
    );
  });
});
