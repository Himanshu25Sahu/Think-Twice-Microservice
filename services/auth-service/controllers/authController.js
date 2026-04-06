import User from '../models/User.js';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createToken, getCookieOptions } from '../utils/jwtToken.js';

const sanitizeUser = (user) => {
  const userObj = user.toObject();
  delete userObj.password;
  return userObj;
};

export const register = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const { name, email, password } = req.body;

    console.log(`✅ [AUTH-REGISTER] Handler called trace=${traceId}`);
    console.log(`📝 [AUTH-REGISTER] Received: email=${email}, name=${name}, password_len=${password?.length || 0} trace=${traceId}`);

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Check if email exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`[AUTH] Email already registered: ${email} trace=${traceId}`);
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Create token
    const token = createToken(user);

    // Set cookie
    res.cookie('token', token, getCookieOptions());

    console.log(`[AUTH] User registered successfully: ${email} trace=${traceId}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    console.error(`[AUTH] Register error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const login = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const { email, password } = req.body;

    console.log(`✅ [AUTH-LOGIN] Handler called trace=${traceId}`);
    console.log(`📝 [AUTH-LOGIN] Received: email=${email}, password_len=${password?.length || 0} trace=${traceId}`);

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      console.log(`[AUTH] Login failed - user not found: ${email} trace=${traceId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      console.log(`[AUTH] Login failed - invalid password: ${email} trace=${traceId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Create token
    const token = createToken(user);

    // Set cookie
    res.cookie('token', token, getCookieOptions());

    console.log(`[AUTH] Login successful: ${email} trace=${traceId}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    console.error(`[AUTH] Login error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const logout = (req, res) => {
  const traceId = req.headers['x-trace-id'] || 'unknown';
  res.clearCookie('token');
  console.log(`[AUTH] Logout successful trace=${traceId}`);
  res.json({
    success: true,
    message: 'Logout successful',
  });
};

export const getMe = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    let userId = req.headers['x-user-id'];

    // If no x-user-id header, decode from JWT token in cookies
    if (!userId) {
      const token = req.cookies.token;
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'No authentication token',
        });
      }
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
        console.log(`[AUTH] GetMe from token: ${userId} trace=${traceId}`);
      } catch (error) {
        console.error(`[AUTH] Invalid token: ${error.message} trace=${traceId}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid authentication token',
        });
      }
    } else {
      console.log(`[AUTH] GetMe from header: ${userId} trace=${traceId}`);
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[AUTH] GetMe error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateActiveOrg = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const { orgId } = req.body;

    console.log(`[AUTH] Update active org: ${userId} / ${orgId} trace=${traceId}`);

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify orgId is in user's organizations - compare as strings
    const orgIdString = orgId.toString();
    const isMember = user.organizations.some(org => org.toString() === orgIdString);
    
    if (!isMember) {
      console.log(`[AUTH] User not member of org: ${userId} / ${orgId} trace=${traceId}`);
      return res.status(403).json({
        success: false,
        message: 'User is not a member of this organization',
      });
    }

    user.activeOrg = orgId;
    user.activeProject = null;
    await user.save();

    const updatedUser = await User.findById(userId);

    console.log(`[AUTH] Active org updated: ${userId} trace=${traceId}`);

    res.json({
      success: true,
      message: 'Active organization updated',
      data: {
        user: sanitizeUser(updatedUser),
      },
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[AUTH] Update active org error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateActiveProject = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const userId = req.headers['x-user-id'];
    const { projectId } = req.body;

    console.log(`[AUTH] Update active project: ${userId} / ${projectId} trace=${traceId}`);

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Project ID is required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.activeOrg) {
      return res.status(400).json({
        success: false,
        message: 'Active organization must be set before switching project',
      });
    }

    user.activeProject = projectId.toString();
    await user.save();

    const updatedUser = await User.findById(userId);

    res.json({
      success: true,
      message: 'Active project updated',
      data: {
        user: sanitizeUser(updatedUser),
      },
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[AUTH] Update active project error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const addOrganization = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const { userId, orgId } = req.body;

    console.log(`[AUTH] Add organization: ${userId} / ${orgId} trace=${traceId}`);

    if (!userId || !orgId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Organization ID are required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if already member - compare as strings
    const orgIdString = orgId.toString();
    const alreadyMember = user.organizations.some(org => org.toString() === orgIdString);
    
    if (alreadyMember) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this organization',
      });
    }

    // Add org to user's organizations
    user.organizations.push(orgId);

    // If first org, set as active
    if (user.organizations.length === 1) {
      user.activeOrg = orgId;
    }

    await user.save();

    const updatedUser = await User.findById(userId);

    console.log(`[AUTH] Organization added: ${userId} trace=${traceId}`);

    res.json({
      success: true,
      message: 'Organization added to user',
      data: {
        user: sanitizeUser(updatedUser),
      },
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[AUTH] Add organization error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeOrganization = async (req, res) => {
  try {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    const { userId, orgId } = req.body;

    console.log(`[AUTH] Remove organization: ${userId} / ${orgId} trace=${traceId}`);

    if (!userId || !orgId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Organization ID are required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Find and remove org from user's organizations
    const orgIndex = user.organizations.findIndex(org => org.toString() === orgId.toString());
    if (orgIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found in user\'s organizations',
      });
    }

    user.organizations.splice(orgIndex, 1);

    // If removed org was active org, set new active org
    if (user.activeOrg && user.activeOrg.toString() === orgId.toString()) {
      if (user.organizations.length > 0) {
        user.activeOrg = user.organizations[0];
      } else {
        user.activeOrg = null;
      }
      user.activeProject = null;
    }

    await user.save();

    const updatedUser = await User.findById(userId);

    console.log(`[AUTH] Organization removed: ${userId} trace=${traceId}`);

    res.json({
      success: true,
      message: 'Organization removed from user',
      data: {
        user: sanitizeUser(updatedUser),
      },
    });
  } catch (error) {
    const traceId = req.headers['x-trace-id'] || 'unknown';
    console.error(`[AUTH] Remove organization error: ${error.message} trace=${traceId}`);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
