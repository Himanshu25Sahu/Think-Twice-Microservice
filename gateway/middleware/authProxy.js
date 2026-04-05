import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.warn("[Warning] JWT_SECRET is not set. Using default secret key. This is not recommended for production.");
  process.exit(1); // Exit the process if JWT_SECRET is not set
}

export const verifyAuth = (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
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

// Optional auth middleware that allows requests without a token but sets user info if token is valid
export const optionalAuth = (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
