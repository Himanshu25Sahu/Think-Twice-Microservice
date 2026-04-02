import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

redisClient.on('error', (err) => console.error('[ORG] Redis error:', err));
redisClient.on('connect', () => console.log('[ORG] ✓ Redis connected'));

await redisClient.connect().catch((err) => {
  console.warn('[ORG] ⚠ Redis connection warning (optional):', err.message);
});

export { redisClient };
