import './telemetry.js';

import 'dotenv/config.js';
import http from 'http';
import app from './app.js';
import connectDB from './database/connection.js';
import { redisClient } from './utils/redisClient.js';
import { startOrgConsumer } from './consumers/orgConsumer.js';

const PORT = process.env.PORT || 5004;
const SERVICE_NAME = 'analytics-service';


async function startServer() {
  try {
    console.log(`[${SERVICE_NAME}] Starting server...`);

    // Connect to MongoDB
    console.log(`[${SERVICE_NAME}] Connecting to MongoDB...`);
    await connectDB();
    console.log(`[${SERVICE_NAME}] Connected to MongoDB at ${process.env.MONGODB_URI || 'mongodb://localhost:27017/tt'}`);

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

    // Import handlers
    const { startConsumer, onEntryCreated, onEntryDeleted, onEntryUpdated } = await import('./consumers/entryConsumer.js');

    // Each consumer loop issues a *blocking* XREADGROUP. node-redis multiplexes
    // every command over a single socket in FIFO order, so sharing one client
    // means the first blocking read holds the connection for its full BLOCK
    // timeout while the other consumers starve behind it in the queue. Give
    // each listener its own connection.
    const consumerClient = async (label) => {
      const client = redisClient.duplicate();
      client.on('error', (err) => console.error(`[ANALYTICS] Redis error (${label}):`, err.message));
      await client.connect();
      return client;
    };

    // Entry created events
    startConsumer(
      await consumerClient('entry:created'),
      'entry:created',
      'analytics-entry-created-group',
      'analytics-entry-created-consumer',
      onEntryCreated
    );

    // Entry updated events
    startConsumer(
      await consumerClient('entry:updated'),
      'entry:updated',
      'analytics-entry-updated-group',
      'analytics-entry-updated-consumer',
      onEntryUpdated
    );

    // Entry deleted events
    startConsumer(
      await consumerClient('entry:deleted'),
      'entry:deleted',
      'analytics-entry-deleted-group',
      'analytics-entry-deleted-consumer',
      onEntryDeleted
    );

    // Org events consumer
    startOrgConsumer(await consumerClient('org:member.joined'));

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
