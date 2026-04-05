import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.warn("[Warning] JWT_SECRET is not set. Using default secret key. This is not recommended for production.");
  process.exit(1); // Exit the process if JWT_SECRET is not set
}

export const createToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET || 'your-secret-key',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '3d',
    }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.log("[Error] in verify token: ",error)
    return null;
  }
};

export const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days (match JWT expiry)
  path: '/',
});
