import api from '@/services/api';

export const fetchGraph = async (orgId, projectId) => {
  try {
    const orgIdString = typeof orgId === 'object' ? orgId._id : orgId;
    const projectIdString = typeof projectId === 'object' ? projectId._id : projectId;
    const response = await api.get(`/entries/graph?orgId=${orgIdString}&projectId=${projectIdString}`, {
      headers: {
        'x-org-id': orgIdString,
        'x-project-id': projectIdString,
      },
    });
    return response.data.data;
  } catch (error) {
    console.error('Failed to fetch graph:', error);
    throw error;
  }
};

export const addRelation = async (entryId, targetEntryId, relationType, orgId, projectId) => {
  try {
    const orgIdString = typeof orgId === 'object' ? orgId._id : orgId;
    const projectIdString = typeof projectId === 'object' ? projectId._id : projectId;
    const response = await api.post(`/entries/${entryId}/relations`, {
      targetEntryId,
      type: relationType,
    }, {
      headers: {
        'x-org-id': orgIdString,
        'x-project-id': projectIdString,
      },
    });
    return response.data.data;
  } catch (error) {
    console.error('Failed to add relation:', error);
    throw error;
  }
};

export const removeRelation = async (entryId, targetEntryId, orgId, projectId) => {
  try {
    const orgIdString = typeof orgId === 'object' ? orgId._id : orgId;
    const projectIdString = typeof projectId === 'object' ? projectId._id : projectId;
    const response = await api.delete(`/entries/${entryId}/relations/${targetEntryId}`, {
      headers: {
        'x-org-id': orgIdString,
        'x-project-id': projectIdString,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to remove relation:', error);
    throw error;
  }
};
