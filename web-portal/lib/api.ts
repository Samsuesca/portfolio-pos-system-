import axios from 'axios';
import { getPublicToken, clearPublicToken } from './auth';

// API Base URL - se configura desde variables de entorno (exported for image URLs)
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Public client - NO authentication required (for public endpoints like /schools)
const publicClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Authenticated client - requires public-viewer token
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token (only for apiClient)
apiClient.interceptors.request.use(
  async (config) => {
    // Get public token for catalog access
    try {
      const token = await getPublicToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Failed to add auth token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, clear cache and retry once
      clearPublicToken();
      const originalRequest = error.config;

      if (!originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const token = await getPublicToken();
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        } catch (retryError) {
          return Promise.reject(retryError);
        }
      }
    }
    return Promise.reject(error);
  }
);

// Types
export interface School {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  email?: string;
  settings?: Record<string, unknown>;
  is_active: boolean;
}

export interface GarmentTypeImage {
  id: string;
  image_url: string;
  display_order: number;
  is_primary: boolean;
  garment_type_id: string;
  school_id: string;
  created_at: string;
}

export interface Product {
  id: string;
  school_id: string;
  garment_type_id: string;
  name: string;
  code: string;
  description?: string;
  size?: string;
  gender?: string;
  color?: string;
  price: number;
  stock?: number; // Campo devuelto por ProductListResponse cuando with_stock=true
  stock_quantity?: number; // Alias por compatibilidad
  inventory_quantity?: number; // Para GlobalProduct
  min_stock_level?: number;
  location?: string;
  barcode?: string;
  is_active: boolean;
  // Garment type info for catalog display
  garment_type_name?: string; // Nombre del tipo de prenda (ej: "Camiseta Amarillo")
  garment_type_images?: GarmentTypeImage[];
  garment_type_primary_image_url?: string | null;
}

export interface Client {
  id: string;
  school_id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  student_name?: string;
  student_grade?: string;
  notes?: string;
  is_active: boolean;
}

export interface OrderItem {
  garment_type_id?: string; // Optional for web_custom orders
  quantity: number;
  unit_price: number;
  size?: string;
  gender?: string;
  custom_measurements?: Record<string, unknown>;
  notes?: string;
  order_type?: string;
  product_id?: string;
  needs_quotation?: boolean;
}

// Delivery Types
export type DeliveryType = 'pickup' | 'delivery';

export interface DeliveryZone {
  id: string;
  name: string;
  description?: string;
  delivery_fee: number;
  estimated_days: number;
}

export interface OrderCreateData {
  school_id?: string | null;
  client_id: string;
  items: OrderItem[];
  notes?: string;
  custom_school_name?: string;
  // Delivery fields
  delivery_type?: DeliveryType;
  delivery_address?: string;
  delivery_neighborhood?: string;
  delivery_city?: string;
  delivery_references?: string;
  delivery_zone_id?: string;
}

export interface Order {
  id: string;
  school_id: string;
  code: string;
  client_id: string;
  order_date: string;
  delivery_date?: string;
  status: string;
  total_amount: number;
  notes?: string;
  items: OrderItem[];
}

// API Endpoints

// Schools (public endpoints - no auth required)
export const schoolsApi = {
  list: () => publicClient.get<School[]>('/schools'),
  getBySlug: (slug: string) => publicClient.get<School>(`/schools/slug/${slug}`),
};

// Products
export const productsApi = {
  list: (schoolId: string, params?: { is_active?: boolean; with_stock?: boolean; with_images?: boolean }) =>
    apiClient.get<Product[]>('/products', { params: { school_id: schoolId, with_stock: true, with_images: true, ...params } }),
  get: (schoolId: string, productId: string) =>
    apiClient.get<Product>(`/schools/${schoolId}/products/${productId}`),
  listGlobal: (params?: { with_inventory?: boolean; limit?: number }) =>
    apiClient.get<Product[]>('/global/products', { params }),

  // Search products with filters
  search: async (schoolId: string, params: {
    query?: string;
    category?: string;
    size?: string;
    min_price?: number;
    max_price?: number;
    in_stock?: boolean;
    global_search?: boolean;
  }): Promise<Product[]> => {
    const { global_search, query, category, size, min_price, max_price, in_stock } = params;

    // If no search query, just use the regular list endpoint with filters
    if (!query || query.trim().length === 0) {
      const response = await apiClient.get<Product[]>('/products', {
        params: {
          school_id: schoolId,
          with_stock: true,
          with_images: true,
          is_active: true
        }
      });
      let results = response.data;

      // Apply client-side filters since backend doesn't support all filters in search
      if (category && category !== 'all') {
        const categoryLower = category.toLowerCase();
        results = results.filter(p => {
          const name = p.name.toLowerCase();
          if (categoryLower === 'camisas') return name.includes('camisa') || name.includes('blusa') || name.includes('camiseta');
          if (categoryLower === 'chompas') return name.includes('chompa');
          if (categoryLower === 'pantalones') return name.includes('pantalon') || name.includes('falda');
          if (categoryLower === 'sudaderas') return name.includes('sudadera') || name.includes('buzo') || name.includes('chaqueta');
          if (categoryLower === 'yomber') return name.includes('yomber');
          if (categoryLower === 'calzado') return name.includes('zapato') || name.includes('tennis') || name.includes('media') || name.includes('jean');
          return false;
        });
      }

      if (size && size !== 'all') {
        results = results.filter(p => p.size === size);
      }

      if (min_price !== undefined || max_price !== undefined) {
        results = results.filter(p => {
          const price = p.price;
          if (min_price !== undefined && price < min_price) return false;
          if (max_price !== undefined && price > max_price) return false;
          return true;
        });
      }

      if (in_stock) {
        results = results.filter(p => (p.stock ?? p.stock_quantity ?? p.inventory_quantity ?? 0) > 0);
      }

      return results;
    }

    // Use backend search endpoint if query exists
    const url = global_search
      ? '/global/products/search'
      : `/schools/${schoolId}/products/search/by-term`;

    const response = await apiClient.get<Product[]>(url, {
      params: { q: query, limit: 100 }
    });
    let results = response.data;

    // Apply client-side filters to search results
    if (category && category !== 'all') {
      const categoryLower = category.toLowerCase();
      results = results.filter(p => {
        const name = p.name.toLowerCase();
        if (categoryLower === 'camisas') return name.includes('camisa') || name.includes('blusa') || name.includes('camiseta');
        if (categoryLower === 'chompas') return name.includes('chompa');
        if (categoryLower === 'pantalones') return name.includes('pantalon') || name.includes('falda');
        if (categoryLower === 'sudaderas') return name.includes('sudadera') || name.includes('buzo') || name.includes('chaqueta');
        if (categoryLower === 'yomber') return name.includes('yomber');
        if (categoryLower === 'calzado') return name.includes('zapato') || name.includes('tennis') || name.includes('media') || name.includes('jean');
        return false;
      });
    }

    if (size && size !== 'all') {
      results = results.filter(p => p.size === size);
    }

    if (min_price !== undefined || max_price !== undefined) {
      results = results.filter(p => {
        const price = p.price;
        if (min_price !== undefined && price < min_price) return false;
        if (max_price !== undefined && price > max_price) return false;
        return true;
      });
    }

    if (in_stock) {
      results = results.filter(p => (p.stock ?? p.stock_quantity ?? p.inventory_quantity ?? 0) > 0);
    }

    return results;
  },

  // Get price statistics for a school's products
  getStats: async (schoolId: string): Promise<{ min_price: number; max_price: number }> => {
    const response = await apiClient.get<Product[]>('/products', {
      params: { school_id: schoolId, with_stock: true }
    });
    const products = response.data;

    if (products.length === 0) {
      return { min_price: 0, max_price: 100000 };
    }

    return {
      min_price: Math.min(...products.map(p => p.price)),
      max_price: Math.max(...products.map(p => p.price))
    };
  },
};

// Clients (Web Portal Registration)
export interface ClientWebRegister {
  name: string;
  email: string;
  password: string;
  phone?: string;
  students: Array<{
    school_id: string;
    student_name: string;
    student_grade?: string;
    student_section?: string;
    notes?: string;
  }>;
}

export const clientsApi = {
  // Web portal client registration (public endpoint - sin autenticación)
  register: async (data: ClientWebRegister) => {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${API_BASE_URL}/api/v1/portal/clients/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error en el registro' }));
      throw new Error(error.detail || 'Error en el registro');
    }

    const result = await response.json();
    return { data: result };
  },
};

// Delivery Zones (public endpoint - no auth required)
export const deliveryZonesApi = {
  listPublic: async (): Promise<DeliveryZone[]> => {
    const response = await publicClient.get<DeliveryZone[]>('/delivery-zones/public');
    return response.data;
  },
};

// Orders
export const ordersApi = {
  // Web portal order creation (public endpoint - sin autenticación)
  createWeb: async (data: OrderCreateData) => {
    // Use Next.js API proxy to avoid CORS issues
    const response = await fetch('/api/orders/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al crear el pedido' }));
      throw new Error(error.detail || 'Error al crear el pedido');
    }

    const result = await response.json();
    return { data: result };
  },
  create: (schoolId: string, data: { school_id: string; client_id: string; items: OrderItem[]; notes?: string }) =>
    apiClient.post<Order>(`/schools/${schoolId}/orders`, data),
  get: (schoolId: string, orderId: string) =>
    apiClient.get<Order>(`/schools/${schoolId}/orders/${orderId}`),

  // Upload payment proof (public endpoint - sin autenticación)
  uploadPaymentProof: async (orderId: string, file: File, notes?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (notes && notes.trim()) {
      formData.append('notes', notes.trim());
    }

    // Use Next.js API proxy to avoid CORS issues
    const response = await fetch(`/api/orders/${orderId}/upload-payment-proof`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Error al subir el comprobante' }));
      throw new Error(error.detail || 'Error al subir el comprobante');
    }

    const result = await response.json();
    return { data: result };
  },
};

// Helper function for product images (placeholder)
export const getProductImage = (productName: string): string => {
  const name = productName.toLowerCase();
  if (name.includes('camisa') || name.includes('blusa')) return '👕';
  if (name.includes('pantalon') || name.includes('falda')) return '👖';
  if (name.includes('sudadera') || name.includes('buzo')) return '🧥';
  if (name.includes('zapato') || name.includes('tennis')) return '👟';
  if (name.includes('media') || name.includes('calcet')) return '🧦';
  return '👔';
};
