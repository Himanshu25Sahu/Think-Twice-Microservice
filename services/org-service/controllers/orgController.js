import Organization from '../models/Organization.js';
import Project from '../models/Project.js';
import { emitEvent } from '../utils/eventEmitter.js';
import slugify from 'slugify';
import { randomBytes } from 'crypto';
import axios from 'axios';

const generateInviteCode = () => randomBytes(4).toString('hex').toUpperCase();

const sanitizeOrg = (org) => {
  return org.toObject();
};

const sanitizeProject = (project) => {
  return project.toObject();
};

const getMemberRole = (org, userId) => {
  if (!org || !userId) {
    return null;
  }

  if (org.owner === userId) {
    return 'owner';
  }

  return org.members.find((member) => member.userId === userId)?.role || null;
};

const ensureDefaultProject = async (org, userId) => {
  const existingProject = await Project.findOne({ orgId: org._id.toString() }).sort({ createdAt: 1 });
  if (existingProject) {
    return existingProject;
  }

  const defaultProject = new Project({
    name: 'Default Project',
    description: 'System default project for legacy-safe org setup',
    orgId: org._id.toString(),
    createdBy: userId,
  });

  await defaultProject.save();
  return defaultProject;
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

    const defaultProject = await ensureDefaultProject(org, userId);

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

    // Emit events
    // 1. Owner joined event (for analytics to count totalMembers)
    await emitEvent('org:member.joined', {
      orgId: org._id.toString(),
      projectId: defaultProject._id.toString(),
      userId,
      role: 'owner',
    });

    // 2. Org created event
    await emitEvent('org:created', {
      orgId: org._id.toString(),
      projectId: defaultProject._id.toString(),
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

    // Get the default project for this org
    const defaultProject = await Project.findOne({ orgId: org._id, isDefault: true });

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
      projectId: defaultProject ? defaultProject._id.toString() : '',
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
 
    // Enrich member data with auth service
    const enrichedOrg = sanitizeOrg(org);
    try {
      const authService = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
      const memberPromises = enrichedOrg.members.map(async (member) => {
        try {
          const userResponse = await axios.get(
            `${authService}/auth/me`,
            {
              headers: {
                'x-trace-id': traceId,
                'x-user-id': member.userId,
              },
            }
          );
          member.name = userResponse.data.data?.user?.name || 'Unknown';
          member.email = userResponse.data.data?.user?.email || 'unknown@example.com';
        } catch (err) {
          console.warn(`[ORG] Failed to fetch user ${member.userId}: ${err.message}`);
          member.name = 'Unknown';
          member.email = '';
        }
        return member;
      });
      enrichedOrg.members = await Promise.all(memberPromises);
    } catch (authError) {
      console.error(`[ORG] Auth service call failed: ${authError.message} trace=${traceId}`);
      // Continue without enriched data
    }

    res.json({
      success: true,
      data: enrichedOrg,
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

export const searchOrganizationMembers = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const { orgId } = req.params;
    const q = String(req.query.q || '').trim().toLowerCase();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not provided',
      });
    }

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    const isMember = org.members.some((member) => member.userId === userId);
    if (org.owner !== userId && !isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const authService = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
    const members = await Promise.all(
      org.members.map(async (member) => {
        try {
          const userResponse = await axios.get(`${authService}/auth/me`, {
            headers: {
              'x-trace-id': traceId,
              'x-user-id': member.userId,
            },
          });

          const profile = userResponse.data.data?.user || {};
          const name = profile.name || 'Unknown';
          const username = (name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '.')
            .replace(/^\.+|\.+$/g, '');

          return {
            _id: member.userId,
            name,
            username,
            avatar: '',
          };
        } catch (error) {
          return null;
        }
      })
    );

    const filteredMembers = members
      .filter(Boolean)
      .filter((member) => {
        if (!q) return true;
        return (
          member.name.toLowerCase().includes(q) ||
          member.username.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);

    res.json({
      success: true,
      data: filteredMembers,
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ORG] Search members error: ${error.message} trace=${traceId}`);
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
      data: {
        activeOrg: orgId.toString(),
      },
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

export const updateMemberRole = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const { orgId } = req.params;
    const { memberId, newRole } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not provided',
      });
    }

    if (!memberId || !newRole) {
      return res.status(400).json({
        success: false,
        message: 'Member ID and new role are required',
      });
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'member', 'viewer'];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    console.log(`[ORG] Update member role: org=${orgId}, memberId=${memberId}, newRole=${newRole} trace=${traceId}`);

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check if requester is owner or admin
    const requesterMember = org.members.find((m) => m.userId === userId);
    const isOwner = org.owner === userId;
    const isAdmin = requesterMember && requesterMember.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only owners and admins can update member roles',
      });
    }

    // Find and update member
    const memberToUpdate = org.members.find((m) => m.userId === memberId);
    if (!memberToUpdate) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this organization',
      });
    }

    // Don't allow changing owner role (if owner wants to change their own role, they should transfer ownership first)
    if (memberToUpdate.role === 'owner' && newRole !== 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change the owner role. Transfer ownership first if needed.',
      });
    }

    const oldRole = memberToUpdate.role;
    memberToUpdate.role = newRole;

    await org.save();

    // Emit event
    await emitEvent('member:role-updated', {
      orgId: org._id.toString(),
      projectId: '',
      memberId,
      oldRole,
      newRole,
      updatedBy: userId,
    });

    console.log(`[ORG] Member role updated: ${memberId} from ${oldRole} to ${newRole} trace=${traceId}`);

    res.json({
      success: true,
      message: `Member role updated from ${oldRole} to ${newRole}`,
      data: sanitizeOrg(org),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ORG] Update member role error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeMember = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const { orgId } = req.params;
    const { memberId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not provided',
      });
    }

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: 'Member ID is required',
      });
    }

    console.log(`[ORG] Remove member: org=${orgId}, memberId=${memberId} trace=${traceId}`);

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    // Check if requester is owner
    const isOwner = org.owner === userId;
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Only the organization owner can remove members',
      });
    }

    // Find member to remove
    const memberIndex = org.members.findIndex((m) => m.userId === memberId);
    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this organization',
      });
    }

    // Prevent removing the owner
    if (memberId === org.owner) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the organization owner',
      });
    }

    const removedMember = org.members[memberIndex];
    org.members.splice(memberIndex, 1);

    await org.save();

    // Call auth service to remove org from user
    try {
      const authService = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
      await axios.put(
        `${authService}/auth/remove-org`,
        { userId: memberId, orgId: org._id.toString() },
        {
          headers: {
            'x-trace-id': traceId,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`[ORG] Removed org from user in auth service trace=${traceId}`);
    } catch (authError) {
      console.error(`[ORG] Auth service call failed: ${authError.message} trace=${traceId}`);
      // Continue anyway - member is removed from org
    }

    // Emit event
    await emitEvent('member:removed', {
      orgId: org._id.toString(),
      projectId: '',
      memberId,
      memberRole: removedMember.role,
      removedBy: userId,
    });

    console.log(`[ORG] Member removed: ${memberId} from org ${orgId} trace=${traceId}`);

    res.json({
      success: true,
      message: 'Member removed from organization',
      data: sanitizeOrg(org),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ORG] Remove member error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const createProject = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const { orgId } = req.params;
    const { name, description = '' } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not provided',
      });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Project name is required',
      });
    }

    console.log(`[ORG] Create project: org=${orgId} user=${userId} trace=${traceId}`);

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    if (org.owner !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the organization owner can create projects',
      });
    }

    const existingProject = await Project.findOne({
      orgId: orgId.toString(),
      name: name.trim(),
    });

    if (existingProject) {
      return res.status(400).json({
        success: false,
        message: 'A project with this name already exists in the organization',
      });
    }

    const project = new Project({
      name: name.trim(),
      description: description?.trim() || '',
      orgId: orgId.toString(),
      createdBy: userId,
    });

    await project.save();

    await emitEvent('org:project.created', {
      orgId: orgId.toString(),
      projectId: project._id.toString(),
      userId,
      name: project.name,
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: sanitizeProject(project),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ORG] Create project error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const listProjects = async (req, res) => {
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

    console.log(`[ORG] List projects: org=${orgId} user=${userId} trace=${traceId}`);

    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    const role = getMemberRole(org, userId);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const projects = await Project.find({ orgId: orgId.toString() }).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: projects.map(sanitizeProject),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ORG] List projects error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const switchProject = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const activeOrgId = req.headers['x-org-id'];
    const { projectId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not provided',
      });
    }

    if (!activeOrgId) {
      return res.status(400).json({
        success: false,
        message: 'Active organization header is required',
      });
    }

    console.log(`[ORG] Switch project: user=${userId} project=${projectId} org=${activeOrgId} trace=${traceId}`);

    const org = await Organization.findById(activeOrgId);
    if (!org) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found',
      });
    }

    const role = getMemberRole(org, userId);
    if (!role) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (project.orgId !== activeOrgId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Project does not belong to the active organization',
      });
    }

    try {
      const authService = process.env.AUTH_SERVICE_URL || 'http://localhost:5001';
      await axios.put(
        `${authService}/auth/update-active-project`,
        { projectId: projectId.toString() },
        {
          headers: {
            'x-trace-id': traceId,
            'x-user-id': userId,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (authError) {
      console.error(`[ORG] Auth project switch failed: ${authError.message} trace=${traceId}`);
      return res.status(503).json({
        success: false,
        message: 'Failed to update active project',
      });
    }

    res.json({
      success: true,
      message: 'Project switched successfully',
      data: sanitizeProject(project),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ORG] Switch project error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
