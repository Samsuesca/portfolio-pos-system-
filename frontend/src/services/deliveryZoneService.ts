/**
 * Delivery Zone Service
 * Handles API calls for delivery zone management
 */
import apiClient from '../utils/api-client';

export interface DeliveryZone {
  id: string;
  name: string;
  description: string | null;
  delivery_fee: number;
  estimated_days: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryZoneCreate {
  name: string;
  description?: string;
  delivery_fee: number;
  estimated_days: number;
}

export interface DeliveryZoneUpdate {
  name?: string;
  description?: string;
  delivery_fee?: number;
  estimated_days?: number;
  is_active?: boolean;
}

export const deliveryZoneService = {
  /**
   * List all delivery zones (admin)
   */
  getZones: async (includeInactive: boolean = true): Promise<DeliveryZone[]> => {
    const response = await apiClient.get<DeliveryZone[]>('/delivery-zones', {
      params: { include_inactive: includeInactive }
    });
    return response.data;
  },

  /**
   * Get a specific delivery zone
   */
  getZone: async (zoneId: string): Promise<DeliveryZone> => {
    const response = await apiClient.get<DeliveryZone>(`/delivery-zones/${zoneId}`);
    return response.data;
  },

  /**
   * Create a new delivery zone
   */
  createZone: async (data: DeliveryZoneCreate): Promise<DeliveryZone> => {
    const response = await apiClient.post<DeliveryZone>('/delivery-zones', data);
    return response.data;
  },

  /**
   * Update a delivery zone
   */
  updateZone: async (zoneId: string, data: DeliveryZoneUpdate): Promise<DeliveryZone> => {
    const response = await apiClient.patch<DeliveryZone>(`/delivery-zones/${zoneId}`, data);
    return response.data;
  },

  /**
   * Deactivate a delivery zone (soft delete)
   */
  deleteZone: async (zoneId: string): Promise<void> => {
    await apiClient.delete(`/delivery-zones/${zoneId}`);
  },
};
