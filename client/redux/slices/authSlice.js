// src/redux/slices/authSlice.js
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '@/services/api';

// Thunks
export const register = createAsyncThunk(
  'auth/register',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/register', credentials);
      return { success: true, user: response.data.data.user };
    } catch (err) {
      return rejectWithValue({ success: false, message: err.response?.data?.message || 'Registration failed' });
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', credentials);
      return { success: true, user: response.data.data.user };
    } catch (err) {
      return rejectWithValue({ success: false, message: err.response?.data?.message || 'Login failed' });
    }
  }
);

export const checkAuth = createAsyncThunk(
  'auth/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/auth/me');
      return { success: true, user: response.data };
    } catch (err) {
      return rejectWithValue({ success: false, message: 'Not authenticated' });
    }
  }
);

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Register
    builder.addCase(register.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(register.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload.user;
      state.isAuthenticated = true;
    });
    builder.addCase(register.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload.message;
      state.isAuthenticated = false;
    });

    // Login
    builder.addCase(login.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload.user;
      state.isAuthenticated = true;
    });
    builder.addCase(login.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload.message;
      state.isAuthenticated = false;
    });

    // Check Auth
    builder.addCase(checkAuth.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.isAuthenticated = true;
    });
    builder.addCase(checkAuth.rejected, (state) => {
      state.isAuthenticated = false;
    });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;