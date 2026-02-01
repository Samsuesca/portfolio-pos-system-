/**
 * Inventory Log Service
 * Client for inventory log endpoints - audit trail for stock movements
 */
import apiClient from '../utils/api-client';

export interface InventoryLog {
  id: string;
  inventory_id: string | null;
  global_inventory_id: string | null;
  school_id: string | null;
  movement_type: string;
  movement_date: string;
  quantity_delta: number;
  quantity_after: number;
  description: string;
  reference: string | null;
  sale_id: string | null;
  order_id: string | null;
  sale_change_id: string | null;
  created_by: string | null;
  created_at: string;
  // Enriched fields from backend
  product_code?: string | null;
  product_name?: string | null;
  product_size?: string | null;
  is_global_product?: boolean;
  created_by_name?: string | null;
}

export interface InventoryLogFilters {
  start_date?: string;
  end_date?: string;
  movement_type?: string;
  skip?: number;
  limit?: number;
}

export interface InventoryLogsResponse {
  items: InventoryLog[];
  total: number;
  skip: number;
  limit: number;
}

// Movement type labels and colors for UI
export const MOVEMENT_TYPE_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
  sale: { label: 'Venta', color: 'text-red-700', bgColor: 'bg-red-100' },
  sale_cancel: { label: 'Cancelación Venta', color: 'text-green-700', bgColor: 'bg-green-100' },
  order_reserve: { label: 'Reserva Encargo', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  order_cancel: { label: 'Cancelación Encargo', color: 'text-green-700', bgColor: 'bg-green-100' },
  order_deliver: { label: 'Entrega Encargo', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  change_return: { label: 'Devolución Cambio', color: 'text-green-700', bgColor: 'bg-green-100' },
  change_out: { label: 'Salida Cambio', color: 'text-red-700', bgColor: 'bg-red-100' },
  adjustment_in: { label: 'Ajuste Entrada', color: 'text-green-700', bgColor: 'bg-green-100' },
  adjustment_out: { label: 'Ajuste Salida', color: 'text-red-700', bgColor: 'bg-red-100' },
  purchase: { label: 'Compra', color: 'text-green-700', bgColor: 'bg-green-100' },
  initial: { label: 'Stock Inicial', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

// Helper to get label info for a movement type
export function getMovementTypeInfo(type: string): { label: string; color: string; bgColor: string } {
  return MOVEMENT_TYPE_LABELS[type] || { label: type, color: 'text-gray-700', bgColor: 'bg-gray-100' };
}

// Check if movement is stock in (positive)
export function isStockIn(type: string): boolean {
  return ['sale_cancel', 'order_cancel', 'change_return', 'adjustment_in', 'purchase', 'initial'].includes(type);
}

export const inventoryLogService = {
  /**
   * Get all inventory logs for a school (all products)
   */
  async getSchoolLogs(schoolId: string, filters?: InventoryLogFilters): Promise<InventoryLogsResponse> {
    const params = new URLSearchParams();
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.movement_type) params.append('movement_type', filters.movement_type);
    if (filters?.skip !== undefined) params.append('skip', String(filters.skip));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = `/schools/${schoolId}/inventory-logs${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient.get<InventoryLogsResponse>(url);
    return response.data;
  },

  /**
   * Get inventory logs for a specific school product
   */
  async getProductLogs(schoolId: string, productId: string, limit = 50): Promise<InventoryLog[]> {
    const response = await apiClient.get<InventoryLog[]>(
      `/schools/${schoolId}/inventory/${productId}/logs?limit=${limit}`
    );
    return response.data;
  },

  /**
   * Get inventory logs for a global product
   */
  async getGlobalProductLogs(productId: string, limit = 50): Promise<InventoryLog[]> {
    const response = await apiClient.get<InventoryLog[]>(
      `/global/inventory/${productId}/logs?limit=${limit}`
    );
    return response.data;
  },
};

export default inventoryLogService;
