'use client';

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { addRelation, removeRelation, fetchGraph } from '@/services/graphService';

export const fetchGraphData = createAsyncThunk(
  'graph/fetchGraphData',
  async ({ orgId, projectId }, { rejectWithValue }) => {
    try {
      const data = await fetchGraph(orgId, projectId);
      return data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch graph');
    }
  }
);

export const createRelation = createAsyncThunk(
  'graph/createRelation',
  async ({ entryId, targetEntryId, relationType, orgId, projectId }, { rejectWithValue }) => {
    try {
      const response = await addRelation(entryId, targetEntryId, relationType, orgId, projectId);
      return { entryId, targetEntryId, relationType };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create relation');
    }
  }
);

export const deleteRelation = createAsyncThunk(
  'graph/deleteRelation',
  async ({ entryId, targetEntryId, orgId, projectId }, { rejectWithValue }) => {
    try {
      await removeRelation(entryId, targetEntryId, orgId, projectId);
      return { entryId, targetEntryId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete relation');
    }
  }
);

const graphSlice = createSlice({
  name: 'graph',
  initialState: {
    nodes: [],
    edges: [],
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
      .addCase(fetchGraphData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGraphData.fulfilled, (state, action) => {
        state.loading = false;
        state.nodes = action.payload.nodes || [];
        state.edges = action.payload.edges || [];
      })
      .addCase(fetchGraphData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createRelation.fulfilled, (state, action) => {
        const { entryId, targetEntryId, relationType } = action.payload;
        const edgeId = `${entryId}-${targetEntryId}-${relationType}`;
        const edgeExists = state.edges.some((e) => e.id === edgeId);
        if (!edgeExists) {
          state.edges.push({
            id: edgeId,
            source: entryId,
            target: targetEntryId,
            data: { type: relationType },
            label: relationType.replace('_', ' '),
          });
        }
      })
      .addCase(deleteRelation.fulfilled, (state, action) => {
        const { entryId, targetEntryId } = action.payload;
        state.edges = state.edges.filter(
          (e) => !(e.source === entryId && e.target === targetEntryId)
        );
      });
  },
});

export const { clearError } = graphSlice.actions;
export default graphSlice.reducer;
