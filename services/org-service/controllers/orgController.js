import Organization from '../models/Organization.js';
import { emitEvent } from '../utils/eventEmitter.js';
import slugify from 'slugify';
import { randomBytes } from 'crypto';
import axios from 'axios';

const generateInviteCode = () => randomBytes(4).toString('hex').toUpperCase();

const sanitizeOrg = (org) => {
  return org.toObject();
};

export const createOrganization = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not provided',
      });
    }

    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Organization name is required',
      });
    }

    console.log(`[ORG] Create org: ${name} by ${userId} trace=${traceId}`);

    // Generate unique slug
    let slug = slugify(name, { lower: true, strict: true });
    let existingOrg = await Organization.findOne({ slug });
    let counter = 1;
    while (existingOrg) {
      slug = `${slugify(name, { lower: true, strict: true })}-${counter}`;
      existingOrg = await Organization.findOne({ slug });
      counter++;
    }

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let existingCode = await Organization.findOne({ inviteCode });
    while (existingCode) {
      inviteCode = generateInviteCode();
      existingCode = await Organization.findOne({ inviteCode });
    }

    // Create org
    const org = new Organization({
      name,
      slug,
      owner: userId,
      members: [
        {
          userId,
          role: 'owner',
        },
      ],
      inviteCode,
    });

    await org.save();

    // Call auth service to add org to user
    try {
      const authService = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
      await axios.put(
        `${authService}/auth/add-org`,
        { userId, orgId: org._id.toString() },
        {
          headers: {
            'x-trace-id': traceId,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`[ORG] Added org to user in auth service trace=${traceId}`);
    } catch (authError) {
      console.error(`[ORG] Auth service call failed: ${authError.message} trace=${traceId}`);
      // Don't fail the request, just log the error
    }

    // Emit event
    await emitEvent('org:created', {
      orgId: org._id.toString(),
      userId,
      name,
      slug,
    });

    console.log(`[ORG] Organization created: ${org._id} trace=${traceId}`);

    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: sanitizeOrg(org),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ORG] Create org error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const joinOrganization = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not provided',
      });
    }

    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        message: 'Invite code is required',
      });
    }

    console.log(`[ORG] Join org: ${userId} with code ${inviteCode} trace=${traceId}`);

    const org = await Organization.findOne({ inviteCode });
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Invalid invite code',
      });
    }

    // Check if already a member
    const isMember = org.members.some((m) => m.userId === userId);
    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this organization',
      });
    }

    // Add user to members
    org.members.push({
      userId,
      role: 'member',
    });

    await org.save();

    // Call auth service
    try {
      const authService = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
      await axios.put(
        `${authService}/auth/add-org`,
        { userId, orgId: org._id.toString() },
        {
          headers: {
            'x-trace-id': traceId,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`[ORG] Added org to user in auth service trace=${traceId}`);
    } catch (authError) {
      console.error(`[ORG] Auth service call failed: ${authError.message} trace=${traceId}`);
    }

    // Emit event
    await emitEvent('org:member.joined', {
      orgId: org._id.toString(),
      userId,
      role: 'member',
    });

    console.log(`[ORG] User joined org: ${org._id} trace=${traceId}`);

    res.json({
      success: true,
      message: 'Joined organization successfully',
      data: sanitizeOrg(org),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ORG] Join org error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyOrganizations = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not provided',
      });
    }

    console.log(`[ORG] Get orgs for user: ${userId} trace=${traceId}`);

    const orgs = await Organization.find({
      'members.userId': userId,
    });

    res.json({
      success: true,
      data: orgs.map(sanitizeOrg),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ORG] Get my orgs error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getOrganization = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const { orgId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not provided',
      });
    }

    console.log(`[ORG] Get org: ${orgId} trace=${traceId}`);

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Verify user is a member
    const isMember = org.members.some((m) => m.userId === userId);
    if (org.owner !== userId && !isMember) {
      console.log(`[ORG] Unauthorized access attempt: ${userId} to ${orgId} trace=${traceId}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: sanitizeOrg(org),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ORG] Get org error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const switchOrganization = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const { orgId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not provided',
      });
    }

    console.log(`[ORG] Switch org: ${userId} to ${orgId} trace=${traceId}`);

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Verify user is a member
    const isMember = org.members.some((m) => m.userId === userId);
    if (org.owner !== userId && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this organization',
      });
    }

    // Call auth service to update active org
    try {
      const authService = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
      await axios.put(
        `${authService}/auth/update-active-org`,
        { orgId: orgId.toString() },
        {
          headers: {
            'x-trace-id': traceId,
            'x-user-id': userId,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`[ORG] Updated active org in auth service trace=${traceId}`);
    } catch (authError) {
      console.error(`[ORG] Auth service call failed: ${authError.message} trace=${traceId}`);
      return res.status(503).json({
        success: false,
        message: 'Failed to update active organization',
      });
    }

    res.json({
      success: true,
      message: 'Organization switched successfully',
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ORG] Switch org error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
