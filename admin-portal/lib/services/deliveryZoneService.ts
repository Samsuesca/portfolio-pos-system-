import apiClient, { DeliveryZone } from '../api';

export interface CreateDeliveryZoneData {
  name: string;
  description?: string;
  delivery_fee: number;
  estimated_days: number;
  is_active?: boolean;
}

export interface UpdateDeliveryZoneData {
  name?: string;
  description?: string;
  delivery_fee?: number;
  estimated_days?: number;
  is_active?: boolean;
}

const deliveryZoneService = {
  // List all delivery zones
  list: async () => {
    const response = await apiClient.get<DeliveryZone[]>('/delivery-zones', {
      params: { include_inactive: true }
    });
    return response.data;
  },

  // Get delivery zone by ID
  getById: async (id: string) => {
    const response = await apiClient.get<DeliveryZone>(`/delivery-zones/${id}`);
    return response.data;
  },

  // Create new delivery zone
  create: async (data: CreateDeliveryZoneData) => {
    const response = await apiClient.post<DeliveryZone>('/delivery-zones', data);
    return response.data;
  },

  // Update delivery zone (backend uses PATCH)
  update: async (id: string, data: UpdateDeliveryZoneData) => {
    const response = await apiClient.patch<DeliveryZone>(`/delivery-zones/${id}`, data);
    return response.data;
  },

  // Delete delivery zone
  delete: async (id: string) => {
    const response = await apiClient.delete(`/delivery-zones/${id}`);
    return response.data;
  },
};

export default deliveryZoneService;
