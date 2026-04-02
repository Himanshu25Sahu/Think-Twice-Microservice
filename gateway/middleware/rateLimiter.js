const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100; // requests per window

const ipMap = new Map();

export const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();

  if (!ipMap.has(ip)) {
    ipMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  const record = ipMap.get(ip);

  // Reset if window has passed
  if (now > record.resetTime) {
    ipMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }

  // Increment count
  record.count++;

  if (record.count > RATE_LIMIT_MAX) {
    console.log(`[GATEWAY] Rate limit exceeded for IP ${ip} trace=${req.traceId}`);
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
    });
  }

  next();
};

export default rateLimiter;
