import OrgMetrics from '../models/OrgMetrics.js';
import UserActivity from '../models/UserActivity.js';

/**
 * Generic consumer starter — reusable pattern for listening to Redis Streams
 * @param {RedisClient} redisClient — Connected Redis client
 * @param {String} streamName — Redis Stream name to consume
 * @param {String} groupName — Consumer group name
 * @param {String} consumerName — Consumer instance name
 * @param {Function} handler — Async function to handle each event
 */
export const startConsumer = async (redisClient, streamName, groupName, consumerName, handler) => {
  // Create consumer group (idempotent operation)
  try {
    await redisClient.xGroupCreate(streamName, groupName, '0', { MKSTREAM: true });
    console.log(`[ANALYTICS] 📋 Consumer group "${groupName}" created for "${streamName}"`);
  } catch (err) {
    // BUSYGROUP error means group already exists — this is expected
    if (!err.message.includes('BUSYGROUP')) {
      throw err;
    }
  }

  console.log(`[ANALYTICS] 🔄 Listening to ${streamName} (group: ${groupName})`);

  // Infinite loop consuming events
  while (true) {
    try {
      // Read up to 10 messages, block for 5 seconds if none
      const results = await redisClient.xReadGroup(
        groupName,
        consumerName,
        [
          {
            key: streamName,
            id: '>',
          },
        ],
        {
          COUNT: 10,
          BLOCK: 5000,
        }
      );

      // No new messages
      if (!results || Object.keys(results).length === 0) {
        continue;
      }

      // Process each message batch
      for (const streamData of Object.values(results)) {
        for (const message of streamData) {
          // Parse JSON fields from stream (Redis stores everything as strings)
          const data = {};
          for (const [key, value] of Object.entries(message.message)) {
            try {
              data[key] = JSON.parse(value);
            } catch {
              // Not JSON, keep as string
              data[key] = value;
            }
          }

          try {
            // Call the handler to process this event
            await handler(data);
            // Acknowledge receipt (idempotent, won't reprocess if crashed)
            await redisClient.xAck(streamName, groupName, message.id);
            console.log(`[ANALYTICS] ✅ Processed ${streamName}: ${message.id}`);
          } catch (err) {
            // Don't ACK on error — message will be retried
            console.error(`[ANALYTICS] ❌ Handler error for ${streamName}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.error(`[ANALYTICS] ❌ Consumer error on ${streamName}: ${err.message}`);
      // Backoff 5 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

/**
 * Handle entry:created events
 * Increments metrics: totalEntries, entriesByType, weeklyActivity, topContributors
 */
export const onEntryCreated = async (data) => {
  const { entryId, orgId, authorId, type, title } = data;

  console.log(`[ANALYTICS] 📝 Entry created: ${entryId} (type: ${type}) in org ${orgId}`);

  // Get or create org metrics
  let metrics = await OrgMetrics.findOne({ orgId });
  if (!metrics) {
    metrics = new OrgMetrics({ orgId });
  }

  // Increment total entries
  metrics.totalEntries += 1;

  // Increment entry type count
  if (metrics.entriesByType[type] !== undefined) {
    metrics.entriesByType[type] += 1;
  }

  // Update weekly activity (ISO week format)
  const now = new Date();
  const isoWeek = getISOWeek(now);
  const existingWeek = metrics.weeklyActivity.find((w) => w.week === isoWeek);
  if (existingWeek) {
    existingWeek.count += 1;
  } else {
    metrics.weeklyActivity.push({ week: isoWeek, count: 1 });
  }

  // Update top contributors
  const contributor = metrics.topContributors.find((c) => c.userId === authorId);
  if (contributor) {
    contributor.count += 1;
  } else {
    metrics.topContributors.push({ userId: authorId, count: 1 });
  }
  // Keep only top 10
  metrics.topContributors.sort((a, b) => b.count - a.count);
  metrics.topContributors = metrics.topContributors.slice(0, 10);

  metrics.lastUpdated = new Date();
  await metrics.save();

  // Update user activity
  let userActivity = await UserActivity.findOne({ userId: authorId, orgId });
  if (!userActivity) {
    userActivity = new UserActivity({ userId: authorId, orgId });
  }

  userActivity.entriesCreated += 1;
  if (userActivity.entriesByType[type] !== undefined) {
    userActivity.entriesByType[type] += 1;
  }
  userActivity.lastActive = new Date();
  await userActivity.save();

  console.log(
    `[ANALYTICS] 📊 Updated metrics: org=${orgId}, type=${type}, contributor=${authorId}`
  );
};

/**
 * Handle entry:deleted events
 * Decrements totalEntries (type counts are historical)
 */
export const onEntryDeleted = async (data) => {
  const { entryId, orgId } = data;

  console.log(`[ANALYTICS] 🗑️ Entry deleted: ${entryId} in org ${orgId}`);

  let metrics = await OrgMetrics.findOne({ orgId });
  if (!metrics) {
    return; // Org has no metrics yet
  }

  // Decrement total entries
  if (metrics.totalEntries > 0) {
    metrics.totalEntries -= 1;
  }

  metrics.lastUpdated = new Date();
  await metrics.save();

  console.log(`[ANALYTICS] 📊 Total entries decremented for org ${orgId}`);
};

/**
 * Handle entry:updated events
 * Updates lastUpdated timestamp
 */
export const onEntryUpdated = async (data) => {
  const { entryId, orgId, authorId } = data;

  console.log(`[ANALYTICS] ✏️ Entry updated: ${entryId} in org ${orgId}`);

  let metrics = await OrgMetrics.findOne({ orgId });
  if (!metrics) {
    return;
  }

  metrics.lastUpdated = new Date();
  await metrics.save();

  // Update user activity
  let userActivity = await UserActivity.findOne({ userId: authorId, orgId });
  if (userActivity) {
    userActivity.lastActive = new Date();
    await userActivity.save();
  }

  console.log(`[ANALYTICS] 📊 Updated timestamp for org ${orgId}`);
};

/**
 * Get ISO week string (e.g., "2026-W14")
 */
const getISOWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};
