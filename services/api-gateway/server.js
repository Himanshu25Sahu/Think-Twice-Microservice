import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ============ MIDDLEWARE ============

app.use(express.json());
app.use(cookieParser());

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://think-twice-six.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['Set-Cookie']
}));

// ============ TRACE ID INJECTION ============
// Every request gets a unique ID that follows it through all services
app.use((req, res, next) => {
  req.traceId = req.headers['x-trace-id'] || uuidv4();
  res.setHeader('x-trace-id', req.traceId);
  console.log(`[GATEWAY] ${req.method} ${req.url} traceId=${req.traceId}`);
  next();
});

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    service: 'api-gateway', 
    timestamp: new Date(),
    traceId: req.traceId 
  });
});

// ============ ROUTING TO SERVICES ============
const DECISION_SERVICE_URL = process.env.DECISION_SERVICE_URL || 'http://localhost:5001';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5002';

console.log(`[GATEWAY] Configured routes:`);
console.log(`   Decision Service: ${DECISION_SERVICE_URL}`);
console.log(`   Analytics Service: ${ANALYTICS_SERVICE_URL}`);

// ============ AUTH MIDDLEWARE (Only Here) ============
const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    // Allow public endpoints
    if (req.method === 'GET' && (req.path.includes('public') || req.path === '/health')) {
      return next();
    }

    if (!token) {
      console.log(`[GATEWAY] ❌ No token found in cookies for: ${req.path}`);
      return res.status(401).json({ success: false, message: "Not authenticated, please login" });
    }

    // Debug: Log token info (safely, without exposing full token)
    console.log(`[GATEWAY] 🔐 Verifying token | JWT_SECRET loaded: ${process.env.JWT_SECRET ? '✅' : '❌'} | Token length: ${token.length}`);
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { _id: decoded.id };
    
    console.log(`[GATEWAY] ✅ Authentication successful for user: ${decoded.id}`);
    next();
  } catch (error) {
    console.error(`[GATEWAY] ❌ Auth error on ${req.path}:`, error.message);
    console.error(`[GATEWAY]    Error type: ${error.name}`);
    if (error.name === 'JsonWebTokenError') {
      console.error(`[GATEWAY]    This usually means JWT_SECRET mismatch or invalid token`);
    }
    return res.status(401).json({ success: false, message: error.message });
  }
};

// Proxy middleware to attach traceId
const attachTraceId = (req, res, next) => {
  req.headers['x-trace-id'] = req.traceId;
  next();
};

// Auth routes (no auth required)
app.use('/auth', attachTraceId, createProxyMiddleware({
  target: DECISION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/auth': '/auth' },
  onProxyReq: (proxyReq, req, res) => {
    // Forward body for POST requests
    if (req.method === 'POST' && req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
}));

// Decision routes (with auth check)
app.use('/decisions', isAuthenticated, attachTraceId, createProxyMiddleware({
  target: DECISION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/decisions': '/decisions' },
  onProxyReq: (proxyReq, req, res) => {
    // Forward body for POST requests
    if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
}));

// User routes (with auth check)
app.use('/user', isAuthenticated, attachTraceId, createProxyMiddleware({
  target: DECISION_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/user': '/user' },
  onProxyReq: (proxyReq, req, res) => {
    // Forward body for POST requests
    if ((req.method === 'POST' || req.method === 'PUT') && req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
}));

// Analytics routes (with auth check)
app.use('/analytics', isAuthenticated, attachTraceId, createProxyMiddleware({
  target: ANALYTICS_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/analytics': '/analytics' },
  onProxyReq: (proxyReq, req, res) => {
    // Forward body for POST requests
    if (req.method === 'POST' && req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
}));

// ============ ERROR HANDLING ============
app.use((err, req, res, next) => {
  console.error(`[GATEWAY] ❌ Error traceId=${req.traceId}:`, err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message,
    traceId: req.traceId
  });
});

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔴 API Gateway running on port ${PORT}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📋 Configuration:`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '✅ LOADED (' + process.env.JWT_SECRET.substring(0, 10) + '...)' : '❌ UNDEFINED - AUTH WILL FAIL'}`);
  console.log(`   Decision Service: ${DECISION_SERVICE_URL}`);
  console.log(`   Analytics Service: ${ANALYTICS_SERVICE_URL}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Gateway ready to route requests\n`);
});

