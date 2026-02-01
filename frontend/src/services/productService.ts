/**
 * Product Service - API calls for products
 *
 * Two types of endpoints:
 * - Multi-school: /products - Lists from ALL schools user has access to
 * - School-specific: /schools/{school_id}/products - Original endpoints
 */
import apiClient from '../utils/api-client';
import type { Product, GarmentType, GlobalProduct, GlobalGarmentType, GarmentTypeImage } from '../types/api';

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

export const productService = {
  /**
   * Get all products from ALL schools user has access to (multi-school)
   */
  async getAllProducts(filters?: ProductFilters): Promise<Product[]> {
    const params = new URLSearchParams();
    if (filters?.school_id) params.append('school_id', filters.school_id);
    if (filters?.garment_type_id) params.append('garment_type_id', filters.garment_type_id);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.active_only !== undefined) params.append('active_only', String(filters.active_only));
    if (filters?.with_stock !== undefined) params.append('with_stock', String(filters.with_stock));
    if (filters?.with_images !== undefined) params.append('with_images', String(filters.with_images));
    if (filters?.missing_cost !== undefined) params.append('missing_cost', String(filters.missing_cost));
    if (filters?.skip) params.append('skip', String(filters.skip));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = queryString ? `/products?${queryString}` : '/products';
    const response = await apiClient.get<Product[]>(url);
    return response.data;
  },

  /**
   * Get all products for a school (backwards compatible)
   * Uses multi-school endpoint with school filter
   * with_images=true by default to show garment type images in product selectors
   */
  async getProducts(schoolId?: string, withInventory: boolean = true, limit: number = 500): Promise<Product[]> {
    if (schoolId) {
      return this.getAllProducts({
        school_id: schoolId,
        with_stock: withInventory,
        with_images: true,
        limit
      });
    }
    return this.getAllProducts({ with_stock: withInventory, with_images: true, limit });
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

  /**
   * Delete a product (soft delete)
   */
  async deleteProduct(schoolId: string, productId: string): Promise<void> {
    await apiClient.delete(`/schools/${schoolId}/products/${productId}`);
  },

  /**
   * Get all garment types from ALL schools (multi-school)
   */
  async getAllGarmentTypes(filters?: { school_id?: string; active_only?: boolean }): Promise<GarmentType[]> {
    const params = new URLSearchParams();
    if (filters?.school_id) params.append('school_id', filters.school_id);
    if (filters?.active_only !== undefined) params.append('active_only', String(filters.active_only));

    const queryString = params.toString();
    const url = queryString ? `/garment-types?${queryString}` : '/garment-types';
    const response = await apiClient.get<GarmentType[]>(url);
    return response.data;
  },

  /**
   * Get all garment types for a school (backwards compatible)
   */
  async getGarmentTypes(schoolId?: string): Promise<GarmentType[]> {
    if (schoolId) {
      return this.getAllGarmentTypes({ school_id: schoolId });
    }
    return this.getAllGarmentTypes();
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
  async getGlobalProducts(withInventory: boolean = true, limit: number = 500): Promise<GlobalProduct[]> {
    const response = await apiClient.get<GlobalProduct[]>('/global/products', {
      params: { with_inventory: withInventory, limit }
    });
    return response.data;
  },

  /**
   * Get a single global product by ID
   */
  async getGlobalProduct(productId: string): Promise<GlobalProduct> {
    const response = await apiClient.get<GlobalProduct>(`/global/products/${productId}`);
    return response.data;
  },

  /**
   * Search global products
   */
  async searchGlobalProducts(query: string, limit: number = 20): Promise<GlobalProduct[]> {
    const response = await apiClient.get<GlobalProduct[]>('/global/products/search', {
      params: { q: query, limit }
    });
    return response.data;
  },

  /**
   * Get all global garment types
   */
  async getGlobalGarmentTypes(activeOnly: boolean = true): Promise<GlobalGarmentType[]> {
    const response = await apiClient.get<GlobalGarmentType[]>('/global/garment-types', {
      params: { active_only: activeOnly }
    });
    return response.data;
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
  async createGlobalProduct(data: Partial<GlobalProduct>): Promise<GlobalProduct> {
    const response = await apiClient.post<GlobalProduct>('/global/products', data);
    return response.data;
  },

  /**
   * Update global product (superuser only)
   */
  async updateGlobalProduct(productId: string, data: Partial<GlobalProduct>): Promise<GlobalProduct> {
    const response = await apiClient.put<GlobalProduct>(`/global/products/${productId}`, data);
    return response.data;
  },

  // ==========================================
  // GLOBAL GARMENT TYPES - CRUD
  // ==========================================

  /**
   * Create global garment type (superuser only)
   */
  async createGlobalGarmentType(data: Partial<GlobalGarmentType>): Promise<GlobalGarmentType> {
    const response = await apiClient.post<GlobalGarmentType>('/global/garment-types', data);
    return response.data;
  },

  /**
   * Update global garment type (superuser only)
   */
  async updateGlobalGarmentType(typeId: string, data: Partial<GlobalGarmentType>): Promise<GlobalGarmentType> {
    const response = await apiClient.put<GlobalGarmentType>(`/global/garment-types/${typeId}`, data);
    return response.data;
  },

  // ==========================================
  // SCHOOL GARMENT TYPES - UPDATE (missing)
  // ==========================================

  /**
   * Update garment type for school (admin only)
   */
  async updateGarmentType(schoolId: string, typeId: string, data: Partial<GarmentType>): Promise<GarmentType> {
    const response = await apiClient.put<GarmentType>(`/schools/${schoolId}/garment-types/${typeId}`, data);
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
    return this.getAllProducts({
      school_id: schoolId,
      missing_cost: true,
      active_only: true,
      limit: 500
    });
  },
};
