'use client';

import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '@/services/api';

const getStoredProjectId = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem('activeProjectId');
};

const persistProjectId = (projectId) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (projectId) {
    window.localStorage.setItem('activeProjectId', projectId);
    return;
  }

  window.localStorage.removeItem('activeProjectId');
};

export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async (orgId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/org/${orgId}/projects`);
      return {
        orgId,
        projects: response.data.data,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch projects');
    }
  }
);

export const switchProject = createAsyncThunk(
  'projects/switchProject',
  async (projectId, { rejectWithValue }) => {
    try {
      const response = await api.put(`/org/switch-project/${projectId}`);
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to switch project');
    }
  }
);

export const initializeProjects = createAsyncThunk(
  'projects/initializeProjects',
  async (orgId, { dispatch, getState, rejectWithValue }) => {
    try {
      const projectPayload = await dispatch(fetchProjects(orgId)).unwrap();
      const authActiveProject = getState().auth.user?.activeProject;
      const storedProjectId = getStoredProjectId();
      const projects = projectPayload.projects || [];
      const preferredProjectId = [storedProjectId, authActiveProject].find((candidate) =>
        projects.some((project) => project._id === candidate)
      );
      const nextProjectId = preferredProjectId || projects[0]?._id || null;

      if (nextProjectId) {
        await dispatch(switchProject(nextProjectId)).unwrap();
      } else {
        persistProjectId(null);
      }

      return {
        orgId,
        projects,
        activeProject: nextProjectId,
      };
    } catch (error) {
      return rejectWithValue(error?.message || error || 'Failed to initialize projects');
    }
  }
);

export const createProject = createAsyncThunk(
  'projects/createProject',
  async ({ orgId, name, description }, { rejectWithValue }) => {
    try {
      const response = await api.post(`/org/${orgId}/projects`, { name, description });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create project');
    }
  }
);

const projectSlice = createSlice({
  name: 'projects',
  initialState: {
    projects: [],
    activeProject: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearProjects: (state) => {
      state.projects = [];
      state.activeProject = null;
      state.error = null;
      persistProjectId(null);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload.projects || [];
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(initializeProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload.projects || [];
        state.activeProject = action.payload.activeProject;
        persistProjectId(action.payload.activeProject);
      })
      .addCase(initializeProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(switchProject.fulfilled, (state, action) => {
        state.activeProject = action.payload._id;
        persistProjectId(action.payload._id);
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.projects.push(action.payload);
      });
  },
});

export const { clearProjects } = projectSlice.actions;
export default projectSlice.reducer;