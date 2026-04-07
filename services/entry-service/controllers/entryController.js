import Entry from '../models/Entry.js';
import { getCache, setCache, invalidateCache } from '../utils/redisClient.js';
import { emitEvent } from '../utils/eventEmitter.js';
import cloudinary from '../utils/cloudinary.js';
import crypto from 'crypto';
import axios from 'axios';

const sanitizeEntry = (entry) => {
  if (typeof entry.toObject === 'function') {
    return entry.toObject();
  }
  return entry;
};

const generateCacheKey = (orgId, projectId, queryParams) => {
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(queryParams))
    .digest('hex');
  return `entries:${orgId}:${projectId}:${hash}`;
};

const isLegacyProjectEntry = (entryProjectId) => {
  return entryProjectId === undefined || entryProjectId === null || entryProjectId === '';
};

const matchesProjectScope = (entryProjectId, projectId, defaultProjectId) => {
  if (entryProjectId === projectId) {
    return true;
  }

  return projectId === defaultProjectId && isLegacyProjectEntry(entryProjectId);
};

const addProjectScope = (query, projectId, defaultProjectId) => {
  if (projectId === defaultProjectId) {
    query.$or = [
      { projectId },
      { projectId: { $exists: false } },
      { projectId: null },
      { projectId: '' },
    ];
    return query;
  }

  query.projectId = projectId;
  return query;
};

const normalizeMentionedUserIds = (value) => {
  const rawList = Array.isArray(value) ? value : value ? [value] : [];
  const normalized = rawList
    .map((item) => String(item).trim())
    .filter(Boolean);

  return [...new Set(normalized)];
};

/**
 * Reusable helper for paginated entry queries
 * Handles caching, filtering, sorting, and pagination
 * @param {Object} query - MongoDB query filter
 * @param {Object} options - Pagination & sorting options
 * @param {number} options.page - Page number (1-based)
 * @param {number} options.limit - Items per page (max 100)
 * @param {Object} options.sortObj - MongoDB sort object
 * @param {string} options.cacheKey - Redis cache key (optional)
 * @returns {Promise<Object>} - { entries, pagination: { page, limit, total, pages } }
 */
export const getPaginatedEntries = async (query, options = {}) => {
  const {
    page = 1,
    limit = 20,
    sortObj = { createdAt: -1 },
    cacheKey,
  } = options;

  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  // Check cache if cacheKey provided
  if (cacheKey) {
    const cached = await getCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Execute query
  const entries = await Entry.find(query)
    .sort(sortObj)
    .skip(skip)
    .limit(limitNum)
    .lean();

  const total = await Entry.countDocuments(query);

  const result = {
    entries: entries.map(sanitizeEntry),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };

  // Cache if cacheKey provided
  if (cacheKey) {
    await setCache(cacheKey, result, 300); // 5 min TTL
  }

  return result;
};

export const getEntries = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const orgId = req.orgId;
    const projectId = req.projectId;
    const defaultProjectId = req.defaultProjectId;

    const { q, type, tag, mentionedUserId, page = 1, limit = 20, sort = 'newest' } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));

    console.log(`[ENTRY] List entries: org=${orgId} project=${projectId} trace=${traceId}`);

    // Generate cache key
    const cacheKey = generateCacheKey(orgId, projectId, {
      q,
      type,
      tag,
      mentionedUserId,
      page: pageNum,
      limit: limitNum,
      sort,
    });

    // Check cache
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log(`[ENTRY] Cache hit: ${cacheKey} trace=${traceId}`);
      return res.json({
        success: true,
        data: cached,
      });
    }

    // Build query
    let query = {
      orgId,
      status: { $ne: 'archived' },
    };
    query = addProjectScope(query, projectId, defaultProjectId);

    // Text search
    if (q) {
      query.$text = { $search: q };
    }

    // Filter by type
    if (type && type !== 'all') {
      query.type = type;
    }

    // Filter by tag
    if (tag) {
      query.tags = tag.toLowerCase();
    }

    // Filter by mentioned user
    if (mentionedUserId) {
      query.mentions = String(mentionedUserId).trim();
    }

    // Determine sort
    let sortObj = { createdAt: -1 };
    if (sort === 'oldest') {
      sortObj = { createdAt: 1 };
    } else if (sort === 'popular') {
      sortObj = { 'upvotes.length': -1 };
    }

    // Use helper for pagination & cache management
    const result = await getPaginatedEntries(query, {
      page: pageNum,
      limit: limitNum,
      sortObj,
      cacheKey,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ENTRY] List entries error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const searchMentions = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const orgId = req.orgId;
    const { q = '' } = req.query;

    const orgService = process.env.ORG_SERVICE_URL || 'http://localhost:5003';
    const response = await axios.get(`${orgService}/org/${orgId}/members/search`, {
      params: { q },
      headers: {
        'x-trace-id': traceId,
        'x-user-id': userId,
      },
    });

    res.json({
      success: true,
      data: response.data.data || [],
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ENTRY] Search mentions error: ${error.message} trace=${traceId}`);
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || 'Failed to search org members',
    });
  }
};

export const getEntry = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const { id } = req.params;
    const orgId = req.orgId;
    const projectId = req.projectId;
    const defaultProjectId = req.defaultProjectId;

    console.log(`[ENTRY] Get entry: ${id} trace=${traceId}`);

    const entry = await Entry.findById(id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
      });
    }

    if (entry.orgId !== orgId || !matchesProjectScope(entry.projectId, projectId, defaultProjectId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: sanitizeEntry(entry),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ENTRY] Get entry error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const createEntry = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const userEmail = req.headers['x-user-email'];
    const userName = req.headers['x-user-name'] || userEmail;
    const orgId = req.orgId;
    const projectId = req.projectId;

    // Handle both JSON and multipart form data
    let { title, type, what, why, context, status } = req.body;
    let dos = req.body['dos[]'] || req.body.dos || [];
    let donts = req.body['donts[]'] || req.body.donts || [];
    let tags = req.body['tags[]'] || req.body.tags || [];
    let mentionedUserIds = req.body['mentionedUserIds[]'] || req.body.mentionedUserIds || [];
    // Ensure arrays (single value comes as string, not array)
    if (typeof dos === 'string') dos = [dos];
    if (typeof donts === 'string') donts = [donts];
    if (typeof tags === 'string') tags = [tags];
    mentionedUserIds = normalizeMentionedUserIds(mentionedUserIds);

    console.log(`[ENTRY] Create entry: org=${orgId} project=${projectId} user=${userId} trace=${traceId}`);

    // Validation
    if (!title || !type || !what || !why) {
      return res.status(400).json({
        success: false,
        message: 'Title, type, what, and why are required',
      });
    }

    if (!['architecture', 'debugging', 'feature', 'best-practice', 'incident', 'other'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entry type',
      });
    }

    // Handle image upload if present
    // Supports legacy req.file, req.files array, and req.files object from upload.fields
    let imageUrl = '';
    let imageUrls = [];
    try {
      // Single image upload (backward compatibility)
      if (req.file) {
        imageUrl = req.file.path;
        imageUrls.push(imageUrl);
        console.log(`[ENTRY] Image uploaded: ${imageUrl} trace=${traceId}`);
      }
      // Multiple images upload (array form)
      else if (req.files && Array.isArray(req.files)) {
        imageUrls = req.files.slice(0, 3).map((f) => f.path); // Max 3 images
        if (imageUrls.length > 0) imageUrl = imageUrls[0]; // Set first as main image for backward compatibility
        console.log(`[ENTRY] ${imageUrls.length} images uploaded trace=${traceId}`);
      }
      // Multiple images upload (fields form)
      else if (req.files && typeof req.files === 'object') {
        const single = req.files.image?.[0]?.path;
        const multiple = req.files.images || req.files['images[]'] || [];
        imageUrls = multiple.slice(0, 3).map((f) => f.path).filter(Boolean);

        if (single) {
          imageUrl = single;
          if (imageUrls.length === 0) {
            imageUrls = [single];
          }
        } else if (imageUrls.length > 0) {
          imageUrl = imageUrls[0];
        }

        if (imageUrls.length > 0 || imageUrl) {
          console.log(`[ENTRY] ${imageUrls.length || 1} images uploaded trace=${traceId}`);
        }
      }
      // Validate images array from body (for JSON updates)
      const bodyImages = req.body['images[]'] || req.body.images || [];
      if (Array.isArray(bodyImages) && bodyImages.length > 0) {
        imageUrls = bodyImages.slice(0, 3);
        if (!imageUrl && imageUrls.length > 0) {
          imageUrl = imageUrls[0];
        }
      }
    } catch (error) {
      console.log("### image upload error", error);
    }

    const entry = new Entry({
      title,
      type,
      orgId,
      projectId,
      authorId: userId,
      authorName: userName,
      what,
      why,
      dos: dos || [],
      donts: donts || [],
      context: context || '',
      image: imageUrl,
      images: imageUrls,
      tags: (tags || []).map((t) => t.toLowerCase()),
      mentions: mentionedUserIds,
      status: status || 'published',
    });

    await entry.save();

    // Invalidate cache
    await invalidateCache(`entries:${orgId}:${projectId}:*`);

    // Emit event
    try {
      await emitEvent('entry:created', {
        entryId: entry._id.toString(),
        orgId,
        projectId,
        authorId: userId,
        type,
        title,
      });

      if (mentionedUserIds.length > 0) {
        await emitEvent('entry:mentioned', {
          eventType: 'entry:mentioned',
          orgId,
          projectId,
          entryId: entry._id.toString(),
          mentionedUserIds,
          authorId: userId,
        });
      }
    } catch (emitError) {
      console.error(`[ENTRY] Event emission failed but entry was saved: ${emitError.message} trace=${traceId}`);
      // Continue - entry was saved, just event wasn't emitted
    }

    console.log(`[ENTRY] Entry created: ${entry._id} trace=${traceId}`);

    res.status(201).json({
      success: true,
      message: 'Entry created successfully',
      data: sanitizeEntry(entry),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ENTRY] Create entry error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateEntry = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const orgId = req.orgId;
    const projectId = req.projectId;
    const defaultProjectId = req.defaultProjectId;
    const { id } = req.params;

    const { title, type, what, why, dos, donts, context, tags, status } = req.body;
    const hasMentionedUserIdsField =
      Object.prototype.hasOwnProperty.call(req.body, 'mentionedUserIds') ||
      Object.prototype.hasOwnProperty.call(req.body, 'mentionedUserIds[]');
    const mentionedUserIds = normalizeMentionedUserIds(
      req.body['mentionedUserIds[]'] || req.body.mentionedUserIds
    );

    console.log(`[ENTRY] Update entry: ${id} trace=${traceId}`);

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
      });
    }

    if (entry.orgId !== orgId || !matchesProjectScope(entry.projectId, projectId, defaultProjectId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Verify ownership (author can update, or org admin)
    if (entry.authorId !== userId) {
      // Check if user is org admin — call org-service
      try {
        const orgService = process.env.ORG_SERVICE_URL || 'http://localhost:5003';
        const orgResponse = await axios.get(`${orgService}/org/${orgId}`, {
          headers: {
            'x-trace-id': traceId,
            'x-user-id': userId,
          },
        });

        const userMember = orgResponse.data.data.members.find((m) => m.userId === userId);
        const isAdmin = userMember?.role === 'admin' || orgResponse.data.data.owner === userId;

        if (!isAdmin) {
          console.log(`[ENTRY] Unauthorized update: ${userId} to ${id} trace=${traceId}`);
          return res.status(403).json({
            success: false,
            message: 'Only author or org admin can update this entry',
          });
        }
      } catch (error) {
        console.error(`[ENTRY] Org service check failed: ${error.message} trace=${traceId}`);
        return res.status(403).json({
          success: false,
          message: 'Only author or org admin can update this entry',
        });
      }
    }

    // Update fields
    if (title !== undefined) entry.title = title;
    if (type !== undefined) entry.type = type;
    if (what !== undefined) entry.what = what;
    if (why !== undefined) entry.why = why;
    if (dos !== undefined) entry.dos = dos;
    if (donts !== undefined) entry.donts = donts;
    if (context !== undefined) entry.context = context;
    if (tags !== undefined) entry.tags = tags.map((t) => t.toLowerCase());
    if (status !== undefined && ['draft', 'published', 'archived'].includes(status)) {
      entry.status = status;
    }
    if (hasMentionedUserIdsField) {
      entry.mentions = mentionedUserIds;
    }
    
    // Handle images array update
    const bodyImages = req.body['images[]'] || req.body.images;
    if (bodyImages !== undefined) {
      if (Array.isArray(bodyImages)) {
        entry.images = bodyImages.slice(0, 3); // Max 3 images
        if (bodyImages.length > 0) entry.image = bodyImages[0]; // Update main image too
      } else {
        entry.images = [];
      }
    }
    
    if (isLegacyProjectEntry(entry.projectId)) {
      entry.projectId = projectId;
    }

    entry.updatedAt = new Date();
    await entry.save();

    // Invalidate cache
    await invalidateCache(`entries:${orgId}:${projectId}:*`);

    // Emit event
    await emitEvent('entry:updated', {
      entryId: entry._id.toString(),
      orgId,
      projectId,
      authorId: userId,
    });

    if (entry.mentions?.length > 0) {
      await emitEvent('entry:mentioned', {
        eventType: 'entry:mentioned',
        orgId,
        projectId,
        entryId: entry._id.toString(),
        mentionedUserIds: entry.mentions,
        authorId: userId,
      });
    }

    console.log(`[ENTRY] Entry updated: ${id} trace=${traceId}`);

    res.json({
      success: true,
      message: 'Entry updated successfully',
      data: sanitizeEntry(entry),
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ENTRY] Update entry error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteEntry = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const orgId = req.orgId;
    const projectId = req.projectId;
    const defaultProjectId = req.defaultProjectId;
    const { id } = req.params;

    console.log(`[ENTRY] Delete entry: ${id} trace=${traceId}`);

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
      });
    }

    if (entry.orgId !== orgId || !matchesProjectScope(entry.projectId, projectId, defaultProjectId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Verify ownership or admin
    if (entry.authorId !== userId) {
      try {
        const orgService = process.env.ORG_SERVICE_URL || 'http://localhost:5003';
        const orgResponse = await axios.get(`${orgService}/org/${orgId}`, {
          headers: {
            'x-trace-id': traceId,
            'x-user-id': userId,
          },
        });

        const userMember = orgResponse.data.data.members.find((m) => m.userId === userId);
        const isAdmin = userMember?.role === 'admin' || orgResponse.data.data.owner === userId;

        if (!isAdmin) {
          return res.status(403).json({
            success: false,
            message: 'Only author or org admin can delete this entry',
          });
        }
      } catch (error) {
        return res.status(403).json({
          success: false,
          message: 'Only author or org admin can delete this entry',
        });
      }
    }

    // Soft delete
    entry.status = 'archived';
    await entry.save();

    // Invalidate cache
    await invalidateCache(`entries:${orgId}:${projectId}:*`);

    // Emit event
    await emitEvent('entry:deleted', {
      entryId: entry._id.toString(),
      orgId,
      projectId,
      authorId: userId,
    });

    console.log(`[ENTRY] Entry deleted: ${id} trace=${traceId}`);

    res.json({
      success: true,
      message: 'Entry deleted successfully',
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ENTRY] Delete entry error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const toggleUpvote = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const orgId = req.orgId;
    const projectId = req.projectId;
    const defaultProjectId = req.defaultProjectId;
    const { id } = req.params;

    console.log(`[ENTRY] Toggle upvote: entry=${id} user=${userId} trace=${traceId}`);

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
      });
    }

    if (entry.orgId !== orgId || !matchesProjectScope(entry.projectId, projectId, defaultProjectId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const upvoteIndex = entry.upvotes.indexOf(userId);
    const downvoteIndex = entry.downvotes ? entry.downvotes.indexOf(userId) : -1;
    let upvoted = false;

    if (upvoteIndex === -1) {
      entry.upvotes.push(userId);
      upvoted = true;
      // Remove from downvotes if present
      if (downvoteIndex !== -1) {
        entry.downvotes.splice(downvoteIndex, 1);
      }
    } else {
      entry.upvotes.splice(upvoteIndex, 1);
      upvoted = false;
    }

    await entry.save();

    // Invalidate cache
    await invalidateCache(`entries:${orgId}:${projectId}:*`);

    res.json({
      success: true,
      data: {
        upvoted,
        upvotes: entry.upvotes.length,
        downvotes: entry.downvotes ? entry.downvotes.length : 0,
      },
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ENTRY] Toggle upvote error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const toggleDownvote = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const orgId = req.orgId;
    const projectId = req.projectId;
    const defaultProjectId = req.defaultProjectId;
    const { id } = req.params;

    console.log(`[ENTRY] Toggle downvote: entry=${id} user=${userId} trace=${traceId}`);

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
      });
    }

    if (entry.orgId !== orgId || !matchesProjectScope(entry.projectId, projectId, defaultProjectId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Ensure downvotes array exists
    if (!entry.downvotes) {
      entry.downvotes = [];
    }

    const downvoteIndex = entry.downvotes.indexOf(userId);
    const upvoteIndex = entry.upvotes.indexOf(userId);
    let downvoted = false;

    if (downvoteIndex === -1) {
      entry.downvotes.push(userId);
      downvoted = true;
      // Remove from upvotes if present
      if (upvoteIndex !== -1) {
        entry.upvotes.splice(upvoteIndex, 1);
      }
    } else {
      entry.downvotes.splice(downvoteIndex, 1);
      downvoted = false;
    }

    await entry.save();

    // Invalidate cache
    await invalidateCache(`entries:${orgId}:${projectId}:*`);

    res.json({
      success: true,
      data: {
        downvoted,
        upvotes: entry.upvotes.length,
        downvotes: entry.downvotes.length,
      },
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ENTRY] Toggle downvote error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const addRelation = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const orgId = req.orgId;
    const projectId = req.projectId;
    const defaultProjectId = req.defaultProjectId;
    const { id } = req.params;
    const { targetEntryId, type } = req.body;

    console.log(`[ENTRY] Add relation: ${id} → ${targetEntryId} (${type}) trace=${traceId}`);

    // Validation
    if (!targetEntryId || !type) {
      return res.status(400).json({
        success: false,
        message: 'targetEntryId and type are required',
      });
    }

    if (!['impacts', 'depends_on', 'replaces', 'related_to', 'blocks'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid relation type',
      });
    }

    // Fetch source entry
    const sourceEntry = await Entry.findById(id);
    if (!sourceEntry) {
      return res.status(404).json({
        success: false,
        message: 'Source entry not found',
      });
    }

    if (sourceEntry.orgId !== orgId || !matchesProjectScope(sourceEntry.projectId, projectId, defaultProjectId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Fetch target entry
    const targetEntry = await Entry.findById(targetEntryId);
    if (!targetEntry) {
      return res.status(404).json({
        success: false,
        message: 'Target entry not found',
      });
    }

    if (targetEntry.orgId !== orgId || !matchesProjectScope(targetEntry.projectId, projectId, defaultProjectId)) {
      return res.status(403).json({
        success: false,
        message: 'Target entry not in same org/project',
      });
    }

    // Prevent self-reference
    if (id === targetEntryId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create relation to self',
      });
    }

    // Check if relation already exists
    const relationExists = sourceEntry.relations.some(
      (rel) => rel.targetEntryId.toString() === targetEntryId && rel.type === type
    );

    if (relationExists) {
      return res.status(400).json({
        success: false,
        message: 'Relation already exists',
      });
    }

    // Add relation (ensure relations array exists)
    if (!sourceEntry.relations) {
      sourceEntry.relations = [];
    }

    sourceEntry.relations.push({
      targetEntryId,
      type,
      createdAt: new Date(),
    });

    await sourceEntry.save();

    // Invalidate cache
    await invalidateCache(`entries:${orgId}:${projectId}:*`);

    // Emit event
    await emitEvent('entry:relation:changed', {
      sourceEntryId: id,
      targetEntryId,
      type,
      action: 'added',
      orgId,
      projectId,
      userId,
    });

    console.log(`[ENTRY] Relation added: ${id} → ${targetEntryId} trace=${traceId}`);

    res.json({
      success: true,
      message: 'Relation added successfully',
      data: {
        relation: sourceEntry.relations[sourceEntry.relations.length - 1],
      },
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ENTRY] Add relation error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeRelation = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const orgId = req.orgId;
    const projectId = req.projectId;
    const defaultProjectId = req.defaultProjectId;
    const { id, targetId } = req.params;

    console.log(`[ENTRY] Remove relation: ${id} → ${targetId} trace=${traceId}`);

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
      });
    }

    if (entry.orgId !== orgId || !matchesProjectScope(entry.projectId, projectId, defaultProjectId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Find and remove relation
    const relationIndex = entry.relations.findIndex(
      (rel) => rel.targetEntryId.toString() === targetId
    );

    if (relationIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Relation not found',
      });
    }

    const removedRelation = entry.relations[relationIndex];
    entry.relations.splice(relationIndex, 1);

    await entry.save();

    // Invalidate cache
    await invalidateCache(`entries:${orgId}:${projectId}:*`);

    // Emit event
    await emitEvent('entry:relation:changed', {
      sourceEntryId: id,
      targetEntryId: targetId,
      type: removedRelation.type,
      action: 'removed',
      orgId,
      projectId,
      userId,
    });

    console.log(`[ENTRY] Relation removed: ${id} → ${targetId} trace=${traceId}`);

    res.json({
      success: true,
      message: 'Relation removed successfully',
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ENTRY] Remove relation error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getGraph = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const orgId = req.orgId;
    const projectId = req.projectId;
    const defaultProjectId = req.defaultProjectId;

    console.log(`[ENTRY] Get graph: org=${orgId} project=${projectId} trace=${traceId}`);

    // Generate cache key for graph (much shorter TTL: 60s)
    const graphCacheKey = `graph:${orgId}:${projectId}`;

    // Check cache
    const cachedGraph = await getCache(graphCacheKey);
    if (cachedGraph) {
      console.log(`[ENTRY] Graph cache hit: ${graphCacheKey} trace=${traceId}`);
      return res.json({
        success: true,
        data: cachedGraph,
      });
    }

    // Fetch all entries for this org/project
    let query = {
      orgId,
      status: { $ne: 'archived' },
    };
    query = addProjectScope(query, projectId, defaultProjectId);

    const entries = await Entry.find(query)
      .select('_id title type projectId relations')
      .lean();

    // Build nodes and edges
    const nodes = entries.map((entry) => ({
      id: entry._id.toString(),
      data: {
        label: entry.title,
        type: entry.type,
      },
      type: 'default',
    }));

    const edges = [];
    entries.forEach((entry) => {
      if (entry.relations && entry.relations.length > 0) {
        entry.relations.forEach((relation) => {
          // Check if target entry exists in the project
          const targetExists = entries.some(
            (e) => e._id.toString() === relation.targetEntryId.toString()
          );

          if (targetExists) {
            edges.push({
              id: `${entry._id.toString()}-${relation.targetEntryId.toString()}-${relation.type}`,
              source: entry._id.toString(),
              target: relation.targetEntryId.toString(),
              data: {
                type: relation.type,
              },
              label: relation.type.replace('_', ' '),
            });
          }
        });
      }
    });

    const result = {
      nodes,
      edges,
    };

    // Cache result for 60 seconds (shorter than entries since graph changes frequently)
    await setCache(graphCacheKey, result, 60);

    console.log(`[ENTRY] Graph response: org=${orgId} project=${projectId} nodes=${nodes.length} edges=${edges.length} trace=${traceId}`);
    if (edges.length > 0) {
      console.log('[ENTRY] Edges:', JSON.stringify(edges.slice(0, 2), null, 2));
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[ENTRY] Get graph error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
