import api from './api';

// x-org-id / x-project-id are injected by the api interceptor from the active
// workspace, so tenant scope never has to be passed explicitly here.

export const semanticSearch = async ({ query, limit = 12, projectId, signal }) => {
  const { data } = await api.post(
    '/ai/search',
    { query, limit, projectId },
    { signal }
  );
  return data;
};

export const findSimilar = async ({ title, what, why, entryId, limit = 5, projectId, signal }) => {
  const { data } = await api.post(
    '/ai/similar',
    { title, what, why, entryId, limit, projectId },
    { signal }
  );
  return data;
};
