import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

let redisClient = null;

try {
  if (process.env.REDIS_URL) {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
      },
    });

    redisClient.on('error', (err) => console.error('[GATEWAY] Redis error:', err.message));
    redisClient.on('connect', () => console.log('[GATEWAY] ✓ Redis connected'));

    await redisClient.connect();
  }
} catch (err) {
  console.warn('[GATEWAY] ⚠ Redis not available, using in-memory rate limiter');
  redisClient = null;
}

export { redisClient };
