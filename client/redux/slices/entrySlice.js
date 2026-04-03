'use client';

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';

export const fetchEntries = createAsyncThunk(
  'entries/fetchEntries',
  async ({ orgId, type, query, tag, page = 1, limit = 12, sort = 'newest' }, { rejectWithValue }) => {
    try {
      // Extract ID if orgId is an object, otherwise use as-is
      const orgIdString = typeof orgId === 'object' ? orgId._id : orgId;
      let url = `/entries?orgId=${orgIdString}&page=${page}&limit=${limit}&sort=${sort}`;
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
  async ({ id, orgId }, { rejectWithValue }) => {
    try {
      // Extract ID if orgId is an object, otherwise use as-is
      const orgIdString = typeof orgId === 'object' ? orgId._id : orgId;
      const response = await api.get(`/entries/${id}?orgId=${orgIdString}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch entry');
    }
  }
);

export const createEntry = createAsyncThunk(
  'entries/createEntry',
  async ({ data, orgId }, { rejectWithValue }) => {
    try {
      const isFormData = data instanceof FormData;
      const response = await api.post(`/entries?orgId=${orgId}`, data, isFormData ? {
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
  async ({ id, orgId }, { rejectWithValue }) => {
    try {
      await api.delete(`/entries/${id}?orgId=${orgId}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete entry');
    }
  }
);

export const toggleUpvote = createAsyncThunk(
  'entries/toggleUpvote',
  async ({ id, orgId }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/entries/${id}/upvote?orgId=${orgId}`);
      return { id, ...response.data.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle upvote');
    }
  }
);

export const toggleDownvote = createAsyncThunk(
  'entries/toggleDownvote',
  async ({ id, orgId }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/entries/${id}/downvote?orgId=${orgId}`);
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
    filters: { type: 'all', query: '', tag: '' },
    loading: false,
    error: null,
  },
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.page = 1;
    },
    setPage: (state, action) => {
      state.page = action.payload;
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
        state.entries = action.payload.entries || [];
        state.total = action.payload.pagination?.total || 0;
        state.totalPages = action.payload.pagination?.pages || 0;
        state.page = action.payload.pagination?.page || 1;
      })
      .addCase(fetchEntries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchEntry.fulfilled, (state, action) => {
        state.currentEntry = action.payload;
      })
      .addCase(createEntry.fulfilled, (state, action) => {
        state.entries.unshift(action.payload);
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

export const { setFilters, setPage, clearCurrentEntry, clearError } = entrySlice.actions;
export default entrySlice.reducer;
