import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice.js';
import entrySlice from './slices/entrySlice.js';
import orgSlice from './slices/orgSlice.js';
import projectSlice from './slices/projectSlice.js';

const store = configureStore({
  reducer: {
    auth: authSlice,
    entries: entrySlice,
    orgs: orgSlice,
    projects: projectSlice,
  },
});

export default store;