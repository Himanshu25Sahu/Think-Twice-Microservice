// services/analytics-service/utils/eventConsumer.js
import { createClient } from 'redis';

/**
 * Create a Redis client for event consumption
 */
export const createEventClient = async () => {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  await client.connect();
  console.log('✅ Event consumer Redis client connected');

  client.on('error', (err) => console.error('❌ Event Consumer Error:', err));

  return client;
};

/**
 * Start listening to a Redis Stream with consumer group
 * @param {object} client - Redis client instance
 * @param {string} streamName - Name of the stream
 * @param {string} groupName - Name of the consumer group
 * @param {string} consumerName - Name of this consumer
 * @param {function} messageHandler - Callback to process each message
 */
export const startStreamListener = async (
  client,
  streamName,
  groupName,
  consumerName,
  messageHandler
) => {
  try {
    // Create consumer group (idempotent - ignores if exists)
    try {
      await client.xGroupCreate(streamName, groupName, '$', {
        MKSTREAM: true,
      });
      console.log(`✅ Consumer group "${groupName}" created for stream "${streamName}"`);
    } catch (error) {
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
      console.log(`ℹ️  Consumer group "${groupName}" already exists`);
    }

    // Read and process messages indefinitely
    console.log(`🔄 Starting listener for stream: ${streamName}, group: ${groupName}`);

    while (true) {
      try {
        // Use raw Redis command for more control
        // XREADGROUP GROUP groupName consumerName STREAMS streamName >
        const messages = await client.sendCommand([
          'XREADGROUP',
          'GROUP',
          groupName,
          consumerName,
          'COUNT',
          '5',
          'BLOCK',
          '5000',
          'STREAMS',
          streamName,
          '>'
        ]);

        if (messages && Array.isArray(messages) && messages.length > 0) {
          for (const streamData of messages) {
            if (!Array.isArray(streamData) || streamData.length < 2) continue;
            
            const [key, messageList] = streamData;
            
            if (!Array.isArray(messageList)) continue;

            for (const messageItem of messageList) {
              if (!Array.isArray(messageItem) || messageItem.length < 2) continue;
              
              const [messageId, messageFields] = messageItem;

              try {
                // Parse message data
                const messageData = {};
                if (Array.isArray(messageFields)) {
                  for (let i = 0; i < messageFields.length; i += 2) {
                    messageData[messageFields[i]] = messageFields[i + 1];
                  }
                }

                // Parse JSON fields
                const eventData = {
                  messageId,
                  timestamp: messageData.timestamp,
                  ...messageData,
                };

                if (messageData.decision) {
                  try {
                    eventData.decision = JSON.parse(messageData.decision);
                  } catch (e) {
                    console.warn(`⚠️  Could not parse decision field for message ${messageId}`);
                  }
                }
                if (messageData.user) {
                  try {
                    eventData.user = JSON.parse(messageData.user);
                  } catch (e) {
                    console.warn(`⚠️  Could not parse user field for message ${messageId}`);
                  }
                }

                // Process the message
                await messageHandler(eventData);

                // Acknowledge after successful processing
                await client.xAck(streamName, groupName, messageId);
                console.log(`✅ Event processed: ${messageId}`);
              } catch (error) {
                console.error(`❌ Error processing message ${messageId}:`, error.message);
                // Don't acknowledge on error - message will be retried
              }
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error reading from stream:`, error.message);
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  } catch (error) {
    console.error(`❌ Stream listener failed:`, error.message);
    throw error;
  }
};

export default { createEventClient, startStreamListener };
