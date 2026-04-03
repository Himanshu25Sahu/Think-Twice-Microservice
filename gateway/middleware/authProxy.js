import jwt from 'jsonwebtoken';

export const verifyAuth = (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Set headers for downstream services
    req.headers['x-user-id'] = decoded.id;
    req.headers['x-user-email'] = decoded.email;
    req.headers['x-user-name'] = decoded.name || decoded.email;
    
    console.log(`[GATEWAY] User authenticated: ${decoded.email} trace=${req.traceId}`);
    
    next();
  } catch (error) {
    console.log(`[GATEWAY] Auth failed: ${error.message} trace=${req.traceId}`);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token',
    });
  }
};

export const optionalAuth = (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.headers['x-user-id'] = decoded.id;
      req.headers['x-user-email'] = decoded.email;
      req.headers['x-user-name'] = decoded.name || decoded.email;
      console.log(`[GATEWAY] User authenticated: ${decoded.email} trace=${req.traceId}`);
    }

    next();
  } catch (error) {
    console.log(`[GATEWAY] Optional auth failed (continuing): ${error.message} trace=${req.traceId}`);
    next();
  }
};
