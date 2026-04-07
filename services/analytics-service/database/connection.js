import mongoose from 'mongoose';
import OrgMetrics from '../models/OrgMetrics.js';
import UserActivity from '../models/UserActivity.js';

const dropIndexIfExists = async (collection, indexName) => {
  try {
    await collection.dropIndex(indexName);
    console.log(`[ANALYTICS] ✓ Dropped stale index: ${collection.collectionName}.${indexName}`);
  } catch (error) {
    if (error.codeName === 'IndexNotFound' || error.message.includes('index not found')) {
      return;
    }
    throw error;
  }
};

const migrateIndexes = async () => {
  const db = mongoose.connection.db;

  const orgMetricsCollection = db.collection('orgmetrics');
  const userActivityCollection = db.collection('useractivities');

  // Legacy indexes from older schema versions conflict with project-scoped analytics.
  await dropIndexIfExists(orgMetricsCollection, 'orgId_1');
  await dropIndexIfExists(userActivityCollection, 'userId_1_orgId_1');

  await OrgMetrics.syncIndexes();
  await UserActivity.syncIndexes();
  console.log('[ANALYTICS] ✓ Indexes synchronized');
};

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/tt-analytics', {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    await migrateIndexes();
    console.log('[ANALYTICS] ✓ MongoDB connected');
  } catch (error) {
    console.error('[ANALYTICS] ✗ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

export default connectDB;
