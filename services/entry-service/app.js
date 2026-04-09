import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import entryRoutes from './routes/entryRoutes.js';
import { initCacheInvalidation } from './utils/cacheInvalidator.js';
import { orgServiceBreaker } from './utils/circuitBreaker.js';

dotenv.config();

// Initialize cache invalidation listeners
initCacheInvalidation().catch((err) => {
  console.warn('[ENTRY] ⚠ Cache invalidation init failed (non-fatal):', err.message);
});

const app = express();

// Middleware
app.use(
  cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:3000', 'http://localhost:3000'],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// Routes
app.use('/entries', entryRoutes);

// Health check
app.get('/health', (req, res) => {
  const traceId = req.headers['x-trace-id'] || 'unknown';
  res.json({
    success: true,
    status: 'ok',
    service: 'entry-service',
    timestamp: new Date().toISOString(),
    traceId,
    circuitBreaker: orgServiceBreaker.getState(),
  });
});

app.get('/api/health', (req, res) => {
  const traceId = req.headers['x-trace-id'] || 'unknown';
  res.json({
    success: true,
    status: 'ok',
    service: 'entry-service',
    timestamp: new Date().toISOString(),
    traceId,
    circuitBreaker: orgServiceBreaker.getState(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const traceId = req.headers['x-trace-id'] || 'unknown';
  console.error(`[ENTRY] Error: ${err.message} trace=${traceId}`);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

export default app;
