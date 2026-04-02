import OrgMetrics from '../models/OrgMetrics.js';
import UserActivity from '../models/UserActivity.js';
import { startConsumer } from './entryConsumer.js';

/**
 * Handle org:member.joined events
 * Increments totalMembers, creates UserActivity if new
 */
export const onMemberJoined = async (data) => {
  const { orgId, userId, role } = data;

  console.log(`[ANALYTICS] 👤 Member joined: ${userId} (${role}) in org ${orgId}`);

  // Get or create org metrics
  let metrics = await OrgMetrics.findOne({ orgId });
  if (!metrics) {
    metrics = new OrgMetrics({ orgId });
  }

  // Increment total members
  metrics.totalMembers += 1;
  metrics.lastUpdated = new Date();
  await metrics.save();

  // Create user activity if doesn't exist
  const existing = await UserActivity.findOne({ userId, orgId });
  if (!existing) {
    const userActivity = new UserActivity({
      userId,
      orgId,
      entriesCreated: 0,
      lastActive: new Date(),
    });
    await userActivity.save();
    console.log(`[ANALYTICS] 📊 Created UserActivity for ${userId} in org ${orgId}`);
  }

  console.log(`[ANALYTICS] 📊 Updated member count for org ${orgId}`);
};

/**
 * Start consuming org:member.joined events
 */
export const startOrgConsumer = async (redisClient) => {
  await startConsumer(
    redisClient,
    'org:member.joined',
    'analytics-group',
    'org-consumer',
    onMemberJoined
  );
};
