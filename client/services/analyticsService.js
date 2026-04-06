import api from "./api.js";

export const analyticsService = {
  // Get analytics for the current user
  getAnalytics: async (orgId, projectId) => {
    const response = await api.get(`/analytics/overview?orgId=${orgId}&projectId=${projectId}`);
    return response.data;
  },
}; 