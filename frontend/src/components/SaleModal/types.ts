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

export interface SaleItemCreateExtended extends SaleItemCreate {
  display_name?: string;
  size?: string;
  school_id: string;
  school_name: string;
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
}
