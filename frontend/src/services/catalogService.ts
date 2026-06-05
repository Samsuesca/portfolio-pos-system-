import apiClient from '../utils/api-client';

export interface Position {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PositionCreate {
  code: string;
  name: string;
  description?: string;
}

export interface PositionUpdate {
  code?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
  sort_order?: number;
}

export const catalogService = {
  getPositions: async (includeInactive = false): Promise<Position[]> => {
    const response = await apiClient.get<Position[]>('/global/catalog/positions', {
      params: { include_inactive: includeInactive },
    });
    return response.data;
  },

  createPosition: async (data: PositionCreate): Promise<Position> => {
    const response = await apiClient.post<Position>('/global/catalog/positions', data);
    return response.data;
  },

  updatePosition: async (id: string, data: PositionUpdate): Promise<Position> => {
    const response = await apiClient.patch<Position>(`/global/catalog/positions/${id}`, data);
    return response.data;
  },

  deletePosition: async (id: string): Promise<void> => {
    await apiClient.delete(`/global/catalog/positions/${id}`);
  },
};
