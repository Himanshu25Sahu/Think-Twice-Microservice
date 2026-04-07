import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

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

// Request logging middleware
app.use((req, res, next) => {
  const traceId = req.headers['x-trace-id'] || 'no-trace';
  const method = req.method;
  const path = req.path;
  const bodySnippet = method !== 'GET' ? JSON.stringify(req.body).substring(0, 100) : '';
  console.log(`📨 [AUTH] Incoming ${method} ${path} trace=${traceId} ${bodySnippet ? '| body=' + bodySnippet : ''}`);
  next();
});

// Routes
app.use('/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  const traceId = req.headers['x-trace-id'] || 'unknown';
  res.json({
    success: true,
    status: 'ok',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    traceId,
  });
});

app.get('/api/health', (req, res) => {
  const traceId = req.headers['x-trace-id'] || 'unknown';
  res.json({
    success: true,
    status: 'ok',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    traceId,
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
  console.error(`[AUTH] Error: ${err.message} trace=${traceId}`);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

export default app;
