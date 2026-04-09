import { getCache, setCache } from '../utils/redisClient.js';

export const idempotency = async (req, res, next) => {
  const key = req.headers['x-idempotency-key'];
  if (!key) return next();

  try {
    const cached = await getCache(`idempotency:${key}`);
    if (cached) {
      console.log(`[ENTRY] Idempotency cache hit: ${key}`);
      return res.status(cached.statusCode).json(cached.body);
    }
  } catch (e) {
    // Redis down — skip idempotency
    return next();
  }

  // Override res.json to capture response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Store in Redis (fire and forget)
    setCache(`idempotency:${key}`, { statusCode: res.statusCode, body }, 86400)
      .catch(() => {});
    return originalJson(body);
  };

  next();
};

export default idempotency;
