import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/think-twice', {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('[ENTRY] ✓ MongoDB connected');
  } catch (error) {
    console.error('[ENTRY] ✗ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

export default connectDB;
