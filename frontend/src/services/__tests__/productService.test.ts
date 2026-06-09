import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { productService } from '../productService';
import type { Product, GarmentType, PaginatedResponse } from '../../types/api';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    uploadFile: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

function paginatedOf<T>(items: T[]): PaginatedResponse<T> {
  return { items, total: items.length, skip: 0, limit: 100, page: 1, total_pages: 1, has_more: false };
}

const mockProduct: Product = {
  id: 'prod-1',
  code: 'PROD-001',
  school_id: 'school-1',
  garment_type_id: 'gt-1',
  name: 'Camiseta',
  size: 'M',
  color: 'Blanco',
  price: 50000,
  cost: 20000,
  is_active: true,
  created_at: '2026-01-01T00:00:00',
} as unknown as Product;

const mockGarmentType: GarmentType = {
  id: 'gt-1',
  school_id: 'school-1',
  name: 'Camiseta',
  is_active: true,
} as unknown as GarmentType;

const mockGlobalProduct: Product = {
  id: 'gp-1',
  name: 'Zapatos',
  price: 80000,
  is_active: true,
  school_id: null,
  is_global: true,
} as unknown as Product;

describe('productService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllProducts', () => {
    it('fetches all products with no filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockProduct]) });

      const result = await productService.getAllProducts();

      expect(apiMock.get).toHaveBeenCalledWith('/products');
      expect(result.items).toHaveLength(1);
    });

    it('appends all filters to query string', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await productService.getAllProducts({
        school_id: 'school-1',
        garment_type_id: 'gt-1',
        search: 'Camiseta',
        active_only: true,
        with_stock: true,
        with_images: false,
        missing_cost: true,
        skip: 10,
        limit: 50,
      });

      expect(apiMock.get).toHaveBeenCalledWith(
        '/products?school_id=school-1&garment_type_id=gt-1&search=Camiseta&active_only=true&with_stock=true&with_images=false&missing_cost=true&skip=10&limit=50'
      );
    });

    it('wraps legacy array response into PaginatedResponse', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockProduct] });

      const result = await productService.getAllProducts();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.has_more).toBe(false);
    });
  });

  describe('complete (paginated-loop) fetchers', () => {
    function page<T>(items: T[], has_more: boolean, skip: number): PaginatedResponse<T> {
      return { items, total: 999, skip, limit: 500, page: 1, total_pages: 9, has_more };
    }

    it('getAllProductsComplete walks every page until has_more is false', async () => {
      const p1 = { ...mockProduct, id: 'a' };
      const p2 = { ...mockProduct, id: 'b' };
      const p3 = { ...mockProduct, id: 'c' };
      (apiMock.get as Mock)
        .mockResolvedValueOnce({ data: page([p1, p2], true, 0) })
        .mockResolvedValueOnce({ data: page([p3], false, 500) });

      const items = await productService.getAllProductsComplete({ school_id: 'school-1' });

      expect(apiMock.get).toHaveBeenCalledTimes(2);
      expect(items.map(i => i.id)).toEqual(['a', 'b', 'c']);
      // Page size is 500, advancing skip by 500 each round.
      expect(apiMock.get).toHaveBeenNthCalledWith(1, expect.stringContaining('skip=0&limit=500'));
      expect(apiMock.get).toHaveBeenNthCalledWith(2, expect.stringContaining('skip=500&limit=500'));
    });

    it('getAllProductsComplete stops after a single page when has_more is false', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: page([mockProduct], false, 0) });

      const items = await productService.getAllProductsComplete();

      expect(apiMock.get).toHaveBeenCalledTimes(1);
      expect(items).toHaveLength(1);
    });

    it('getAllGarmentTypesComplete concatenates all pages', async () => {
      const g2 = { ...mockGarmentType, id: 'gt-2' };
      (apiMock.get as Mock)
        .mockResolvedValueOnce({ data: page([mockGarmentType], true, 0) })
        .mockResolvedValueOnce({ data: page([g2], false, 500) });

      const items = await productService.getAllGarmentTypesComplete({ with_stats: true });

      expect(apiMock.get).toHaveBeenCalledTimes(2);
      expect(items.map(i => i.id)).toEqual(['gt-1', 'gt-2']);
    });

    it('getGlobalProductsComplete walks every page', async () => {
      const gp2 = { ...mockGlobalProduct, id: 'gp-2' };
      (apiMock.get as Mock)
        .mockResolvedValueOnce({ data: page([mockGlobalProduct], true, 0) })
        .mockResolvedValueOnce({ data: page([gp2], false, 500) });

      const items = await productService.getGlobalProductsComplete();

      expect(apiMock.get).toHaveBeenCalledTimes(2);
      expect(items.map(i => i.id)).toEqual(['gp-1', 'gp-2']);
    });
  });

  describe('getProducts', () => {
    it('returns items array for a school', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockProduct]) });

      const result = await productService.getProducts('school-1');

      expect(apiMock.get).toHaveBeenCalledWith(
        expect.stringContaining('/products?school_id=school-1')
      );
      expect(result).toHaveLength(1);
      expect(Array.isArray(result)).toBe(true);
    });

    it('fetches all schools when no schoolId provided', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await productService.getProducts();

      const calledUrl = (apiMock.get as Mock).mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('school_id');
    });
  });

  describe('getProductById', () => {
    it('fetches product without school context', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockProduct });

      const result = await productService.getProductById('prod-1');

      expect(apiMock.get).toHaveBeenCalledWith('/products/prod-1');
      expect(result.id).toBe('prod-1');
    });
  });

  describe('getProduct', () => {
    it('fetches school-specific product', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockProduct });

      const result = await productService.getProduct('school-1', 'prod-1');

      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/products/prod-1');
      expect(result.id).toBe('prod-1');
    });
  });

  describe('createProduct', () => {
    it('posts to school-specific endpoint', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockProduct });

      const result = await productService.createProduct('school-1', { name: 'Camiseta', price: 50000 });

      expect(apiMock.post).toHaveBeenCalledWith('/schools/school-1/products', { name: 'Camiseta', price: 50000 });
      expect(result.id).toBe('prod-1');
    });
  });

  describe('updateProduct', () => {
    it('puts updated product data', async () => {
      const updated = { ...mockProduct, price: 55000 };
      (apiMock.put as Mock).mockResolvedValueOnce({ data: updated });

      const result = await productService.updateProduct('school-1', 'prod-1', { price: 55000 });

      expect(apiMock.put).toHaveBeenCalledWith('/schools/school-1/products/prod-1', { price: 55000 });
      expect(result.price).toBe(55000);
    });
  });

  describe('deleteProduct', () => {
    it('deletes and returns delete result', async () => {
      const deleteResult = { mode: 'deleted' as const, message: 'Eliminado' };
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: deleteResult });

      const result = await productService.deleteProduct('school-1', 'prod-1');

      expect(apiMock.delete).toHaveBeenCalledWith('/schools/school-1/products/prod-1');
      expect(result.mode).toBe('deleted');
    });
  });

  describe('getAllGarmentTypes', () => {
    it('fetches garment types with no filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockGarmentType]) });

      const result = await productService.getAllGarmentTypes();

      expect(apiMock.get).toHaveBeenCalledWith('/garment-types');
      expect(result.items).toHaveLength(1);
    });

    it('appends school_id and active_only filters', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([]) });

      await productService.getAllGarmentTypes({ school_id: 'school-1', active_only: true });

      expect(apiMock.get).toHaveBeenCalledWith('/garment-types?school_id=school-1&active_only=true');
    });

    it('wraps legacy array response', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockGarmentType] });

      const result = await productService.getAllGarmentTypes();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getGarmentTypes', () => {
    it('returns items array for a school', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockGarmentType]) });

      const result = await productService.getGarmentTypes('school-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].id).toBe('gt-1');
    });
  });

  describe('createGarmentType', () => {
    it('posts to school-specific endpoint', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockGarmentType });

      const result = await productService.createGarmentType('school-1', { name: 'Camiseta' });

      expect(apiMock.post).toHaveBeenCalledWith('/schools/school-1/garment-types', { name: 'Camiseta' });
      expect(result.id).toBe('gt-1');
    });
  });

  describe('global products', () => {
    it('getGlobalProducts wraps array response', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockGlobalProduct] });

      const result = await productService.getGlobalProducts();

      expect(apiMock.get).toHaveBeenCalledWith('/global/products', { params: { with_inventory: true, limit: 500 } });
      expect(result.items).toHaveLength(1);
    });

    it('getGlobalProduct fetches by ID', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockGlobalProduct });

      const result = await productService.getGlobalProduct('gp-1');

      expect(apiMock.get).toHaveBeenCalledWith('/global/products/gp-1');
      expect(result.id).toBe('gp-1');
    });

    it('searchGlobalProducts calls search endpoint', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockGlobalProduct] });

      const result = await productService.searchGlobalProducts('zapatos');

      expect(apiMock.get).toHaveBeenCalledWith('/global/products/search', { params: { q: 'zapatos', limit: 20 } });
      expect(result).toHaveLength(1);
    });

    it('createGlobalProduct posts to global endpoint', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockGlobalProduct });

      const result = await productService.createGlobalProduct({ name: 'Zapatos' });

      expect(apiMock.post).toHaveBeenCalledWith('/global/products', { name: 'Zapatos' });
      expect(result.id).toBe('gp-1');
    });

    it('updateGlobalProduct puts to global endpoint', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: mockGlobalProduct });

      await productService.updateGlobalProduct('gp-1', { price: 90000 });

      expect(apiMock.put).toHaveBeenCalledWith('/global/products/gp-1', { price: 90000 });
    });

    it('adjustGlobalInventory posts adjustment', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: undefined });

      await productService.adjustGlobalInventory('gp-1', 10, 'Recepcion de mercancia');

      expect(apiMock.post).toHaveBeenCalledWith('/global/products/gp-1/inventory/adjust', {
        adjustment: 10,
        reason: 'Recepcion de mercancia',
      });
    });

    it('adjustGlobalInventory uses auto-generated reason when none provided', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: undefined });

      await productService.adjustGlobalInventory('gp-1', -5);

      const [, body] = (apiMock.post as Mock).mock.calls[0];
      expect(body.reason).toContain('Remover');
      expect(body.reason).toContain('5');
    });

    it('deleteGlobalProduct deletes and returns result', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: { mode: 'deleted', message: 'OK' } });

      const result = await productService.deleteGlobalProduct('gp-1');

      expect(apiMock.delete).toHaveBeenCalledWith('/global/products/gp-1');
      expect(result.mode).toBe('deleted');
    });
  });

  describe('bulk operations', () => {
    it('bulkUpdateCosts patches with updates array', async () => {
      const bulkResult = { updated: 2, failed: 0, errors: [] };
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: bulkResult });

      const result = await productService.bulkUpdateCosts([
        { product_id: 'prod-1', cost: 25000 },
        { product_id: 'prod-2', cost: 30000 },
      ]);

      expect(apiMock.patch).toHaveBeenCalledWith('/products/bulk-update-costs', {
        updates: [
          { product_id: 'prod-1', cost: 25000 },
          { product_id: 'prod-2', cost: 30000 },
        ],
      });
      expect(result.updated).toBe(2);
    });

    it('getProductsWithoutCost returns items array', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: paginatedOf([mockProduct]) });

      const result = await productService.getProductsWithoutCost('school-1');

      expect(Array.isArray(result)).toBe(true);
      const calledUrl = (apiMock.get as Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('missing_cost=true');
      expect(calledUrl).toContain('active_only=true');
    });
  });

  describe('garment type images', () => {
    it('getGarmentTypeImages fetches images', async () => {
      const images = [{ id: 'img-1', url: 'https://example.com/img.jpg' }];
      (apiMock.get as Mock).mockResolvedValueOnce({ data: images });

      const result = await productService.getGarmentTypeImages('school-1', 'gt-1');

      expect(apiMock.get).toHaveBeenCalledWith('/schools/school-1/garment-types/gt-1/images');
      expect(result).toHaveLength(1);
    });

    it('deleteGarmentTypeImage deletes by imageId', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: undefined });

      await productService.deleteGarmentTypeImage('school-1', 'gt-1', 'img-1');

      expect(apiMock.delete).toHaveBeenCalledWith('/schools/school-1/garment-types/gt-1/images/img-1');
    });

    it('reorderGarmentTypeImages puts image order', async () => {
      (apiMock.put as Mock).mockResolvedValueOnce({ data: [] });

      await productService.reorderGarmentTypeImages('school-1', 'gt-1', ['img-2', 'img-1']);

      expect(apiMock.put).toHaveBeenCalledWith(
        '/schools/school-1/garment-types/gt-1/images/reorder',
        { image_ids: ['img-2', 'img-1'] }
      );
    });
  });

  describe('error propagation', () => {
    it('propagates errors from getAllProducts', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Network Error'));

      await expect(productService.getAllProducts()).rejects.toThrow('Network Error');
    });
  });
});
