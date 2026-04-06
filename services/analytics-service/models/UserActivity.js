import mongoose from 'mongoose';

const userActivitySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    orgId: {
      type: String,
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      default: '',
      index: true,
    },
    entriesCreated: {
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
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Compound unique index
userActivitySchema.index({ userId: 1, orgId: 1, projectId: 1 }, { unique: true });

export default mongoose.model('UserActivity', userActivitySchema);
