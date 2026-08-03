import api from './api';

// x-org-id / x-project-id are injected by the api interceptor from the active
// workspace, so tenant scope never has to be passed explicitly here.

// Generation can legitimately take a while on a cold model. This is longer than
// the default so a slow-but-successful answer is not thrown away, and shorter
// than forever so a wedged request eventually surfaces.
const CHAT_TIMEOUT_MS = 90_000;

export const semanticSearch = async ({ query, limit = 12, projectId, signal }) => {
  const { data } = await api.post('/ai/search', { query, limit, projectId }, { signal });
  return data;
};

export const askQuestion = async ({ question, conversationId, limit = 5, projectId, signal }) => {
  const { data } = await api.post(
    '/ai/chat',
    { question, conversationId, limit, projectId },
    { signal, timeout: CHAT_TIMEOUT_MS }
  );
  return data;
};

export const listConversations = async ({ signal } = {}) => {
  const { data } = await api.get('/ai/conversations', { signal });
  return data.conversations || [];
};

export const getConversation = async ({ id, signal }) => {
  const { data } = await api.get(`/ai/conversations/${id}`, { signal });
  return data.conversation;
};

export const deleteConversation = async ({ id }) => {
  await api.delete(`/ai/conversations/${id}`);
};

export const findSimilar = async ({ title, what, why, entryId, limit = 5, projectId, signal }) => {
  const { data } = await api.post(
    '/ai/similar',
    { title, what, why, entryId, limit, projectId },
    { signal }
  );
  return data;
};

/**
 * Turn any failure into something a user can act on.
 *
 * Users should never see a status code or a stack trace: those describe our
 * problem, not theirs. Each case maps to what they can actually do next.
 */
export const friendlyError = (err) => {
  if (err?.code === 'ECONNABORTED') {
    return 'That took longer than expected. Try asking again, or a simpler question.';
  }
  const status = err?.response?.status;
  if (status === 503) return 'The assistant is temporarily unavailable. Search still works.';
  if (status === 429) return 'Too many questions at once. Give it a moment and try again.';
  if (status === 404) return 'That conversation is no longer available.';
  if (status === 400) return 'Pick a workspace before asking a question.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  if (err?.message === 'Network Error') return 'Cannot reach the assistant. Check your connection.';
  return 'Could not get an answer just now. Please try again.';
};
