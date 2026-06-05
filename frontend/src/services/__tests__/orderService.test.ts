import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { orderService } from '../orderService';
import type { Order, OrderListItem, OrderWithItems, PaginatedResponse } from '../../types/api';

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

const mockOrderItem: OrderListItem = {
  id: 'order-1',
  code: 'CARACAS-001-ENC-2026-0001',
  school_id: 'school-1',
  school_name: 'Colegio Test',
  client_id: 'client-1',
  client_name: 'Juan Perez',
  total: 200000,
  amount_paid: 100000,
  balance: 100000,
  status: 'pending',
  delivery_date: '2026-02-15',
  created_at: '2026-01-15T10:00:00',
  items_count: 3,
  source: 'desktop_app',
} as unknown as OrderListItem;

const mockOrder: Order = {
  id: 'order-1',
  code: 'CARACAS-001-ENC-2026-0001',
  school_id: 'school-1',
  client_id: 'client-1',
  total: 200000,
  amount_paid: 100000,
  balance: 100000,
  status: 'pending',
  delivery_date: '2026-02-15',
  created_at: '2026-01-15T10:00:00',
  notes: null,
} as unknown as Order;

describe('orderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllOrders', () => {
    it('fetches all orders with no filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockOrderItem]) });

      const result = await orderService.getAllOrders();

      expect(apiMock.get).toHaveBeenCalledWith('/orders');
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('appends query params from filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await orderService.getAllOrders({
        school_id: 'school-1',
        status: 'pending',
        search: 'ENC',
        skip: 10,
        limit: 50,
        source_filter: 'exclude_web_portal',
        client_id: 'client-1',
        start_date: '2026-01-01',
        end_date: '2026-01-31',
      });

      expect(apiMock.get).toHaveBeenCalledWith(
        '/orders?school_id=school-1&status=pending&search=ENC&skip=10&limit=50&source_filter=exclude_web_portal&client_id=client-1&start_date=2026-01-01&end_date=2026-01-31'
      );
    });

    it('does not append undefined filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await orderService.getAllOrders({ school_id: undefined, status: undefined });

      expect(apiMock.get).toHaveBeenCalledWith('/orders');
    });
  });

  describe('getOrderStats', () => {
    it('fetches stats with no filters', async () => {
      const mockStats = { pending: 5, in_production: 3, ready: 2 };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockStats });

      const result = await orderService.getOrderStats();

      expect(apiMock.get).toHaveBeenCalledWith('/orders/stats');
      expect(result.pending).toBe(5);
    });

    it('appends school_id filter', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: {} });

      await orderService.getOrderStats({ school_id: 'school-1' });

      expect(apiMock.get).toHaveBeenCalledWith('/orders/stats?school_id=school-1');
    });
  });

  describe('getOrders', () => {
    it('delegates to getAllOrders with school_id filter', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockOrderItem]) });

      const result = await orderService.getOrders('school-1');

      expect(apiMock.get).toHaveBeenCalledWith('/orders?school_id=school-1');
      expect(result.items[0].id).toBe('order-1');
    });

    it('appends status when provided', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await orderService.getOrders('school-1', 'pending');

      expect(apiMock.get).toHaveBeenCalledWith('/orders?school_id=school-1&status=pending');
    });

    it('fetches all schools when no school_id provided', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await orderService.getOrders();

      expect(apiMock.get).toHaveBeenCalledWith('/orders');
    });
  });

  describe('getOrderById', () => {
    it('fetches a single order by ID', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockOrder });

      const result = await orderService.getOrderById('order-1');

      expect(apiMock.get).toHaveBeenCalledWith('/orders/order-1');
      expect(result.id).toBe('order-1');
    });
  });

  describe('getOrder', () => {
    it('fetches school-specific order with items', async () => {
      const mockWithItems = { ...mockOrder, items: [] } as unknown as OrderWithItems;
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockWithItems });

      const result = await orderService.getOrder('school-1', 'order-1');

      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/orders/order-1');
      expect(result.id).toBe('order-1');
    });
  });

  describe('getOrderDetails', () => {
    it('fetches full order details without school_id', async () => {
      const mockWithItems = { ...mockOrder, items: [] } as unknown as OrderWithItems;
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockWithItems });

      const result = await orderService.getOrderDetails('order-1');

      expect(apiMock.get).toHaveBeenCalledWith('/orders/order-1/details');
      expect(result.id).toBe('order-1');
    });
  });

  describe('createOrder', () => {
    it('posts order data to school-specific endpoint', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockOrder });

      const orderData = {
        client_id: 'client-1',
        delivery_date: '2026-02-15',
        items: [{ garment_type_id: 'gt-1', size: 'M', quantity: 2, unit_price: 100000 }],
        payments: [{ amount: 100000, payment_method: 'cash' as const }],
      };

      const result = await orderService.createOrder('school-1', orderData as any);

      expect(apiMock.post).toHaveBeenCalledWith('/schools/school-1/orders', orderData);
      expect(result.id).toBe('order-1');
    });
  });

  describe('updateStatus', () => {
    it('patches status with query param', async () => {
      const updated = { ...mockOrder, status: 'in_production' };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: updated });

      const result = await orderService.updateStatus('school-1', 'order-1', 'in_production');

      expect(apiMock.patch).toHaveBeenCalledWith(
        '/schools/school-1/orders/order-1/status',
        null,
        { params: { new_status: 'in_production' } }
      );
      expect(result.status).toBe('in_production');
    });
  });

  describe('addPayment', () => {
    it('posts payment to order payments endpoint', async () => {
      const updated = { ...mockOrder, amount_paid: 200000, balance: 0 };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: updated });

      const payment = { amount: 100000, payment_method: 'cash' as const };
      const result = await orderService.addPayment('school-1', 'order-1', payment);

      expect(apiMock.post).toHaveBeenCalledWith(
        '/schools/school-1/orders/order-1/payments',
        payment
      );
      expect(result.balance).toBe(0);
    });
  });

  describe('updateOrder', () => {
    it('patches order fields', async () => {
      const updated = { ...mockOrder, notes: 'Urgente' };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: updated });

      const result = await orderService.updateOrder('school-1', 'order-1', { notes: 'Urgente' });

      expect(apiMock.patch).toHaveBeenCalledWith(
        '/schools/school-1/orders/order-1',
        { notes: 'Urgente' }
      );
      expect(result.notes).toBe('Urgente');
    });
  });

  describe('updateItemStatus', () => {
    it('patches item status', async () => {
      const mockItem = { id: 'item-1', item_status: 'ready' };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: mockItem });

      const result = await orderService.updateItemStatus('school-1', 'order-1', 'item-1', 'ready');

      expect(apiMock.patch).toHaveBeenCalledWith(
        '/schools/school-1/orders/order-1/items/item-1/status',
        { item_status: 'ready' }
      );
      expect(result.item_status).toBe('ready');
    });
  });

  describe('cancelOrder', () => {
    it('posts cancel with reason as query param', async () => {
      const cancelled = { ...mockOrder, status: 'cancelled' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: cancelled });

      const result = await orderService.cancelOrder('school-1', 'order-1', 'Pedido duplicado');

      expect(apiMock.post).toHaveBeenCalledWith(
        '/schools/school-1/orders/order-1/cancel',
        null,
        { params: { reason: 'Pedido duplicado' } }
      );
      expect(result.status).toBe('cancelled');
    });

    it('posts cancel without reason when not provided', async () => {
      const cancelled = { ...mockOrder, status: 'cancelled' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: cancelled });

      await orderService.cancelOrder('school-1', 'order-1');

      expect(apiMock.post).toHaveBeenCalledWith(
        '/schools/school-1/orders/order-1/cancel',
        null,
        { params: {} }
      );
    });
  });

  describe('approveOrderWithStock', () => {
    it('posts approve with auto_fulfill defaults', async () => {
      const approved = { ...mockOrder, status: 'in_production' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: approved });

      const result = await orderService.approveOrderWithStock('school-1', 'order-1');

      expect(apiMock.post).toHaveBeenCalledWith(
        '/schools/school-1/orders/order-1/approve',
        { auto_fulfill_if_stock: true, items: [], notify_client: true }
      );
      expect(result.status).toBe('in_production');
    });
  });

  describe('sendReceiptEmail', () => {
    it('posts to send-receipt endpoint', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: { message: 'Email enviado', success: true } });

      const result = await orderService.sendReceiptEmail('school-1', 'order-1');

      expect(apiMock.post).toHaveBeenCalledWith('/schools/school-1/orders/order-1/send-receipt');
      expect(result.success).toBe(true);
    });
  });

  describe('getClientActiveOrders', () => {
    it('returns only non-cancelled and non-delivered orders', async () => {
      const items: OrderListItem[] = [
        { ...mockOrderItem, id: 'order-1', status: 'pending' },
        { ...mockOrderItem, id: 'order-2', status: 'cancelled' },
        { ...mockOrderItem, id: 'order-3', status: 'delivered' },
        { ...mockOrderItem, id: 'order-4', status: 'ready' },
      ];
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf(items) });

      const result = await orderService.getClientActiveOrders('client-1');

      expect(result).toHaveLength(2);
      expect(result.map(o => o.id)).toEqual(['order-1', 'order-4']);
    });
  });

  describe('resolveDuplicate', () => {
    it('posts resolve-duplicate with sale_id and notes', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockOrder });

      await orderService.resolveDuplicate('school-1', 'order-1', 'sale-1', 'Venta ya registrada');

      expect(apiMock.post).toHaveBeenCalledWith(
        '/schools/school-1/orders/order-1/resolve-duplicate',
        null,
        { params: { sale_id: 'sale-1', notes: 'Venta ya registrada' } }
      );
    });

    it('omits notes param when not provided', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockOrder });

      await orderService.resolveDuplicate('school-1', 'order-1', 'sale-1');

      expect(apiMock.post).toHaveBeenCalledWith(
        '/schools/school-1/orders/order-1/resolve-duplicate',
        null,
        { params: { sale_id: 'sale-1' } }
      );
    });
  });

  describe('getProductDemand', () => {
    it('fetches demand with no filters', async () => {
      const mockDemand = { items: [], total: 0 };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockDemand });

      const result = await orderService.getProductDemand();

      expect(apiMock.get).toHaveBeenCalledWith('/orders/demand');
      expect(result).toEqual(mockDemand);
    });

    it('appends demand filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { items: [], total: 0 } });

      await orderService.getProductDemand({
        school_id: 'school-1',
        include_ready: true,
        type_filter: 'standard',
        sort_by: 'quantity',
        sort_order: 'desc',
      });

      expect(apiMock.get).toHaveBeenCalledWith(
        '/orders/demand?school_id=school-1&include_ready=true&type_filter=standard&sort_by=quantity&sort_order=desc'
      );
    });
  });

  describe('error propagation', () => {
    it('propagates API errors from getAllOrders', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Network Error'));

      await expect(orderService.getAllOrders()).rejects.toThrow('Network Error');
    });

    it('propagates errors from getOrderById', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('HTTP 404'));

      await expect(orderService.getOrderById('nonexistent')).rejects.toThrow('HTTP 404');
    });
  });
});
