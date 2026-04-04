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

const generateCacheKey = (orgId, queryParams) => {
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(queryParams))
    .digest('hex');
  return `entries:${orgId}:${hash}`;
};

export const getEntries = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const orgId = req.orgId;

    const { q, type, tag, page = 1, limit = 20, sort = 'newest' } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    console.log(`[ENTRY] List entries: org=${orgId} trace=${traceId}`);

    // Generate cache key
    const cacheKey = generateCacheKey(orgId, { q, type, tag, page: pageNum, limit: limitNum, sort });

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

    // Determine sort
    let sortObj = { createdAt: -1 };
    if (sort === 'oldest') {
      sortObj = { createdAt: 1 };
    } else if (sort === 'popular') {
      sortObj = { 'upvotes.length': -1 };
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

    // Cache result for 5 minutes
    await setCache(cacheKey, result, 300);

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

export const getEntry = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const { id } = req.params;
    const orgId = req.orgId;

    console.log(`[ENTRY] Get entry: ${id} trace=${traceId}`);

    const entry = await Entry.findById(id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
      });
    }

    if (entry.orgId !== orgId) {
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

    // Handle both JSON and multipart form data
    let { title, type, what, why, context, status } = req.body;
    let dos = req.body['dos[]'] || req.body.dos || [];
    let donts = req.body['donts[]'] || req.body.donts || [];
    let tags = req.body['tags[]'] || req.body.tags || [];
    // Ensure arrays (single value comes as string, not array)
    if (typeof dos === 'string') dos = [dos];
    if (typeof donts === 'string') donts = [donts];
    if (typeof tags === 'string') tags = [tags];

    console.log(`[ENTRY] Create entry: org=${orgId} user=${userId} trace=${traceId}`);

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
    // req.file.path contains cloudinary url
    let imageUrl = '';
    try {
      imageUrl = req.file ? req.file.path : '';
    if(imageUrl) {
      console.log(`[ENTRY] Image uploaded: ${imageUrl} trace=${traceId}`);
    }
    } catch (error) {
      console.log("### image up;oad error ",error)
    }

    const entry = new Entry({
      title,
      type,
      orgId,
      authorId: userId,
      authorName: userName,
      what,
      why,
      dos: dos || [],
      donts: donts || [],
      context: context || '',
      image: imageUrl,
      tags: (tags || []).map((t) => t.toLowerCase()),
      status: status || 'published',
    });

    await entry.save();

    // Invalidate cache
    await invalidateCache(`entries:${orgId}:*`);

    // Emit event
    await emitEvent('entry:created', {
      entryId: entry._id.toString(),
      orgId,
      authorId: userId,
      type,
      title,
    });

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
    const { id } = req.params;

    const { title, type, what, why, dos, donts, context, tags, status } = req.body;

    console.log(`[ENTRY] Update entry: ${id} trace=${traceId}`);

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
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

    entry.updatedAt = new Date();
    await entry.save();

    // Invalidate cache
    await invalidateCache(`entries:${orgId}:*`);

    // Emit event
    await emitEvent('entry:updated', {
      entryId: entry._id.toString(),
      orgId,
      authorId: userId,
    });

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
    const { id } = req.params;

    console.log(`[ENTRY] Delete entry: ${id} trace=${traceId}`);

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
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
    await invalidateCache(`entries:${orgId}:*`);

    // Emit event
    await emitEvent('entry:deleted', {
      entryId: entry._id.toString(),
      orgId,
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
    const { id } = req.params;

    console.log(`[ENTRY] Toggle upvote: entry=${id} user=${userId} trace=${traceId}`);

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
      });
    }

    if (entry.orgId !== orgId) {
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
    await invalidateCache(`entries:${orgId}:*`);

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
    const { id } = req.params;

    console.log(`[ENTRY] Toggle downvote: entry=${id} user=${userId} trace=${traceId}`);

    const entry = await Entry.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Entry not found',
      });
    }

    if (entry.orgId !== orgId) {
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
    await invalidateCache(`entries:${orgId}:*`);

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
