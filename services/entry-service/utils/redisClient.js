import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

redisClient.on('error', (err) => console.error('[ENTRY] Redis error:', err));
redisClient.on('connect', () => console.log('[ENTRY] ✓ Redis connected'));

await redisClient.connect().catch((err) => {
  console.warn('[ENTRY] ⚠ Redis connection warning (optional):', err.message);
});

export { redisClient };

export const getCache = async (key) => {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('[ENTRY] Cache get error:', error);
    return null;
  }
};

export const setCache = async (key, value, ttl = 300) => {
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('[ENTRY] Cache set error:', error);
  }
};

export const invalidateCache = async (pattern) => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`[ENTRY] Invalidated ${keys.length} cache keys`);
    }
  } catch (error) {
    console.error('[ENTRY] Cache invalidation error:', error);
  }
};
