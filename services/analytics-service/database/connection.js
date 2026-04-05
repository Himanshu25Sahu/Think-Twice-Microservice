import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tt-analytics', {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('[ANALYTICS] ✓ MongoDB connected');
  } catch (error) {
    console.error('[ANALYTICS] ✗ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

export default connectDB;
