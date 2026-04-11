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

const KEEPALIVE_TIMEOUT_MS = Number(process.env.KEEPALIVE_TIMEOUT_MS || 8000);
const KEEPALIVE_INTERVAL_MS = Number(process.env.KEEPALIVE_INTERVAL_MS || 240000);
const KEEPALIVE_WAKE_RETRIES = Number(process.env.KEEPALIVE_WAKE_RETRIES || 1);
const KEEPALIVE_RETRY_DELAY_MS = Number(process.env.KEEPALIVE_RETRY_DELAY_MS || 20000);
const ENABLE_INTERNAL_KEEPALIVE = process.env.ENABLE_INTERNAL_KEEPALIVE === 'true';

// Respect x-forwarded-for/x-forwarded-proto when deployed behind a proxy (Vercel, Render, etc.)
app.set('trust proxy', true);

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

const toOrigin = (rawUrl, fallback) => {
  if (!rawUrl) {
    return fallback;
  }

  try {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return rawUrl.replace(/\/$/, '');
  }
};

const buildServiceTargets = () => {
  const defaults = {
    'auth-service': 'http://localhost:5001',
    'entry-service': 'http://localhost:5002',
    'org-service': 'http://localhost:5003',
    'analytics-service': 'http://localhost:5004',
  };

  const services = [
    { name: 'auth-service', env: process.env.AUTH_SERVICE_URL },
    { name: 'entry-service', env: process.env.ENTRY_SERVICE_URL },
    { name: 'org-service', env: process.env.ORG_SERVICE_URL },
    { name: 'analytics-service', env: process.env.ANALYTICS_SERVICE_URL },
  ];

  return services.map((service) => {
    const baseUrl = toOrigin(service.env, defaults[service.name]);
    return {
      name: service.name,
      baseUrl,
      candidates: [`${baseUrl}/health`, `${baseUrl}/api/health`],
    };
  });
};

// Statuses Render returns while a service is cold-starting (wake-up in progress)
const WAKING_STATUSES = new Set([502, 503]);

const trySinglePing = async (candidateUrl, traceId) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KEEPALIVE_TIMEOUT_MS);

  try {
    const response = await fetch(candidateUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'x-trace-id': traceId },
    });
    clearTimeout(timeout);
    return { ok: response.ok, status: response.status };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
};

const pingService = async (service, traceId) => {
  let lastResult = null;

  for (let attempt = 0; attempt <= KEEPALIVE_WAKE_RETRIES; attempt++) {
    if (attempt > 0) {
      // Service was waking up on previous attempt — give Render time to boot
      console.log(`[GATEWAY] ⏳ ${service.name} - waking up, retrying in ${KEEPALIVE_RETRY_DELAY_MS}ms (attempt ${attempt + 1})`);
      await new Promise((resolve) => setTimeout(resolve, KEEPALIVE_RETRY_DELAY_MS));
    }

    let waking = false;

    for (let index = 0; index < service.candidates.length; index++) {
      const candidateUrl = service.candidates[index];
      const isLastCandidate = index === service.candidates.length - 1;

      try {
        const { ok, status } = await trySinglePing(candidateUrl, traceId);

        if (ok) {
          console.log(`[GATEWAY] ✅ ${service.name} - OK (${status}) via ${candidateUrl} [attempt ${attempt + 1}]`);
          return {
            service: service.name,
            status: 'alive',
            statusCode: status,
            checkedUrl: candidateUrl,
            attempts: attempt + 1,
            timestamp: new Date().toISOString(),
          };
        }

        if (WAKING_STATUSES.has(status) && !isLastCandidate) {
          continue; // try /api/health before deciding to retry
        }

        if (WAKING_STATUSES.has(status) && attempt < KEEPALIVE_WAKE_RETRIES) {
          // Render is cold-starting — mark for retry, break inner loop
          waking = true;
          lastResult = { status, checkedUrl: candidateUrl };
          console.log(`[GATEWAY] ⏳ ${service.name} - ${status} (cold start detected) via ${candidateUrl}`);
          break;
        }

        if (!isLastCandidate) continue;

        lastResult = { status, checkedUrl: candidateUrl };
      } catch (error) {
        if (!isLastCandidate) continue;

        if (attempt < KEEPALIVE_WAKE_RETRIES) {
          waking = true;
          lastResult = { error: error.message, checkedUrl: candidateUrl };
          console.log(`[GATEWAY] ⏳ ${service.name} - timeout/error (${error.message}), will retry`);
          break;
        }

        console.error(`[GATEWAY] ❌ ${service.name} - Error via ${candidateUrl}: ${error.message}`);
        return {
          service: service.name,
          status: 'dead',
          error: error.message,
          checkedUrl: candidateUrl,
          attempts: attempt + 1,
          timestamp: new Date().toISOString(),
        };
      }
    }

    if (!waking) break; // no retry needed
  }

  if (lastResult) {
    const { status, error, checkedUrl } = lastResult;
    if (status !== undefined) {
      console.log(`[GATEWAY] ⚠️ ${service.name} - final status ${status} via ${checkedUrl}`);
      return {
        service: service.name,
        status: 'warning',
        statusCode: status,
        checkedUrl,
        attempts: KEEPALIVE_WAKE_RETRIES + 1,
        timestamp: new Date().toISOString(),
      };
    }
    return {
      service: service.name,
      status: 'dead',
      error,
      checkedUrl,
      attempts: KEEPALIVE_WAKE_RETRIES + 1,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    service: service.name,
    status: 'dead',
    error: 'No healthy endpoint matched after retries',
    checkedUrl: service.candidates.join(', '),
    attempts: KEEPALIVE_WAKE_RETRIES + 1,
    timestamp: new Date().toISOString(),
  };
};

const performKeepalive = async (traceId) => {
  const services = buildServiceTargets();
  console.log(`[GATEWAY] 🔴 KEEPALIVE PING at ${new Date().toISOString()}`);
  return Promise.all(services.map((service) => pingService(service, traceId)));
};

const handleKeepalive = async (req, res) => {
  const traceId = req.traceId || `keepalive-${Date.now()}`;

  try {
    const results = await performKeepalive(traceId);
    const allAlive = results.every((r) => r.status === 'alive');

    res.status(allAlive ? 200 : 207).json({
      success: allAlive,
      status: allAlive ? 'all services alive' : 'some services unreachable',
      gateway: {
        status: 'OK',
        timestamp: new Date().toISOString(),
      },
      services: results,
      traceId,
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
      traceId,
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

  if (ENABLE_INTERNAL_KEEPALIVE) {
    console.log(`[GATEWAY] ✓ Internal keepalive enabled every ${KEEPALIVE_INTERVAL_MS}ms`);
    setInterval(async () => {
      try {
        await performKeepalive(`internal-keepalive-${Date.now()}`);
      } catch (error) {
        console.error(`[GATEWAY] ❌ Internal keepalive error: ${error.message}`);
      }
    }, KEEPALIVE_INTERVAL_MS);
  }
});
