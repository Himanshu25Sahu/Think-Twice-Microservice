import mongoose from 'mongoose';

const orgMetricsSchema = new mongoose.Schema(
  {
    orgId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    totalEntries: {
      type: Number,
      default: 0,
    },
    totalMembers: {
      type: Number,
      default: 0,
    },
    entriesByType: {
      architecture: {
        type: Number,
        default: 0,
      },
      debugging: {
        type: Number,
        default: 0,
      },
      feature: {
        type: Number,
        default: 0,
      },
      'best-practice': {
        type: Number,
        default: 0,
      },
      incident: {
        type: Number,
        default: 0,
      },
      other: {
        type: Number,
        default: 0,
      },
    },
    weeklyActivity: [
      {
        week: String, // ISO week format (e.g., "2026-W14")
        count: Number,
      },
    ],
    topContributors: [
      {
        userId: String,
        count: Number,
      },
    ],
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

export default mongoose.model('OrgMetrics', orgMetricsSchema);
