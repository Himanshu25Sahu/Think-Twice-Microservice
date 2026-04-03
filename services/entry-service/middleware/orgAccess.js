import axios from 'axios';
import { getCache, setCache } from '../utils/redisClient.js';

export const orgAccess = async (req, res, next) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not provided',
      });
    }

    // Get orgId from query param or body
    const orgId = req.query.orgId || req.body?.orgId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    // Check cache first
    const cacheKey = `org:member:${orgId}:${userId}`;
    const cached = await getCache(cacheKey);

    if (cached !== null) {
      if (cached === 'denied') {
        console.log(`[ENTRY] Cached access denied: ${userId} to ${orgId} trace=${traceId}`);
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }
      // Cached role data
      const roleData = JSON.parse(cached);
      req.orgId = orgId;
      req.userRole = roleData.role;
      console.log(`[ENTRY] Access granted (cached): ${userId} to ${orgId}, role=${roleData.role} trace=${traceId}`);
      return next();
    }

    // Not in cache, call org-service
    try {
      const orgService = process.env.ORG_SERVICE_URL || 'http://localhost:5003';
      const response = await axios.get(`${orgService}/org/${orgId}`, {
        headers: {
          'x-trace-id': traceId,
          'x-user-id': userId,
        },
      });

      if (response.data.success) {
        // Find user's role in the organization
        const org = response.data.data;
        const member = org.members.find((m) => m.userId === userId);
        const userRole = member ? member.role : null;

        if (!userRole) {
          // Member not found - access denied
          await setCache(cacheKey, 'denied', 300);
          console.log(`[ENTRY] Access denied: User not a member - ${userId} to ${orgId} trace=${traceId}`);
          return res.status(403).json({
            success: false,
            message: 'Access denied',
          });
        }

        // Cache allow with role for 5 minutes
        await setCache(cacheKey, JSON.stringify({ role: userRole }), 300);
        req.orgId = orgId;
        req.userRole = userRole;
        console.log(`[ENTRY] Access granted: ${userId} to ${orgId}, role=${userRole} trace=${traceId}`);
        return next();
      }
    } catch (orgError) {
      if (orgError.response?.status === 403) {
        // Cache deny for 5 minutes
        await setCache(cacheKey, 'denied', 300);
        console.log(`[ENTRY] Access denied: ${userId} to ${orgId} trace=${traceId}`);
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }

      // Other errors (org-service down) — return error
      console.error(`[ENTRY] Org service error: ${orgError.message} trace=${traceId}`);
      return res.status(503).json({
        success: false,
        message: 'Service unavailable',
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied',
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ENTRY] Org access check failed: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * Middleware to check if user has required role
 * Usage: router.post('/entry', orgAccess, requireRole('admin', 'owner'), entryController.create)
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userRole = req.userRole;

    if (!userRole || !allowedRoles.includes(userRole)) {
      console.log(`[ENTRY] Role check failed: user role ${userRole} not in ${allowedRoles.join(', ')} trace=${traceId}`);
      return res.status(403).json({
        success: false,
        message: `Only users with roles [${allowedRoles.join(', ')}] can perform this action`,
      });
    }

    console.log(`[ENTRY] Role check passed: user role ${userRole} trace=${traceId}`);
    next();
  };
};

export default orgAccess;
