import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { traceId } from './middleware/traceId.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import proxyRoutes from './routes/proxyRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      const allowed = [process.env.FRONTEND_URL, 'http://localhost:3000'].filter(Boolean);
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },

    credentials: true,
  })
);


app.use((req, res, next) => {
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    // Skip body parsing for multipart/form-data (file uploads)
    return next();
  }
  express.json()(req, res, next);
});
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
app.use(traceId);
app.use(rateLimiter);

// Routes
app.use('/api', proxyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'gateway',
    timestamp: new Date().toISOString(),
    traceId: req.traceId,
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
  console.error(`[GATEWAY] Error: ${err.message} trace=${req.traceId || 'unknown'}`);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`[GATEWAY] ✓ API Gateway running on http://localhost:${PORT}`);
  console.log(`[GATEWAY] ✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});
