'use client';

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '@/services/api';

const getStoredOrgId = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem('activeOrgId');
};

const persistOrgId = (orgId) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (orgId) {
    window.localStorage.setItem('activeOrgId', orgId);
    return;
  }

  window.localStorage.removeItem('activeOrgId');
};

const clearStoredProjectId = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('activeProjectId');
  }
};

export const fetchMyOrgs = createAsyncThunk(
  'orgs/fetchMyOrgs',
  async (_, { getState, rejectWithValue }) => {
    try {
      const response = await api.get('/org/my-orgs');
      return {
        orgs: response.data.data,
        preferredOrgId: getState().auth.user?.activeOrg || getStoredOrgId(),
      };
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

export const updateMemberRole = createAsyncThunk(
  'orgs/updateMemberRole',
  async ({ orgId, targetUserId, newRole }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/org/${orgId}/members/role`, { memberId: targetUserId, newRole });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update role');
    }
  }
);

export const removeMember = createAsyncThunk(
  'orgs/removeMember',
  async ({ orgId, targetUserId }, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/org/${orgId}/members`, { data: { memberId: targetUserId } });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to remove member');
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
        state.orgs = action.payload.orgs || [];
        state.activeOrg = action.payload.orgs.find((org) => org._id === action.payload.preferredOrgId)?._id || action.payload.orgs[0]?._id || null;
        persistOrgId(state.activeOrg);
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
        const org = action.payload.data;
        state.orgs.push(org);
        state.activeOrg = org._id;
        persistOrgId(org._id);
        clearStoredProjectId();
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
        const org = action.payload.data;
        state.orgs.push(org);
        state.activeOrg = org._id;
        persistOrgId(org._id);
        clearStoredProjectId();
      })
      .addCase(joinOrg.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(switchOrg.fulfilled, (state, action) => {
        state.activeOrg = action.meta.arg;
        persistOrgId(action.meta.arg);
        clearStoredProjectId();
        state.orgDetails = null;
      })
      .addCase(fetchOrgDetails.fulfilled, (state, action) => {
        state.orgDetails = action.payload;
      })
      .addCase(updateMemberRole.fulfilled, (state, action) => {
        state.orgDetails = action.payload;
      })
      .addCase(removeMember.fulfilled, (state, action) => {
        state.orgDetails = action.payload;
      });
  },
});

export const { clearError } = orgSlice.actions;
export default orgSlice.reducer;
