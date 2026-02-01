import apiClient, { Product, GarmentType, GlobalProduct, GlobalGarmentType } from '../api';

export interface CreateProductData {
  garment_type_id: string;
  name?: string;
  size: string;
  color?: string;
  gender?: 'unisex' | 'male' | 'female';
  price: number;
  cost?: number;
  description?: string;
  image_url?: string;
  stock?: number;
}

export interface UpdateProductData {
  code?: string;
  name?: string;
  size?: string;
  color?: string;
  gender?: 'unisex' | 'male' | 'female';
  price?: number;
  cost?: number;
  description?: string;
  garment_type_id?: string;
  image_url?: string;
  is_active?: boolean;
}

export interface InventoryAdjustment {
  adjustment: number;  // Positive to add, negative to remove
  reason?: string;
}

export interface CreateGarmentTypeData {
  name: string;
  description?: string;
  category?: 'uniforme_diario' | 'uniforme_deportivo' | 'accesorios';
  requires_embroidery?: boolean;
  has_custom_measurements?: boolean;
  image_url?: string;
}

export interface UpdateGarmentTypeData {
  name?: string;
  description?: string;
  category?: 'uniforme_diario' | 'uniforme_deportivo' | 'accesorios';
  requires_embroidery?: boolean;
  has_custom_measurements?: boolean;
  image_url?: string;
  is_active?: boolean;
}

export interface GlobalInventoryAdjustment {
  adjustment: number;
  reason?: string;
}

const productService = {
  // ========== School Products ==========

  // List products for a school
  listBySchool: async (schoolId: string, params?: { skip?: number; limit?: number }) => {
    const response = await apiClient.get<Product[]>(`/schools/${schoolId}/products`, { params });
    return response.data;
  },

  // Get product by ID
  getById: async (schoolId: string, productId: string) => {
    const response = await apiClient.get<Product>(`/schools/${schoolId}/products/${productId}`);
    return response.data;
  },

  // Create product for school
  create: async (schoolId: string, data: CreateProductData) => {
    const response = await apiClient.post<Product>(`/schools/${schoolId}/products`, data);
    return response.data;
  },

  // Update product
  update: async (schoolId: string, productId: string, data: UpdateProductData) => {
    const response = await apiClient.put<Product>(`/schools/${schoolId}/products/${productId}`, data);
    return response.data;
  },

  // Delete product
  delete: async (schoolId: string, productId: string) => {
    const response = await apiClient.delete(`/schools/${schoolId}/products/${productId}`);
    return response.data;
  },

  // Adjust inventory
  adjustInventory: async (schoolId: string, productId: string, data: InventoryAdjustment) => {
    const response = await apiClient.post(`/schools/${schoolId}/inventory/product/${productId}/adjust`, data);
    return response.data;
  },

  // ========== Global Products ==========

  // List global products
  listGlobal: async (params?: { skip?: number; limit?: number }) => {
    const response = await apiClient.get<GlobalProduct[]>('/global/products', { params });
    return response.data;
  },

  // Get global products with inventory
  getGlobalProducts: async (withInventory: boolean = true) => {
    const response = await apiClient.get<GlobalProduct[]>('/global/products', {
      params: { with_inventory: withInventory },
    });
    return response.data;
  },

  // Create global product
  createGlobal: async (data: CreateProductData) => {
    const response = await apiClient.post<Product>('/global/products', data);
    return response.data;
  },

  // Update global product
  updateGlobal: async (productId: string, data: UpdateProductData) => {
    const response = await apiClient.put<Product>(`/global/products/${productId}`, data);
    return response.data;
  },

  // Delete global product
  deleteGlobal: async (productId: string) => {
    const response = await apiClient.delete(`/global/products/${productId}`);
    return response.data;
  },

  // ========== Garment Types ==========

  // List garment types for a school
  listGarmentTypes: async (schoolId: string) => {
    const response = await apiClient.get<GarmentType[]>(`/schools/${schoolId}/garment-types`);
    return response.data;
  },

  // Create garment type
  createGarmentType: async (schoolId: string, data: CreateGarmentTypeData) => {
    const response = await apiClient.post<GarmentType>(`/schools/${schoolId}/garment-types`, data);
    return response.data;
  },

  // Update garment type
  updateGarmentType: async (schoolId: string, garmentTypeId: string, data: CreateGarmentTypeData) => {
    const response = await apiClient.put<GarmentType>(`/schools/${schoolId}/garment-types/${garmentTypeId}`, data);
    return response.data;
  },

  // Delete garment type
  deleteGarmentType: async (schoolId: string, garmentTypeId: string) => {
    const response = await apiClient.delete(`/schools/${schoolId}/garment-types/${garmentTypeId}`);
    return response.data;
  },

  // List global garment types
  listGlobalGarmentTypes: async () => {
    const response = await apiClient.get<GlobalGarmentType[]>('/global/garment-types');
    return response.data;
  },

  // Create global garment type
  createGlobalGarmentType: async (data: CreateGarmentTypeData) => {
    const response = await apiClient.post<GlobalGarmentType>('/global/garment-types', data);
    return response.data;
  },

  // Update global garment type
  updateGlobalGarmentType: async (garmentTypeId: string, data: UpdateGarmentTypeData) => {
    const response = await apiClient.put<GlobalGarmentType>(`/global/garment-types/${garmentTypeId}`, data);
    return response.data;
  },

  // Delete global garment type
  deleteGlobalGarmentType: async (garmentTypeId: string) => {
    const response = await apiClient.delete(`/global/garment-types/${garmentTypeId}`);
    return response.data;
  },

  // Adjust global inventory
  adjustGlobalInventory: async (productId: string, data: GlobalInventoryAdjustment) => {
    const response = await apiClient.post(`/global/products/${productId}/inventory/adjust`, data);
    return response.data;
  },

  // Get products with inventory (school-specific)
  getProducts: async (schoolId: string, withInventory: boolean = true) => {
    const response = await apiClient.get<Product[]>(`/schools/${schoolId}/products`, {
      params: { with_inventory: withInventory },
    });
    return response.data;
  },

  // Get garment types for school
  getGarmentTypes: async (schoolId: string) => {
    const response = await apiClient.get<GarmentType[]>(`/schools/${schoolId}/garment-types`);
    return response.data;
  },

  // Get global garment types
  getGlobalGarmentTypes: async () => {
    const response = await apiClient.get<GlobalGarmentType[]>('/global/garment-types');
    return response.data;
  },
};

export default productService;
