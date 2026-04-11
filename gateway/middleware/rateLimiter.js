import { redisClient } from '../utils/redisClient.js';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = {
  login: 120,
  default: 500,
};
const RATE_LIMIT_BYPASS_PATHS = new Set(['/api/health', '/api/keepalive', '/health', '/keepalive']);

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) {
    return realIp;
  }

  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.length > 0) {
    return cfIp;
  }

  return req.ip || req.connection?.remoteAddress || 'unknown';
};

const getBucketType = (req) => {
  if (req.method === 'POST' && req.path === '/api/auth/login') {
    return 'login';
  }
  return 'default';
};

const shouldBypassRateLimit = (req) => {
  const normalizedPath = (req.path || '').replace(/\/$/, '');
  return (
    RATE_LIMIT_BYPASS_PATHS.has(normalizedPath) ||
    normalizedPath.endsWith('/health') ||
    normalizedPath.endsWith('/keepalive')
  );
};

// In-memory fallback (existing logic)
const ipMap = new Map();

const inMemoryRateLimit = (req, res, next) => {
  if (shouldBypassRateLimit(req)) {
    return next();
  }

  const ip = getClientIp(req);
  const bucketType = getBucketType(req);
  const maxRequests = MAX_REQUESTS[bucketType] || MAX_REQUESTS.default;
  const key = `${bucketType}:${ip}`;
  const now = Date.now();

  if (!ipMap.has(key)) {
    ipMap.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  const record = ipMap.get(key);
  if (now > record.resetTime) {
    ipMap.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  record.count++;
  if (record.count > maxRequests) {
    return res.status(429).json({ success: false, message: 'Too many requests' });
  }

  next();
};

const redisRateLimit = async (req, res, next) => {
  if (shouldBypassRateLimit(req)) {
    return next();
  }

  const ip = getClientIp(req);
  const bucketType = getBucketType(req);
  const maxRequests = MAX_REQUESTS[bucketType] || MAX_REQUESTS.default;
  const key = `ratelimit:${bucketType}:${ip}`;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  try {
    // Redis pipeline: remove old entries, add new, count, set expiry
    const multi = redisClient.multi();
    multi.zRemRangeByScore(key, 0, windowStart);  // Remove entries outside window
    multi.zAdd(key, { score: now, value: `${now}:${Math.random()}` }); // Add current request
    multi.zCard(key);  // Count requests in window
    multi.expire(key, Math.ceil(WINDOW_MS / 1000)); // Safety expiry

    const results = await multi.exec();
    const requestCount = results[2]; // zCard result

    // Set headers for client visibility
    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - requestCount).toString());

    if (requestCount > maxRequests) {
      console.log(`[GATEWAY] Rate limit exceeded for ${ip} (${bucketType}): ${requestCount}/${maxRequests}`);
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
      });
    }

    next();
  } catch (err) {
    console.error(`[GATEWAY] Redis rate limiter error: ${err.message}, falling back to in-memory`);
    inMemoryRateLimit(req, res, next);
  }
};

export const rateLimiter = (req, res, next) => {
  // Use Redis if available, otherwise in-memory
  if (redisClient && redisClient.isOpen) {
    redisRateLimit(req, res, next);
  } else {
    inMemoryRateLimit(req, res, next);
  }
};

export default rateLimiter;
