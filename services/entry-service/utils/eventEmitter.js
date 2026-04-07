import { redisClient } from './redisClient.js';

export const emitEvent = async (streamName, data) => {
  try {
    console.log(`[ENTRY] Attempting to emit event ${streamName}:`, JSON.stringify(data));
    
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
    fields.timestamp = new Date().toISOString();
    
    console.log(`[ENTRY] Redis client ready state:`, redisClient.isReady ? 'READY' : 'NOT READY');
    console.log(`[ENTRY] Redis client open state:`, redisClient.isOpen ? 'OPEN' : 'CLOSED');
    
    const id = await redisClient.xAdd(streamName, '*', fields);
    console.log(`[ENTRY] ✅ Event ${streamName} emitted: ${id}`);
    return id;
  } catch (error) {
    console.error(`[ENTRY] ❌ Event emission FAILED for ${streamName}: ${error.message}`);
    console.error(`[ENTRY] Stack trace:`, error.stack);
    throw error;
  }
};
