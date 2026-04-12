import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyAuth, optionalAuth } from '../middleware/authProxy.js';

const router = express.Router();

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
const ORG_SERVICE_URL = process.env.ORG_SERVICE_URL || 'http://localhost:5003';
const ENTRY_SERVICE_URL = process.env.ENTRY_SERVICE_URL || 'http://localhost:5002';
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5004';

const TRACE_CONTEXT_HEADERS = ['traceparent', 'tracestate', 'baggage'];

const forwardTraceHeaders = (proxyReq, req) => {
  proxyReq.setHeader('x-trace-id', req.traceId);

  TRACE_CONTEXT_HEADERS.forEach((headerName) => {
    const headerValue = req.headers[headerName];
    if (headerValue) {
      proxyReq.setHeader(headerName, headerValue);
    }
  });
};

// Auth routes — no authentication required
router.use(
  '/auth',
  createProxyMiddleware({
    target: AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/auth': '/auth',  // Convert /api/auth/login to /auth/login
    },
    onProxyReq: (proxyReq, req, res) => {
      forwardTraceHeaders(proxyReq, req);
      
      // Forward body if present
      if (req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    onError: (err, req, res) => {
      console.error(`[GATEWAY] Auth service error: ${err.message} trace=${req.traceId}`);
      res.status(503).json({
        success: false,
        message: 'Auth service unavailable',
      });
    },
  })
);

// Organization routes — requires authentication
router.use(
  '/org',
  verifyAuth,
  createProxyMiddleware({
    target: ORG_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/org': '/org',  // Convert /api/org/... to /org/...
    },
    onProxyReq: (proxyReq, req, res) => {
      forwardTraceHeaders(proxyReq, req);
      proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
      proxyReq.setHeader('x-user-email', req.headers['x-user-email']);
      proxyReq.setHeader('x-user-name', req.headers['x-user-name'] || '');
      proxyReq.setHeader('x-org-id', req.headers['x-org-id'] || '');
      proxyReq.setHeader('x-project-id', req.headers['x-project-id'] || '');
      
      if (req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    onError: (err, req, res) => {
      console.error(`[GATEWAY] Org service error: ${err.message} trace=${req.traceId}`);
      res.status(503).json({
        success: false,
        message: 'Organization service unavailable',
      });
    },
  })
);

// Entries routes — requires authentication
router.use(
  '/entries',
  verifyAuth,
  createProxyMiddleware({
    target: ENTRY_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/entries': '/entries',  // Convert /api/entries/... to /entries/...
    },
    onProxyReq: (proxyReq, req, res) => {
      forwardTraceHeaders(proxyReq, req);
      proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
      proxyReq.setHeader('x-user-email', req.headers['x-user-email']);
      proxyReq.setHeader('x-user-name', req.headers['x-user-name'] || '');
      proxyReq.setHeader('x-org-id', req.headers['x-org-id'] || '');
      proxyReq.setHeader('x-project-id', req.headers['x-project-id'] || '');

      // Don't rewrite body for multipart uploads
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        return;
      }
      
      if (req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    onError: (err, req, res) => {
      console.error(`[GATEWAY] Entry service error: ${err.message} trace=${req.traceId}`);
      res.status(503).json({
        success: false,
        message: 'Entry service unavailable',
      });
    },
  })
);

// Analytics routes — requires authentication
router.use(
  '/analytics',
  verifyAuth,
  createProxyMiddleware({
    target: ANALYTICS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      '^/api/analytics': '/analytics',  // Convert /api/analytics/... to /analytics/...
    },
    onProxyReq: (proxyReq, req, res) => {
      forwardTraceHeaders(proxyReq, req);
      proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
      proxyReq.setHeader('x-user-email', req.headers['x-user-email']);
      proxyReq.setHeader('x-user-name', req.headers['x-user-name'] || '');
      proxyReq.setHeader('x-org-id', req.headers['x-org-id'] || '');
      proxyReq.setHeader('x-project-id', req.headers['x-project-id'] || '');
      
      if (req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    onError: (err, req, res) => {
      console.error(`[GATEWAY] Analytics service error: ${err.message} trace=${req.traceId}`);
      res.status(503).json({
        success: false,
        message: 'Analytics service unavailable',
      });
    },
  })
);

export default router;
