import apiClient from '../utils/apiClient';
import type { School, DashboardStats, PaginatedResponse } from '../types/api';
import { unwrapPaginated } from '../utils/pagination';

export const schoolService = {
  getSchools: async (activeOnly = true) => {
    const response = await apiClient.get<School[] | PaginatedResponse<School>>('/schools', { params: { active_only: activeOnly } });
    return { ...response, data: unwrapPaginated(response.data).items };
  },

  getSchool: (schoolId: string) =>
    apiClient.get<School>(`/schools/${schoolId}`),

  getDashboardStats: () =>
    apiClient.get<DashboardStats>('/global/dashboard/stats'),
};
