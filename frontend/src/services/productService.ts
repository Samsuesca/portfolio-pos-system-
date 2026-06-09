/**
 * Product Service - API calls for products
 *
 * Two types of endpoints:
 * - Multi-school: /products - Lists from ALL schools user has access to
 * - School-specific: /schools/{school_id}/products - Original endpoints
 */
import apiClient from '../utils/api-client';
import type { Product, GarmentType, GarmentTypeImage, CatalogOrderEntry, PaginatedResponse } from '../types/api';
import { unwrapPaginated, fetchAllPages } from '../utils/pagination';

export interface ProductFilters {
  school_id?: string;
  garment_type_id?: string;
  search?: string;
  active_only?: boolean;
  with_stock?: boolean;
  with_images?: boolean;
  missing_cost?: boolean;
  skip?: number;
  limit?: number;
  /** Server-side sort field. `pending_orders` is not supported by the backend. */
  sort_by?: 'code' | 'name' | 'size' | 'price' | 'stock';
  order?: 'asc' | 'desc';
}

export interface ProductCostUpdate {
  product_id: string;
  cost: number;
}

export interface BulkCostUpdateResult {
  updated: number;
  failed: number;
  errors: string[];
}

export interface DeleteResult {
  mode: 'deleted' | 'deactivated';
  message: string;
}

export interface ProductStats {
  total_products: number;
  total_stock: number;
  out_of_stock_count: number;
  low_stock_count: number;
  with_orders_count: number;
  total_pending_orders: number;
}

export const productService = {
  /**
   * Get all products from ALL schools user has access to (multi-school)
   */
  async getAllProducts(filters?: ProductFilters): Promise<PaginatedResponse<Product>> {
    const params = new URLSearchParams();
    if (filters?.school_id) params.append('school_id', filters.school_id);
    if (filters?.garment_type_id) params.append('garment_type_id', filters.garment_type_id);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.active_only !== undefined) params.append('active_only', String(filters.active_only));
    if (filters?.with_stock !== undefined) params.append('with_stock', String(filters.with_stock));
    if (filters?.with_images !== undefined) params.append('with_images', String(filters.with_images));
    if (filters?.missing_cost !== undefined) params.append('missing_cost', String(filters.missing_cost));
    if (filters?.skip !== undefined) params.append('skip', String(filters.skip));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.order) params.append('order', filters.order);

    const queryString = params.toString();
    const url = queryString ? `/products?${queryString}` : '/products';
    const response = await apiClient.get<PaginatedResponse<Product> | Product[]>(url);
    return unwrapPaginated(response.data);
  },

  /**
   * Get the COMPLETE multi-school catalog (every page), not a single capped
   * page. The catalog grid groups products by garment type, so a truncated
   * page would silently drop whole garment-type groups. No sort is applied —
   * the grid orders cards by garment type / catalog order, not by product.
   */
  async getAllProductsComplete(
    filters?: Omit<ProductFilters, 'skip' | 'limit' | 'sort_by' | 'order'>,
  ): Promise<Product[]> {
    return fetchAllPages(
      (skip, limit) => this.getAllProducts({ ...filters, skip, limit }),
    );
  },

  /**
   * Get all products for a school (backwards compatible)
   * Uses multi-school endpoint with school filter
   * with_images=true by default to show garment type images in product selectors
   */
  async getProducts(schoolId?: string, withInventory: boolean = true, limit: number = 500): Promise<Product[]> {
    const result = schoolId
      ? await this.getAllProducts({ school_id: schoolId, with_stock: withInventory, with_images: true, limit })
      : await this.getAllProducts({ with_stock: withInventory, with_images: true, limit });
    if (result.has_more) {
      console.warn(`[productService.getProducts] Catálogo truncado en ${limit} ítems (hay más). Migra el caller a getAllProducts paginado.`);
    }
    return result.items;
  },

  /**
   * Get a single product by ID (from any accessible school)
   */
  async getProductById(productId: string): Promise<Product> {
    const response = await apiClient.get<Product>(`/products/${productId}`);
    return response.data;
  },

  /**
   * Get a single product by ID (school-specific)
   */
  async getProduct(schoolId: string, productId: string): Promise<Product> {
    const response = await apiClient.get<Product>(`/schools/${schoolId}/products/${productId}`);
    return response.data;
  },

  /**
   * Create a new product (school-specific)
   */
  async createProduct(schoolId: string, data: Partial<Product>): Promise<Product> {
    const response = await apiClient.post<Product>(`/schools/${schoolId}/products`, data);
    return response.data;
  },

  /**
   * Update a product (school-specific)
   */
  async updateProduct(schoolId: string, productId: string, data: Partial<Product>): Promise<Product> {
    const response = await apiClient.put<Product>(`/schools/${schoolId}/products/${productId}`, data);
    return response.data;
  },

  async deleteProduct(schoolId: string, productId: string): Promise<DeleteResult> {
    const response = await apiClient.delete<DeleteResult>(`/schools/${schoolId}/products/${productId}`);
    return response.data;
  },

  /**
   * Get all garment types from ALL schools (multi-school)
   */
  async getAllGarmentTypes(filters?: { school_id?: string; active_only?: boolean; with_stats?: boolean; skip?: number; limit?: number }): Promise<PaginatedResponse<GarmentType>> {
    const params = new URLSearchParams();
    if (filters?.school_id) params.append('school_id', filters.school_id);
    if (filters?.active_only !== undefined) params.append('active_only', String(filters.active_only));
    if (filters?.with_stats) params.append('with_stats', 'true');
    if (filters?.skip !== undefined) params.append('skip', String(filters.skip));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = queryString ? `/garment-types?${queryString}` : '/garment-types';
    const response = await apiClient.get<PaginatedResponse<GarmentType> | GarmentType[]>(url);
    return unwrapPaginated(response.data);
  },

  /**
   * Get ALL multi-school garment types (every page). The catalog tree, filter
   * dropdown and grid grouping all need the full set — a capped page (default
   * 100) would hide types and make the grid drop their products.
   */
  async getAllGarmentTypesComplete(filters?: { school_id?: string; active_only?: boolean; with_stats?: boolean }): Promise<GarmentType[]> {
    return fetchAllPages(
      (skip, limit) => this.getAllGarmentTypes({ ...filters, skip, limit }),
    );
  },

  /**
   * Get all garment types for a school (backwards compatible)
   */
  async getGarmentTypes(schoolId?: string): Promise<GarmentType[]> {
    const result = schoolId
      ? await this.getAllGarmentTypes({ school_id: schoolId })
      : await this.getAllGarmentTypes();
    return result.items;
  },

  /**
   * Create a new garment type (school-specific)
   */
  async createGarmentType(schoolId: string, data: Partial<GarmentType>): Promise<GarmentType> {
    const response = await apiClient.post<GarmentType>(`/schools/${schoolId}/garment-types`, data);
    return response.data;
  },

  // ============================================
  // Global Products (shared across all schools)
  // ============================================

  /**
   * Get all global products with inventory
   */
  async getGlobalProducts(withInventory: boolean = true, limit: number = 500, withImages: boolean = false, skip: number = 0): Promise<PaginatedResponse<Product>> {
    const response = await apiClient.get<PaginatedResponse<Product> | Product[]>('/global/products', {
      params: { with_inventory: withInventory, limit, ...(withImages ? { with_images: true } : {}), ...(skip ? { skip } : {}) }
    });
    const result = unwrapPaginated(response.data);
    if (result.has_more) {
      console.warn(`[productService.getGlobalProducts] Catálogo global truncado en ${limit} ítems (hay más).`);
    }
    return result;
  },

  /**
   * Get the COMPLETE global catalog (every page). The global grid groups by
   * garment type, so a capped page would drop whole groups. Calls the endpoint
   * directly (not getGlobalProducts) so the per-page "truncated" warning — meant
   * for single-shot callers — doesn't fire while we deliberately paginate.
   */
  async getGlobalProductsComplete(withImages: boolean = false, schoolId?: string): Promise<Product[]> {
    return fetchAllPages(async (skip, limit) => {
      const response = await apiClient.get<PaginatedResponse<Product> | Product[]>('/global/products', {
        // With `school_id` the backend excludes the globals hidden for that school
        // (same exclusion the public web catalog uses), so the per-school grid only
        // surfaces globals the school actually shows — and can reorder them safely.
        params: { with_inventory: true, limit, ...(withImages ? { with_images: true } : {}), ...(skip ? { skip } : {}), ...(schoolId ? { school_id: schoolId } : {}) },
      });
      return unwrapPaginated(response.data);
    });
  },

  async getGlobalProductsStats(params?: {
    school_id?: string;
    garment_type_id?: string;
    scope?: 'global' | 'school' | 'all';
  }): Promise<ProductStats> {
    const response = await apiClient.get<ProductStats>('/global/products/stats', { params });
    return response.data;
  },

  async getGlobalProduct(productId: string): Promise<Product> {
    const response = await apiClient.get<Product>(`/global/products/${productId}`);
    return response.data;
  },

  async searchGlobalProducts(query: string, limit: number = 20): Promise<Product[]> {
    const response = await apiClient.get<Product[]>('/global/products/search', {
      params: { q: query, limit }
    });
    return response.data;
  },

  async getGlobalGarmentTypes(activeOnly: boolean = true, skip: number = 0, limit: number = 100): Promise<PaginatedResponse<GarmentType>> {
    const response = await apiClient.get<PaginatedResponse<GarmentType> | GarmentType[]>('/global/garment-types', {
      params: { active_only: activeOnly, ...(skip ? { skip } : {}), limit }
    });
    return unwrapPaginated(response.data);
  },

  /**
   * Get ALL global garment types (every page; this endpoint caps at 100/page).
   */
  async getGlobalGarmentTypesComplete(activeOnly: boolean = true): Promise<GarmentType[]> {
    return fetchAllPages(
      (skip, limit) => this.getGlobalGarmentTypes(activeOnly, skip, limit),
      100,
    );
  },

  /**
   * Adjust global inventory (superuser only)
   */
  async adjustGlobalInventory(productId: string, adjustment: number, reason?: string): Promise<void> {
    await apiClient.post(`/global/products/${productId}/inventory/adjust`, {
      adjustment,
      reason: reason || `Ajuste manual: ${adjustment > 0 ? 'Agregar' : 'Remover'} ${Math.abs(adjustment)} unidades`
    });
  },

  // ==========================================
  // GLOBAL PRODUCTS - CRUD
  // ==========================================

  /**
   * Create global product (superuser only)
   */
  async createGlobalProduct(data: Partial<Product>): Promise<Product> {
    const response = await apiClient.post<Product>('/global/products', data);
    return response.data;
  },

  async updateGlobalProduct(productId: string, data: Partial<Product>): Promise<Product> {
    const response = await apiClient.put<Product>(`/global/products/${productId}`, data);
    return response.data;
  },

  // ==========================================
  // GLOBAL GARMENT TYPE - VISIBILIDAD POR COLEGIO
  // ==========================================

  /**
   * Colegios donde este garment_type global esta OCULTO del catalogo publico.
   * Modelo de exclusion: vacio = visible en todos.
   */
  async getGlobalGtVisibility(garmentTypeId: string): Promise<string[]> {
    const response = await apiClient.get<{ hidden_school_ids: string[] }>(
      `/global/garment-types/${garmentTypeId}/visibility`
    );
    return response.data.hidden_school_ids;
  },

  /**
   * Reemplaza el set de colegios donde este garment_type global esta oculto.
   */
  async setGlobalGtVisibility(garmentTypeId: string, hiddenSchoolIds: string[]): Promise<void> {
    await apiClient.put(`/global/garment-types/${garmentTypeId}/visibility`, {
      hidden_school_ids: hiddenSchoolIds,
    });
  },

  // ==========================================
  // GLOBAL GARMENT TYPES - CRUD
  // ==========================================

  /**
   * Create global garment type (superuser only)
   */
  async createGlobalGarmentType(data: Partial<GarmentType>): Promise<GarmentType> {
    const response = await apiClient.post<GarmentType>('/global/garment-types', data);
    return response.data;
  },

  async updateGlobalGarmentType(typeId: string, data: Partial<GarmentType>): Promise<GarmentType> {
    const response = await apiClient.put<GarmentType>(`/global/garment-types/${typeId}`, data);
    return response.data;
  },

  // ==========================================
  // SCHOOL GARMENT TYPES - UPDATE & DELETE
  // ==========================================

  async updateGarmentType(schoolId: string, typeId: string, data: Partial<GarmentType>): Promise<GarmentType> {
    const response = await apiClient.put<GarmentType>(`/schools/${schoolId}/garment-types/${typeId}`, data);
    return response.data;
  },

  async deleteGarmentType(schoolId: string, garmentTypeId: string): Promise<DeleteResult> {
    const response = await apiClient.delete<DeleteResult>(`/schools/${schoolId}/garment-types/${garmentTypeId}`);
    return response.data;
  },

  // ==========================================
  // GLOBAL DELETE
  // ==========================================

  async deleteGlobalProduct(productId: string): Promise<DeleteResult> {
    const response = await apiClient.delete<DeleteResult>(`/global/products/${productId}`);
    return response.data;
  },

  async deleteGlobalGarmentType(garmentTypeId: string): Promise<DeleteResult> {
    const response = await apiClient.delete<DeleteResult>(`/global/garment-types/${garmentTypeId}`);
    return response.data;
  },

  // ==========================================
  // GARMENT TYPE IMAGES
  // ==========================================

  /**
   * Get images for a garment type
   */
  async getGarmentTypeImages(schoolId: string, garmentTypeId: string): Promise<GarmentTypeImage[]> {
    const response = await apiClient.get<GarmentTypeImage[]>(`/schools/${schoolId}/garment-types/${garmentTypeId}/images`);
    return response.data;
  },

  /**
   * Upload an image for a garment type
   */
  async uploadGarmentTypeImage(schoolId: string, garmentTypeId: string, file: File): Promise<GarmentTypeImage> {
    const response = await apiClient.uploadFile<GarmentTypeImage>(
      `/schools/${schoolId}/garment-types/${garmentTypeId}/images`,
      file,
      'file'
    );
    return response.data;
  },

  /**
   * Delete an image from a garment type
   */
  async deleteGarmentTypeImage(schoolId: string, garmentTypeId: string, imageId: string): Promise<void> {
    await apiClient.delete(`/schools/${schoolId}/garment-types/${garmentTypeId}/images/${imageId}`);
  },

  /**
   * Set an image as primary for a garment type
   */
  async setGarmentTypePrimaryImage(schoolId: string, garmentTypeId: string, imageId: string): Promise<unknown> {
    const response = await apiClient.put(
      `/schools/${schoolId}/garment-types/${garmentTypeId}/images/${imageId}/primary`
    );
    return response.data;
  },

  /**
   * Reorder images for a garment type
   */
  async reorderGarmentTypeImages(schoolId: string, garmentTypeId: string, imageIds: string[]): Promise<GarmentTypeImage[]> {
    const response = await apiClient.put<GarmentTypeImage[]>(
      `/schools/${schoolId}/garment-types/${garmentTypeId}/images/reorder`,
      { image_ids: imageIds }
    );
    return response.data;
  },

  // ==========================================
  // CATALOG ORDER (per-school garment-type card order)
  // ==========================================

  /**
   * Get the persisted catalog order (garment-type cards) for a school.
   */
  async getCatalogOrder(schoolId: string): Promise<CatalogOrderEntry[]> {
    const response = await apiClient.get<CatalogOrderEntry[]>(
      `/schools/${schoolId}/catalog/garment-types/order`
    );
    return response.data;
  },

  /**
   * Persist a new catalog order for a school. `garmentTypeIds[0]` is shown first.
   * Requires the `catalog.reorder` permission.
   */
  async reorderCatalog(schoolId: string, garmentTypeIds: string[]): Promise<CatalogOrderEntry[]> {
    const response = await apiClient.put<CatalogOrderEntry[]>(
      `/schools/${schoolId}/catalog/garment-types/reorder`,
      { garment_type_ids: garmentTypeIds }
    );
    return response.data;
  },

  // ==========================================
  // GLOBAL GARMENT TYPE IMAGES
  // ==========================================

  /**
   * Get images for a global garment type
   */
  async getGlobalGarmentTypeImages(garmentTypeId: string): Promise<GarmentTypeImage[]> {
    const response = await apiClient.get<GarmentTypeImage[]>(`/global/garment-types/${garmentTypeId}/images`);
    return response.data;
  },

  /**
   * Upload an image for a global garment type (superuser only)
   */
  async uploadGlobalGarmentTypeImage(garmentTypeId: string, file: File): Promise<GarmentTypeImage> {
    const response = await apiClient.uploadFile<GarmentTypeImage>(
      `/global/garment-types/${garmentTypeId}/images`,
      file,
      'file'
    );
    return response.data;
  },

  /**
   * Delete an image from a global garment type (superuser only)
   */
  async deleteGlobalGarmentTypeImage(garmentTypeId: string, imageId: string): Promise<void> {
    await apiClient.delete(`/global/garment-types/${garmentTypeId}/images/${imageId}`);
  },

  /**
   * Set an image as primary for a global garment type (superuser only)
   */
  async setGlobalGarmentTypePrimaryImage(garmentTypeId: string, imageId: string): Promise<unknown> {
    const response = await apiClient.put(
      `/global/garment-types/${garmentTypeId}/images/${imageId}/primary`
    );
    return response.data;
  },

  /**
   * Reorder images for a global garment type (superuser only)
   */
  async reorderGlobalGarmentTypeImages(garmentTypeId: string, imageIds: string[]): Promise<unknown> {
    const response = await apiClient.put(
      `/global/garment-types/${garmentTypeId}/images/reorder`,
      { image_ids: imageIds }
    );
    return response.data;
  },

  /**
   * Bulk update product costs
   */
  async bulkUpdateCosts(updates: ProductCostUpdate[]): Promise<BulkCostUpdateResult> {
    const response = await apiClient.patch<BulkCostUpdateResult>(
      '/products/bulk-update-costs',
      { updates }
    );
    return response.data;
  },

  /**
   * Get products without cost (convenience method)
   */
  async getProductsWithoutCost(schoolId?: string): Promise<Product[]> {
    const result = await this.getAllProducts({
      school_id: schoolId,
      missing_cost: true,
      active_only: true,
      limit: 500
    });
    return result.items;
  },
};
