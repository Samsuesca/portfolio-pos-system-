/**
 * SaleModal Types
 * Shared types for sale modal components
 */
import type { SaleItemCreate } from '../../services/saleService';

// Payment line for multiple payments
export interface PaymentLine {
  id: string;
  amount: number;
  payment_method: '' | 'cash' | 'nequi' | 'transfer' | 'card' | 'credit';
  amount_received?: number;  // Cash change tracking
}

// Extended type for sale items with global flag AND school info for multi-school support
export interface SaleItemCreateExtended extends SaleItemCreate {
  is_global: boolean;
  display_name?: string;
  size?: string;          // Product size for display
  school_id: string;      // School this item belongs to
  school_name: string;    // For display in UI
}

// Result of creating a sale (for multi-school success modal)
export interface SaleResult {
  schoolName: string;
  saleCode: string;
  total: number;
  saleId: string;
  paymentMethod: string;
}

// Form data state
export interface SaleFormData {
  client_id: string;
  notes: string;
  is_historical: boolean;
  sale_date: string;  // ISO date string for historical sales
  // Separate date fields for easier input
  sale_day: string;
  sale_month: string;
  sale_year: string;
}

// Current item being added
export interface CurrentItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  is_global: boolean;
}
