import 'dotenv/config.js';
import http from 'http';
import app from './app.js';
import connectDB from './database/connection.js';
import { redisClient } from './utils/redisClient.js';
import { startConsumer } from './consumers/entryConsumer.js';
import { startOrgConsumer } from './consumers/orgConsumer.js';

const PORT = process.env.PORT || 5004;
const SERVICE_NAME = 'analytics-service';


async function startServer() {
  try {
    console.log(`[${SERVICE_NAME}] Starting server...`);

    // Connect to MongoDB
    console.log(`[${SERVICE_NAME}] Connecting to MongoDB...`);
    await connectDB();
    console.log(`[${SERVICE_NAME}] Connected to MongoDB`);

    // Connect to Redis
    console.log(`[${SERVICE_NAME}] Connecting to Redis...`);
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    console.log(`[${SERVICE_NAME}] Connected to Redis`);

    // Start HTTP server
    const server = http.createServer(app);
    server.listen(PORT, () => {
      console.log(`[${SERVICE_NAME}] HTTP server listening on port ${PORT}`);
    });

    // Start event consumers (background tasks)
    console.log(`[${SERVICE_NAME}] Starting event consumers...`);

    // Entry events consumer
    startConsumer(
      redisClient,
      'entry-events',
      'analytics-group',
      'analytics-entry-consumer',
      async (data) => {
        // Handler function receives event data
        // Actual handlers (onEntryCreated, etc.) are called inside consumer.js
        // This is just the dispatcher that will call appropriate handler
      }
    );

    // Org events consumer
    startOrgConsumer(redisClient);

    console.log(`[${SERVICE_NAME}] Ready to process events`);
    console.log(`[${SERVICE_NAME}] Service startup complete`);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log(`[${SERVICE_NAME}] SIGTERM received, shutting down gracefully`);
      server.close(async () => {
        await redisClient.disconnect();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log(`[${SERVICE_NAME}] SIGINT received, shutting down gracefully`);
      server.close(async () => {
        await redisClient.disconnect();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error(`[${SERVICE_NAME}] Fatal error: ${error.message}`);
    process.exit(1);
  }
}

startServer();
