import OrgMetrics from '../models/OrgMetrics.js';
import UserActivity from '../models/UserActivity.js';

const normalizeProjectId = (projectId) => projectId || '';

const getMetricScopes = (projectId) => {
  const normalizedProjectId = normalizeProjectId(projectId);
  return Array.from(new Set(['', normalizedProjectId]));
};

const getOrCreateOrgMetrics = async (orgId, projectId) => {
  let metrics = await OrgMetrics.findOne({ orgId, projectId });
  if (!metrics) {
    metrics = new OrgMetrics({ orgId, projectId });
  }
  return metrics;
};

const getOrCreateUserActivity = async (userId, orgId, projectId) => {
  let activity = await UserActivity.findOne({ userId, orgId, projectId });
  if (!activity) {
    activity = new UserActivity({ userId, orgId, projectId });
  }
  return activity;
};

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
          BLOCK: 120000, // 2 minutes to allow for longer processing times
        }
      );

      // No new messages
      if (!results || results.length === 0) {
        continue;
      }

      for (const stream of results) {
        for (const message of stream.messages) {
          const data = {};
          for (const [key, value] of Object.entries(message.message)) {
            try {
              data[key] = JSON.parse(value);
            } catch {
              data[key] = value;
            }
          }

          try {
            await handler(data);
            await redisClient.xAck(streamName, groupName, message.id);
            console.log(`[ANALYTICS] ✅ Processed ${streamName}: ${message.id}`);
          } catch (err) {
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
  const { entryId, orgId, projectId, authorId, type, title } = data;

  console.log(`[ANALYTICS] 📝 Entry created: ${entryId} (type: ${type}) in org ${orgId}/${normalizeProjectId(projectId) || 'aggregate'}`);

  for (const scopeProjectId of getMetricScopes(projectId)) {
    const metrics = await getOrCreateOrgMetrics(orgId, scopeProjectId);

    metrics.totalEntries += 1;
    if (metrics.entriesByType[type] !== undefined) {
      metrics.entriesByType[type] += 1;
    }

    const now = new Date();
    const isoWeek = getISOWeek(now);
    const existingWeek = metrics.weeklyActivity.find((week) => week.week === isoWeek);
    if (existingWeek) {
      existingWeek.count += 1;
    } else {
      metrics.weeklyActivity.push({ week: isoWeek, count: 1 });
    }

    const contributor = metrics.topContributors.find((item) => item.userId === authorId);
    if (contributor) {
      contributor.count += 1;
    } else {
      metrics.topContributors.push({ userId: authorId, count: 1 });
    }
    metrics.topContributors.sort((a, b) => b.count - a.count);
    metrics.topContributors = metrics.topContributors.slice(0, 10);
    metrics.lastUpdated = new Date();
    await metrics.save();

    const userActivity = await getOrCreateUserActivity(authorId, orgId, scopeProjectId);
    userActivity.entriesCreated += 1;
    if (userActivity.entriesByType[type] !== undefined) {
      userActivity.entriesByType[type] += 1;
    }
    userActivity.lastActive = new Date();
    await userActivity.save();
  }

  console.log(
    `[ANALYTICS] 📊 Updated metrics: org=${orgId}, project=${normalizeProjectId(projectId) || 'aggregate'}, type=${type}, contributor=${authorId}`
  );
};

/**
 * Handle entry:deleted events
 * Decrements totalEntries (type counts are historical)
 */
export const onEntryDeleted = async (data) => {
  const { entryId, orgId, projectId } = data;

  console.log(`[ANALYTICS] 🗑️ Entry deleted: ${entryId} in org ${orgId}/${normalizeProjectId(projectId) || 'aggregate'}`);

  for (const scopeProjectId of getMetricScopes(projectId)) {
    const metrics = await OrgMetrics.findOne({ orgId, projectId: scopeProjectId });
    if (!metrics) {
      continue;
    }

    if (metrics.totalEntries > 0) {
      metrics.totalEntries -= 1;
    }

    metrics.lastUpdated = new Date();
    await metrics.save();
  }

  console.log(`[ANALYTICS] 📊 Total entries decremented for org ${orgId}`);
};

/**
 * Handle entry:updated events
 * Updates lastUpdated timestamp
 */
export const onEntryUpdated = async (data) => {
  const { entryId, orgId, projectId, authorId } = data;

  console.log(`[ANALYTICS] ✏️ Entry updated: ${entryId} in org ${orgId}/${normalizeProjectId(projectId) || 'aggregate'}`);

  for (const scopeProjectId of getMetricScopes(projectId)) {
    const metrics = await OrgMetrics.findOne({ orgId, projectId: scopeProjectId });
    if (metrics) {
      metrics.lastUpdated = new Date();
      await metrics.save();
    }

    const userActivity = await UserActivity.findOne({ userId: authorId, orgId, projectId: scopeProjectId });
    if (userActivity) {
      userActivity.lastActive = new Date();
      await userActivity.save();
    }
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
