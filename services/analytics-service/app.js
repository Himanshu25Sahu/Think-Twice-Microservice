import express from 'express';
import analyticsRoutes from './routes/analyticsRoutes.js';

const app = express();

// Middleware
app.use(express.json());

// Health check endpoint (for K8s/Docker probes)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'analytics-service' });
});

// Analytics routes
app.use('/analytics', analyticsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const traceId = req.headers['x-trace-id'] || 'unknown';
  console.error(`[ANALYTICS] Unhandled error: ${err.message} trace=${traceId}`);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

export default app;
