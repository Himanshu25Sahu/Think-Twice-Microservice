'use client';

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';

export const fetchMyOrgs = createAsyncThunk(
  'orgs/fetchMyOrgs',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/org/my-orgs');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch organizations');
    }
  }
);

export const createOrg = createAsyncThunk(
  'orgs/createOrg',
  async ({ name, slug }, { rejectWithValue }) => {
    try {
      const response = await api.post('/org/create', { name, slug });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create organization');
    }
  }
);

export const joinOrg = createAsyncThunk(
  'orgs/joinOrg',
  async ({ inviteCode }, { rejectWithValue }) => {
    try {
      const response = await api.post('/org/join', { inviteCode });
      return {
        success: true,
        data: response.data.data
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to join organization');
    }
  }
);

export const switchOrg = createAsyncThunk(
  'orgs/switchOrg',
  async (orgId, { rejectWithValue }) => {
    try {
      const response = await api.put(`/org/switch/${orgId}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to switch organization');
    }
  }
);

export const fetchOrgDetails = createAsyncThunk(
  'orgs/fetchOrgDetails',
  async (orgId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/org/${orgId}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch organization details');
    }
  }
);

const orgSlice = createSlice({
  name: 'orgs',
  initialState: {
    orgs: [],
    activeOrg: null,
    orgDetails: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyOrgs.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchMyOrgs.fulfilled, (state, action) => {
        state.loading = false;
        state.orgs = action.payload;
        state.activeOrg = action.payload.find((org) => org.isActive) || action.payload[0] || null;
      })
      .addCase(fetchMyOrgs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createOrg.pending, (state) => {
        state.loading = true;
      })
      .addCase(createOrg.fulfilled, (state, action) => {
        state.loading = false;
        state.orgs.push(action.payload.data);
        state.activeOrg = action.payload.data;
      })
      .addCase(createOrg.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(joinOrg.pending, (state) => {
        state.loading = true;
      })
      .addCase(joinOrg.fulfilled, (state, action) => {
        state.loading = false;
        state.orgs.push(action.payload);
        state.activeOrg = action.payload;
      })
      .addCase(joinOrg.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(switchOrg.fulfilled, (state, action) => {
        state.activeOrg = action.payload;
      })
      .addCase(fetchOrgDetails.fulfilled, (state, action) => {
        state.orgDetails = action.payload;
      });
  },
});

export const { clearError } = orgSlice.actions;
export default orgSlice.reducer;
