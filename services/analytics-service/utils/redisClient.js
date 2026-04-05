import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

redisClient.on('error', (err) => console.error('[ANALYTICS] Redis error:', err));
redisClient.on('connect', () => console.log('[ANALYTICS] ✓ Redis connected'));

await redisClient.connect().catch((err) => {
  console.warn('[ANALYTICS] ⚠ Redis connection warning (optional):', err.message);
});

export { redisClient };
