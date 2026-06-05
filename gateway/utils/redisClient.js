import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

let redisClient = null;

if (process.env.REDIS_URL) {
  redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: (retries) => {
        if (retries > 10) return false;
        return Math.min(retries * 100, 3000);
      },
    },
  });

  redisClient.on('error', (err) =>
    console.error('[GATEWAY] Redis error:', err.message)
  );

  redisClient.on('connect', () =>
    console.log('[GATEWAY] ✓ Redis connected')
  );

  // 🔥 KEY FIX: DON'T BLOCK STARTUP
  redisClient.connect().catch((err) => {
    console.warn('[GATEWAY] ⚠ Redis initial connection failed:', err.message);
  });
}

export { redisClient };