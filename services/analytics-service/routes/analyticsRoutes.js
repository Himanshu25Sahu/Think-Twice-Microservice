import express from 'express';
import {
  getOrgAnalytics,
  getUserAnalytics,
  getOverview,
} from '../controllers/analyticsController.js';

const router = express.Router();

// GET /analytics/org/:orgId - Get aggregated metrics for an organization
router.get('/org/:orgId', getOrgAnalytics);

// GET /analytics/user/:userId - Get user activity in a specific org (requires ?orgId=xxx)
router.get('/user/:userId', getUserAnalytics);

// GET /analytics/overview - Get combined org + user metrics for dashboard
// Uses x-user-id from gateway, requires ?orgId=xxx
router.get('/overview', getOverview);

export default router;
