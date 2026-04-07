'use client';

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';

export const fetchEntries = createAsyncThunk(
  'entries/fetchEntries',
  async ({ orgId, projectId, type, query, tag, page = 1, limit = 12, sort = 'newest' }, { rejectWithValue }) => {
    try {
      // Extract ID if orgId is an object, otherwise use as-is
      const orgIdString = typeof orgId === 'object' ? orgId._id : orgId;
      const projectIdString = typeof projectId === 'object' ? projectId._id : projectId;
      let url = `/entries?orgId=${orgIdString}&projectId=${projectIdString}&page=${page}&limit=${limit}&sort=${sort}`;
      if (type && type !== 'all') url += `&type=${type}`;
      if (query) url += `&q=${encodeURIComponent(query)}`;
      if (tag) url += `&tag=${encodeURIComponent(tag)}`;
      
      const response = await api.get(url);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch entries');
    }
  }
);

export const fetchEntry = createAsyncThunk(
  'entries/fetchEntry',
  async ({ id, orgId, projectId }, { rejectWithValue }) => {
    try {
      // Extract ID if orgId is an object, otherwise use as-is
      const orgIdString = typeof orgId === 'object' ? orgId._id : orgId;
      const projectIdString = typeof projectId === 'object' ? projectId._id : projectId;
      const response = await api.get(`/entries/${id}?orgId=${orgIdString}&projectId=${projectIdString}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch entry');
    }
  }
);

export const createEntry = createAsyncThunk(
  'entries/createEntry',
  async (data, { rejectWithValue }) => {
    try {
      const isFormData = data instanceof FormData;
      let url = '/entries';
      let orgId = '';
      let projectId = '';
      
      // Extract scope from FormData if present
      if (isFormData) {
        orgId = data.get('orgId');
        projectId = data.get('projectId');
        if (orgId && projectId) {
          url = `/entries?orgId=${orgId}&projectId=${projectId}`;
        }
      }
      
      const response = await api.post(url, data, isFormData ? {
        headers: { 'Content-Type': 'multipart/form-data' }
      } : {});
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create entry');
    }
  }
);

export const updateEntry = createAsyncThunk(
  'entries/updateEntry',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/entries/${id}`, data);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update entry');
    }
  }
);

export const deleteEntry = createAsyncThunk(
  'entries/deleteEntry',
  async ({ id, orgId, projectId }, { rejectWithValue }) => {
    try {
      await api.delete(`/entries/${id}?orgId=${orgId}&projectId=${projectId}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete entry');
    }
  }
);

export const toggleUpvote = createAsyncThunk(
  'entries/toggleUpvote',
  async ({ id, orgId, projectId }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/entries/${id}/upvote?orgId=${orgId}&projectId=${projectId}`);
      return { id, ...response.data.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle upvote');
    }
  }
);

export const toggleDownvote = createAsyncThunk(
  'entries/toggleDownvote',
  async ({ id, orgId, projectId }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/entries/${id}/downvote?orgId=${orgId}&projectId=${projectId}`);
      return { id, ...response.data.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle downvote');
    }
  }
);

const entrySlice = createSlice({
  name: 'entries',
  initialState: {
    entries: [],
    currentEntry: null,
    total: 0,
    page: 1,
    totalPages: 0,
    hasMore: true,
    filters: { type: 'all', query: '', tag: '' },
    loading: false,
    cacheInvalidated: false,
    error: null,
  },
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.page = 1;
      state.cacheInvalidated = true; // Reset on filter change
    },
    setPage: (state, action) => {
      state.page = action.payload;
    },
    resetCache: (state) => {
      // Reset entries and pagination on any mutation
      state.entries = [];
      state.page = 1;
      state.totalPages = 0;
      state.hasMore = true;
      state.cacheInvalidated = true;
    },
    clearCurrentEntry: (state) => {
      state.currentEntry = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEntries.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchEntries.fulfilled, (state, action) => {
        state.loading = false;
        const pageNum = action.payload.pagination?.page || 1;
        const totalPages = action.payload.pagination?.pages || 0;

        // If first page or invalid page, reset; else append for infinite scroll
        if (pageNum === 1 || state.cacheInvalidated) {
          state.entries = action.payload.entries || [];
          state.cacheInvalidated = false;
        } else {
          state.entries.push(...(action.payload.entries || []));
        }

        state.total = action.payload.pagination?.total || 0;
        state.totalPages = totalPages;
        state.page = pageNum;
        state.hasMore = pageNum < totalPages;
        state.error = null;
      })
      .addCase(fetchEntries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchEntry.fulfilled, (state, action) => {
        state.currentEntry = action.payload;
      })
      .addCase(createEntry.fulfilled, (state, action) => {
        // Reset cache on create - next fetch will get fresh data
        state.entries = [];
        state.page = 1;
        state.totalPages = 0;
        state.hasMore = true;
        state.cacheInvalidated = true;
      })
      .addCase(updateEntry.fulfilled, (state, action) => {
        const index = state.entries.findIndex((e) => e._id === action.payload._id);
        if (index !== -1) {
          state.entries[index] = action.payload;
        }
        state.currentEntry = action.payload;
      })
      .addCase(deleteEntry.fulfilled, (state, action) => {
        state.entries = state.entries.filter((e) => e._id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      })
      .addCase(toggleUpvote.fulfilled, (state, action) => {
        const { id, upvoted, upvotes, downvotes } = action.payload;
        const update = (e) => {
          if (!e) return;
          e.upvoteCount = upvotes;
          e.downvoteCount = downvotes;
          e.userUpvoted = upvoted;
          e.userDownvoted = false;
        };
        update(state.entries.find(e => e._id === id));
        if (state.currentEntry?._id === id) update(state.currentEntry);
      })
      .addCase(toggleDownvote.fulfilled, (state, action) => {
        const { id, downvoted, upvotes, downvotes } = action.payload;
        const update = (e) => {
          if (!e) return;
          e.upvoteCount = upvotes;
          e.downvoteCount = downvotes;
          e.userDownvoted = downvoted;
          e.userUpvoted = false;
        };
        update(state.entries.find(e => e._id === id));
        if (state.currentEntry?._id === id) update(state.currentEntry);
      });
  },
});

export const { setFilters, setPage, resetCache, clearCurrentEntry, clearError } = entrySlice.actions;
export default entrySlice.reducer;
