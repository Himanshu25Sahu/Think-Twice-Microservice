import { redisClient } from '../utils/redisClient.js';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 500; // per window per IP

// In-memory fallback (existing logic)
const ipMap = new Map();

const inMemoryRateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  if (!ipMap.has(ip)) {
    ipMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  const record = ipMap.get(ip);
  if (now > record.resetTime) {
    ipMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  record.count++;
  if (record.count > MAX_REQUESTS) {
    return res.status(429).json({ success: false, message: 'Too many requests' });
  }

  next();
};

const redisRateLimit = async (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const key = `ratelimit:${ip}`;
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
    res.set('X-RateLimit-Limit', MAX_REQUESTS.toString());
    res.set('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - requestCount).toString());

    if (requestCount > MAX_REQUESTS) {
      console.log(`[GATEWAY] Rate limit exceeded for ${ip}: ${requestCount}/${MAX_REQUESTS}`);
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
