import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAdminAuth } from './adminAuth';

// API Base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from store (only works client-side)
    if (typeof window !== 'undefined') {
      const storage = localStorage.getItem('admin-auth-storage');
      if (storage) {
        try {
          const { state } = JSON.parse(storage);
          if (state?.token) {
            config.headers.Authorization = `Bearer ${state.token}`;
          }
        } catch (e) {
          console.error('Error parsing auth storage:', e);
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, logout
      if (typeof window !== 'undefined') {
        useAdminAuth.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// Helper function to extract error messages from API responses
export function extractErrorMessage(err: unknown): string {
  // Axios error with response
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosError = err as AxiosError<{ detail?: unknown }>;
    const detail = axiosError.response?.data?.detail;

    // Pydantic validation errors (array of error objects)
    if (Array.isArray(detail)) {
      return detail
        .map((e: { loc?: string[]; msg?: string }) => {
          const field = e.loc?.[e.loc.length - 1] || 'Campo';
          return `${field}: ${e.msg}`;
        })
        .join('\n');
    }

    // Simple string error
    if (typeof detail === 'string') {
      return detail;
    }

    // HTTP status error
    if (axiosError.response?.status) {
      const status = axiosError.response.status;
      if (status === 400) return 'Datos invalidos. Revisa los campos.';
      if (status === 401) return 'Sesion expirada. Inicia sesion nuevamente.';
      if (status === 403) return 'No tienes permisos para esta accion.';
      if (status === 404) return 'El recurso no fue encontrado.';
      if (status === 409) return 'Ya existe un registro con estos datos.';
      if (status === 422) return 'Error de validacion. Revisa los campos.';
      if (status === 500) return 'Error del servidor. Intenta de nuevo.';
      return `Error HTTP ${status}`;
    }
  }

  // Standard Error object
  if (err instanceof Error && err.message) {
    return err.message;
  }

  // Network error
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: string }).message;
    if (msg.includes('Network') || msg.includes('network')) {
      return 'Error de conexion. Verifica tu internet.';
    }
    return msg;
  }

  return 'Error desconocido. Intenta de nuevo.';
}

// Types
export interface SchoolSettings {
  currency: string;
  tax_rate: number;
  commission_per_garment: number;
  allow_credit_sales: boolean;
  max_credit_days: number;
}

export interface School {
  id: string;
  code: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  settings?: SchoolSettings;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface SchoolInfoForRole {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface UserSchoolRole {
  id: string;
  user_id: string;
  school_id: string;
  role: 'owner' | 'admin' | 'seller' | 'viewer';
  created_at: string;
  school: SchoolInfoForRole;  // Nested school info from backend
}

export interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  is_superuser: boolean;
  last_login?: string;
  created_at: string;
  updated_at?: string;
  school_roles?: UserSchoolRole[];
}

export interface PaymentAccount {
  id: string;
  method_type: string;
  account_name: string;
  account_number: string;
  account_holder: string;
  bank_name?: string;
  account_type?: string;
  qr_code_url?: string;
  instructions?: string;
  display_order: number;
  is_active: boolean;
}

export interface DeliveryZone {
  id: string;
  name: string;
  description?: string;
  delivery_fee: number;
  estimated_days: number;
  is_active: boolean;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  size: string;
  color?: string;
  gender?: 'unisex' | 'male' | 'female';
  price: number;
  cost?: number;
  stock: number;
  inventory_quantity?: number;
  garment_type_id: string;
  garment_type_name?: string;
  image_url?: string;
  description?: string;
  school_id: string;
  is_global: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GlobalProduct {
  id: string;
  garment_type_id: string;
  garment_type_name?: string;
  code: string;
  name: string;
  size: string;
  color?: string;
  gender?: 'unisex' | 'male' | 'female';
  price: number;
  cost?: number;
  inventory_quantity: number;
  inventory_min_stock?: number;
  image_url?: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GarmentType {
  id: string;
  name: string;
  description?: string;
  category?: 'uniforme_diario' | 'uniforme_deportivo' | 'accesorios';
  image_url?: string;
  school_id: string;
  has_custom_measurements: boolean;
  requires_embroidery: boolean;
  base_price?: number;
  is_active: boolean;
  is_global: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GlobalGarmentType {
  id: string;
  name: string;
  description?: string;
  category?: 'uniforme_diario' | 'uniforme_deportivo' | 'accesorios';
  image_url?: string;
  has_custom_measurements: boolean;
  requires_embroidery: boolean;
  base_price?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DashboardStats {
  total_schools: number;
  total_users: number;
  total_superusers: number;
  total_products: number;
  total_orders_today: number;
  total_sales_today: number;
}

// Sales Types
export type SaleStatus = 'pending' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'nequi' | 'transfer' | 'card' | 'credit';
export type ChangeType = 'size_change' | 'product_change' | 'return' | 'defect';
export type ChangeStatus = 'pending' | 'pending_stock' | 'approved' | 'rejected';

export interface Sale {
  id: string;
  code: string;
  school_id: string;
  school_name?: string;
  client_id?: string;
  client_name?: string;
  client_phone?: string;
  user_id: string;
  user_name?: string;
  total: number;
  paid_amount: number;
  status: SaleStatus;
  payment_method?: PaymentMethod;
  source: string;
  notes?: string;
  sale_date: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id?: string;
  global_product_id?: string;
  product_code?: string;
  product_name?: string;
  product_size?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  is_global: boolean;
}

export interface SalePayment {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference?: string;
  created_at: string;
}

export interface SaleChange {
  id: string;
  sale_id: string;
  change_type: ChangeType;
  status: ChangeStatus;
  original_item_id: string;
  original_product_name?: string;
  new_product_id?: string;
  new_product_name?: string;
  quantity: number;
  price_difference: number;
  reason?: string;
  approved_by?: string;
  created_at: string;
  updated_at?: string;
}

// Sale Change List Item (from global endpoint /sale-changes)
export interface SaleChangeListItem {
  id: string;
  sale_id: string;
  sale_code: string;
  school_id?: string;
  school_name?: string;
  original_item_id?: string;
  change_type: ChangeType;
  change_date: string;
  returned_quantity: number;
  new_product_id?: string | null;
  new_quantity: number;
  new_unit_price: number | null;
  price_adjustment: number;
  status: ChangeStatus;
  reason: string;
  rejection_reason: string | null;
  created_at?: string;
  user_id?: string;
  user_name?: string | null;

  // Product information
  original_product_code?: string;
  original_product_name?: string;
  original_product_size?: string;
  original_product_color?: string;
  original_unit_price?: number;
  original_is_global?: boolean;

  new_product_code?: string;
  new_product_name?: string;
  new_product_size?: string;
  new_product_color?: string;
  new_is_global?: boolean;

  // User and order info
  user_username?: string;
  order_id?: string | null;
  order_code?: string | null;
}

// Transaction summary for sale change details
export interface TransactionSummary {
  id: string;
  type: string;
  amount: number;
  description?: string;
  transaction_date: string;
}

// Inventory movement summary for sale change details
export interface InventoryMovementSummary {
  id: string;
  product_code: string;
  product_name?: string;
  movement_type: 'entrada' | 'salida';
  quantity: number;
  created_at: string;
}

// Order summary for sale change details
export interface OrderSummary {
  id: string;
  code: string;
  status: string;
  delivery_date?: string;
}

// Full sale change detail response
export interface SaleChangeDetailResponse extends SaleChangeListItem {
  sale_total: number;
  sale_date: string;
  client_name?: string;
  school_name?: string;
  transactions: TransactionSummary[];
  inventory_movements: InventoryMovementSummary[];
  associated_order?: OrderSummary;
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
  payments?: SalePayment[];
  changes?: SaleChange[];
}

// Orders Types
export type OrderStatus = 'pending' | 'in_production' | 'ready' | 'delivered' | 'cancelled';
export type OrderItemStatus = 'pending' | 'in_production' | 'ready' | 'delivered' | 'cancelled';
export type DeliveryType = 'pickup' | 'delivery';
export type OrderType = 'catalog' | 'yomber' | 'custom';

// Yomber Measurements
export interface YomberMeasurements {
  delantero?: number;
  trasero?: number;
  cintura?: number;
  largo?: number;
  espalda?: number;
  cadera?: number;
  hombro?: number;
  pierna?: number;
  entrepierna?: number;
  manga?: number;
  cuello?: number;
  pecho?: number;
  busto?: number;
  tiro?: number;
}

export interface Order {
  id: string;
  code: string;
  school_id?: string;
  school_name?: string;
  client_id?: string;
  client_name?: string;
  client_phone?: string;
  user_id?: string;
  user_name?: string;
  total: number;
  paid_amount: number;
  balance: number;
  status: OrderStatus;
  delivery_date?: string;
  delivery_type?: DeliveryType;
  delivery_zone_id?: string;
  delivery_zone_name?: string;
  delivery_fee?: number;
  notes?: string;
  source?: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  garment_type_id?: string;
  garment_type_name?: string;
  product_id?: string;
  product_name?: string;
  product_code?: string;
  product_size?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  item_status: OrderItemStatus;
  custom_measurements?: Record<string, any>;
  embroidery_text?: string;
  reserved_from_stock?: boolean;
  quantity_reserved?: number;
  notes?: string;
}

export interface OrderPayment {
  id: string;
  order_id: string;
  amount: number;
  payment_method: PaymentMethod;
  reference?: string;
  created_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  payments?: OrderPayment[];
}

// Client Type (Clients are GLOBAL, not tied to schools)
export interface Client {
  id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  student_name?: string;
  student_grade?: string;
  is_active: boolean;
  client_type?: 'regular' | 'web';
  student_count?: number;
}

// Sale Create Types
export interface SaleItemCreate {
  product_id: string;
  quantity: number;
  unit_price: number;
  is_global: boolean;
}

export interface SalePaymentCreate {
  amount: number;
  payment_method: PaymentMethod;
  reference?: string;
}

export interface SaleCreate {
  school_id: string;
  client_id?: string;
  items: SaleItemCreate[];
  payments: SalePaymentCreate[];
  notes?: string;
  is_historical?: boolean;
  sale_date?: string;
}

export interface SaleCreateResponse {
  id: string;
  code: string;
  total: number;
  status: SaleStatus;
}
