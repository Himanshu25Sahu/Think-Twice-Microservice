import './telemetry.js';

import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { startStreamListener, createEventClient } from './utils/eventConsumer.js';
import { isAuthenticated } from './utils/isAuthenticated.js';
import Metrics from './models/MetricsModel.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5002;

// ============ MIDDLEWARE ============
app.set("trust proxy", 1);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'https://think-twice-six.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['Set-Cookie']
}));

app.use(express.json());
app.use(cookieParser());

// ============ DATABASE CONNECTION ============
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB connected to: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

// ============ EVENT HANDLERS ============
const handleDecisionCreatedEvent = async (eventData) => {
  const { decision, userId, timestamp } = eventData;

  if (!decision || !userId) {
    console.error('❌ Invalid event data:', eventData);
    return;
  }

  try {
    // Update or create metrics for the user
    let metrics = await Metrics.findOne({ userId });

    if (!metrics) {
      // Initialize all category buckets
      const categoryBreakdown = {
        career: 0,
        finance: 0,
        health: 0,
        personal: 0,
        education: 0,
        relationships: 0,
        other: 0,
      };
      categoryBreakdown[decision.category] = 1;

      metrics = new Metrics({
        userId,
        totalDecisions: 1,
        categoryBreakdown,
        totalConfidenceSum: decision.confidenceLevel || 0,
      });
    } else {
      metrics.totalDecisions += 1;
      metrics.categoryBreakdown[decision.category] = (metrics.categoryBreakdown[decision.category] || 0) + 1;
      metrics.totalConfidenceSum += decision.confidenceLevel || 0;
    }

    await metrics.save();
    console.log(`📊 Metrics updated for user ${userId}:`, metrics);
  } catch (error) {
    console.error('❌ Failed to handle decision:created event:', error.message);
    throw error;
  }
};

const handleDecisionUpdatedEvent = async (eventData) => {
  const { decision, userId, timestamp } = eventData;

  if (!decision || !userId) {
    console.error('❌ Invalid event data:', eventData);
    return;
  }

  try {
    const metrics = await Metrics.findOne({ userId });

    if (metrics) {
      // If confidence level changed, update the sum
      if (decision.confidenceLevel !== undefined) {
        const oldConfidence = metrics.totalConfidenceSum / metrics.totalDecisions || 0;
        metrics.totalConfidenceSum = metrics.totalConfidenceSum - oldConfidence + decision.confidenceLevel;
      }

      await metrics.save();
      console.log(`📊 Metrics updated (decision:updated) for user ${userId}:`, metrics);
    }
  } catch (error) {
    console.error('❌ Failed to handle decision:updated event:', error.message);
    throw error;
  }
};

const handleDecisionResolvedEvent = async (eventData) => {
  const { decision, userId, outcome, timestamp } = eventData;

  if (!decision || !userId) {
    console.error('❌ Invalid event data:', eventData);
    return;
  }

  try {
    const metrics = await Metrics.findOne({ userId });

    if (metrics) {
      metrics.decisionsResolved += 1;
      await metrics.save();
      console.log(`📊 Metrics updated (decision:resolved) for user ${userId}:`, metrics);
    }
  } catch (error) {
    console.error('❌ Failed to handle decision:resolved event:', error.message);
    throw error;
  }
};

// ============ START EVENT LISTENERS ============
const startEventListeners = async () => {
  try {
    const eventClient = await createEventClient();

    // Listen to decision:created events
    startStreamListener(
      eventClient,
      'decision:created',
      'analytics-group',
      'analytics-consumer-1',
      handleDecisionCreatedEvent
    ).catch((err) => {
      console.error('❌ decision:created listener failed:', err);
      process.exit(1);
    });

    // Note: These run asynchronously without blocking
    startStreamListener(
      eventClient,
      'decision:updated',
      'analytics-group',
      'analytics-consumer-2',
      handleDecisionUpdatedEvent
    );

    startStreamListener(
      eventClient,
      'decision:resolved',
      'analytics-group',
      'analytics-consumer-3',
      handleDecisionResolvedEvent
    );

    console.log('✅ All event listeners started');
  } catch (error) {
    console.error('❌ Failed to start event listeners:', error.message);
    process.exit(1);
  }
};

// ============ ROUTES ============

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    service: 'analytics-service',
    timestamp: new Date()
  });
});

// Get user metrics from database
app.get('/analytics/metrics/:userId', async (req, res) => {
  try {
    let { userId } = req.params;
    
    console.log(`📊 Fetching metrics for userId: ${userId}`);
    
    // Validate userId is not a placeholder or empty
    if (!userId || userId === '{userId}' || userId.includes('{') || userId.includes('}')) {
      console.error(`❌ Invalid userId format: ${userId}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid userId parameter',
      });
    }
    
    // Find metrics by userId (now stored as string)
    let metrics = await Metrics.findOne({ userId });
    console.log(`📊 Query result:`, metrics ? 'Found metrics' : 'No metrics found');

    if (!metrics) {
      // Return default metrics if none exist
      console.log(`📊 Returning default metrics for new user`);
      metrics = {
        userId,
        totalDecisions: 0,
        avgConfidence: 0,
        successRate: 0,
        categoryBreakdown: {
          career: 0,
          finance: 0,
          health: 0,
          personal: 0,
          education: 0,
          relationships: 0,
          other: 0,
        },
      };
    }

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('❌ Error fetching metrics:', error.message);
    console.error('❌ Full error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get analytics for authenticated user (legacy endpoint for frontend)
app.get('/analytics/get-analytics', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    
    console.log(`📊 Fetching analytics for user: ${userId}`);
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }
    
    // Find metrics by userId
    let metrics = await Metrics.findOne({ userId });
    
    if (!metrics) {
      // Return default analytics if none exist
      console.log(`📊 Returning default analytics for new user`);
      metrics = {
        totalDecisions: 0,
        avgConfidence: 0,
        successRate: 0,
        categoryStats: {
          career: 0,
          finance: 0,
          health: 0,
          personal: 0,
          education: 0,
          relationships: 0,
          other: 0,
        },
        thisWeek: 0,
        thisMonth: 0,
      };
    }

    // Transform metrics to match expected format
    const analyticsData = {
      totalDecisions: metrics.totalDecisions || 0,
      successRate: metrics.successRate || 0,
      avgConfidence: metrics.avgConfidence || 0,
      thisWeek: 0,  // Can be calculated from timestamps if needed
      thisMonth: 0, // Can be calculated from timestamps if needed
      categoryStats: metrics.categoryBreakdown || {
        career: 0,
        finance: 0,
        health: 0,
        personal: 0,
        education: 0,
        relationships: 0,
        other: 0,
      },
      confidenceBreakdown: {
        high: 0,
        medium: 0,
        low: 0,
      },
      outcomesByConfidence: {},
      weeklyTrend: [],
      monthlyTrend: [],
      suggestions: [],
    };

    res.status(200).json({
      success: true,
      data: analyticsData,
    });
  } catch (error) {
    console.error('❌ Error fetching analytics:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Stream status endpoint (check if listeners are running)
app.get('/analytics/stream-status', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: 'analytics-service',
      listeners: {
        'decision:created': 'active',
        'decision:updated': 'active',
        'decision:resolved': 'active',
      },
      timestamp: new Date(),
    },
  });
});

// ============ ERROR HANDLING ============
app.use((err, req, res, next) => {
  console.error(`[ANALYTICS] ❌ Error:`, err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message
  });
});

// ============ START SERVER ============
app.listen(PORT, async () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔵 Analytics Service running on port ${PORT}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📋 Configuration:`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   JWT_SECRET: ${process.env.JWT_SECRET ? '✅ LOADED (' + process.env.JWT_SECRET.substring(0, 10) + '...)' : '⚠️  NOT REQUIRED FOR ANALYTICS'}`);
  console.log(`${'='.repeat(60)}`);
  try {
    await connectDB();
    console.log(`\n✅ MongoDB connected`);
    console.log(`✅ Analytics Service ready\n`);
    
    // Start event listeners (runs in background)
    startEventListeners();
  } catch (err) {
    console.error(`❌ Failed to start Analytics Service:`, err.message);
    process.exit(1);
  }
});
