import OrgMetrics from '../models/OrgMetrics.js';
import UserActivity from '../models/UserActivity.js';
import { startConsumer } from './entryConsumer.js';

const normalizeProjectId = (projectId) => projectId || '';

const getMetricScopes = (projectId) => {
  const normalizedProjectId = normalizeProjectId(projectId);
  return Array.from(new Set(['', normalizedProjectId]));
};

/**
 * Handle org:member.joined events
 * Increments totalMembers, creates UserActivity if new
 */
export const onMemberJoined = async (data) => {
  const { orgId, userId, role, projectId } = data;

  console.log(`[ANALYTICS] 👤 Member joined: ${userId} (${role}) in org ${orgId}/${normalizeProjectId(projectId) || 'aggregate'}`);

  // Store metrics for both aggregate scope AND specific projectId scope
  for (const scopeProjectId of getMetricScopes(projectId)) {
    // Get or create org metrics
    let metrics = await OrgMetrics.findOneAndUpdate(
      { orgId, projectId: scopeProjectId },
      { $setOnInsert: { orgId, projectId: scopeProjectId } },
      { upsert: true, new: true }
    );

    // Increment total members
    metrics.totalMembers += 1;
    await OrgMetrics.findOneAndUpdate(
      { orgId, projectId: scopeProjectId },
      { $set: { totalMembers: metrics.totalMembers, lastUpdated: new Date() } },
      { new: true }
    );

    // Create user activity if doesn't exist
    const userActivity = await UserActivity.findOneAndUpdate(
      { userId, orgId, projectId: scopeProjectId },
      { $setOnInsert: { userId, orgId, projectId: scopeProjectId, entriesCreated: 0, lastActive: new Date() } },
      { upsert: true, new: true }
    );
    void userActivity;
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
