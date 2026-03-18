/**
 * Shared types for the Products page and its sub-components.
 */
import type { Product, GlobalProduct, GarmentType, GlobalGarmentType } from '../../types/api';

export interface InventoryAdjustment {
  productId: string;
  productCode: string;
  productName: string;
  currentStock: number;
  isGlobal: boolean;
  schoolId?: string;
}

export type TabType = 'school' | 'global' | 'garment-types';
export type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'with_orders';
export type SortField = 'code' | 'name' | 'size' | 'price' | 'stock' | 'pending_orders';
export type SortDirection = 'asc' | 'desc';
export type AdjustmentType = 'add' | 'remove' | 'set';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface HistoryProductInfo {
  productId: string;
  productName: string;
  productCode: string;
  productSize?: string;
  currentStock?: number;
  schoolId: string;
  isGlobalProduct: boolean;
}

export interface ProductsStats {
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  withOrdersCount: number;
  totalPendingOrders: number;
}

export type ModalType =
  | 'product'
  | 'globalProduct'
  | 'garmentType'
  | 'inventory'
  | 'sale'
  | 'order'
  | 'history'
  | 'costManager'
  | null;

// Re-export commonly used types from api.ts for convenience
export type { Product, GlobalProduct, GarmentType, GlobalGarmentType };
