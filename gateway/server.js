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

// Keepalive endpoint - pings all services to keep them alive
// Usage: GET /api/keepalive or POST /api/keepalive (from external cron job)
app.get('/api/keepalive', (req, res) => {
  handleKeepalive(req, res);
});

app.post('/api/keepalive', (req, res) => {
  handleKeepalive(req, res);
});

const handleKeepalive = async (req, res) => {
  const services = [
    { name: 'auth-service', url: `${process.env.AUTH_SERVICE_URL || 'http://localhost:5001'}/health` },
    { name: 'entry-service', url: `${process.env.ENTRY_SERVICE_URL || 'http://localhost:5002'}/health` },
    { name: 'org-service', url: `${process.env.ORG_SERVICE_URL || 'http://localhost:5003'}/health` },
    { name: 'analytics-service', url: `${process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5004'}/health` },
  ];

  console.log(`[GATEWAY] 🔴 KEEPALIVE PING at ${new Date().toISOString()}`);

  try {
    // Ping all services concurrently with a timeout
    const results = await Promise.all(
      services.map(async (service) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout per service

          const response = await fetch(service.url, {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'x-trace-id': req.traceId,
            },
          });

          clearTimeout(timeout);

          if (response.ok) {
            console.log(`[GATEWAY] ✅ ${service.name} - OK (${response.status})`);
            return {
              service: service.name,
              status: 'alive',
              statusCode: response.status,
              timestamp: new Date().toISOString(),
            };
          } else {
            console.log(`[GATEWAY] ⚠️ ${service.name} - Responded with ${response.status}`);
            return {
              service: service.name,
              status: 'warning',
              statusCode: response.status,
              timestamp: new Date().toISOString(),
            };
          }
        } catch (error) {
          console.error(`[GATEWAY] ❌ ${service.name} - Error: ${error.message}`);
          return {
            service: service.name,
            status: 'dead',
            error: error.message,
            timestamp: new Date().toISOString(),
          };
        }
      })
    );

    const allAlive = results.every((r) => r.status === 'alive');

    res.status(allAlive ? 200 : 207).json({
      success: allAlive,
      status: allAlive ? 'all services alive' : 'some services unreachable',
      gateway: {
        status: 'OK',
        timestamp: new Date().toISOString(),
      },
      services: results,
      traceId: req.traceId,
    });
  } catch (error) {
    console.error(`[GATEWAY] ❌ Keepalive handler error:`, error.message);
    res.status(500).json({
      success: false,
      status: 'error',
      message: error.message,
      gateway: {
        status: 'ERROR',
        timestamp: new Date().toISOString(),
      },
      traceId: req.traceId,
    });
  }
};

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
