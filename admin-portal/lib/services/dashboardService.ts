import apiClient, { DashboardStats } from '../api';

const dashboardService = {
  // Get dashboard statistics
  getStats: async () => {
    const response = await apiClient.get<DashboardStats>('/global/dashboard/stats');
    return response.data;
  },
};

export default dashboardService;
