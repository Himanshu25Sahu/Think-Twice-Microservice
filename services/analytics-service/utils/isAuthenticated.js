import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

export const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      console.log('❌ No token found in analytics auth request');
      return res.status(401).json({ 
        success: false, 
        message: "Not authenticated, please login" 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token decoded successfully for user:', decoded.id);

    // Attach user ID to request
    req.user = {
      _id: decoded.id,
      id: decoded.id
    };

    next();
  } catch (error) {
    console.error('❌ Analytics auth middleware error:', error.message);
    return res.status(401).json({ 
      success: false, 
      message: "Invalid or expired token" 
    });
  }
};
