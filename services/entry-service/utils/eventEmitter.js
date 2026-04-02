import { redisClient } from './redisClient.js';

export const emitEvent = async (streamName, data) => {
  try {
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      fields[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
    fields.timestamp = new Date().toISOString();
    const id = await redisClient.xAdd(streamName, '*', fields);
    console.log(`[ENTRY] 📤 Event ${streamName}: ${id}`);
    return id;
  } catch (error) {
    console.error(`[ENTRY] Event emission error: ${error.message}`);
  }
};
