import OrgMetrics from '../models/OrgMetrics.js';
import UserActivity from '../models/UserActivity.js';

const defaultOrgMetrics = {
  totalEntries: 0,
  totalMembers: 0,
  entriesByType: {
    architecture: 0,
    debugging: 0,
    feature: 0,
    'best-practice': 0,
    incident: 0,
    other: 0,
  },
  weeklyActivity: [],
  topContributors: [],
};

const defaultUserActivity = {
  entriesCreated: 0,
  entriesByType: {
    architecture: 0,
    debugging: 0,
    feature: 0,
    'best-practice': 0,
    incident: 0,
    other: 0,
  },
};

export const getOrgAnalytics = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const { orgId } = req.params;
    const projectId = req.query.projectId || req.headers['x-project-id'] || '';

    console.log(`[ANALYTICS] GET org metrics: ${orgId}/${projectId || 'aggregate'} trace=${traceId}`);

    let metrics = await OrgMetrics.findOne({ orgId, projectId });

    if (!metrics) {
      // Return zeroed defaults if no metrics exist yet
      return res.json({
        success: true,
        data: {
          orgId,
          projectId,
          ...defaultOrgMetrics,
          lastUpdated: new Date(),
        },
      });
    }

    res.json({
      success: true,
      data: metrics.toObject(),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ANALYTICS] Get org analytics error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserAnalytics = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const { userId } = req.params;
    const { orgId } = req.query;
    const projectId = req.query.projectId || req.headers['x-project-id'] || '';

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID (orgId) is required',
      });
    }

    console.log(`[ANALYTICS] GET user metrics: ${userId} in org ${orgId}/${projectId || 'aggregate'} trace=${traceId}`);

    let activity = await UserActivity.findOne({ userId, orgId, projectId });

    if (!activity) {
      // Return zeroed defaults if no activity exists yet
      return res.json({
        success: true,
        data: {
          userId,
          orgId,
          projectId,
          ...defaultUserActivity,
          lastActive: new Date(),
        },
      });
    }

    res.json({
      success: true,
      data: activity.toObject(),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ANALYTICS] Get user analytics error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getOverview = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const { orgId } = req.query;
    const projectId = req.query.projectId || req.headers['x-project-id'] || '';

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID (orgId) is required',
      });
    }

    console.log(`[ANALYTICS] GET overview: org=${orgId}, project=${projectId || 'aggregate'}, user=${userId} trace=${traceId}`);

    // Get organization metrics
    let orgMetrics = await OrgMetrics.findOne({ orgId, projectId });
    if (!orgMetrics) {
      orgMetrics = { ...defaultOrgMetrics, orgId, projectId, lastUpdated: new Date() };
    }

    // Get user activity in this org
    let userActivity = await UserActivity.findOne({ userId, orgId, projectId });
    if (!userActivity) {
      userActivity = { ...defaultUserActivity, userId, orgId, projectId, lastActive: new Date() };
    }

    res.json({
      success: true,
      data: {
        organization: orgMetrics.toObject?.() || orgMetrics,
        user: userActivity.toObject?.() || userActivity,
      },
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ANALYTICS] Get overview error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
