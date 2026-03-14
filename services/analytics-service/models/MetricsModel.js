// services/analytics-service/models/MetricsModel.js
import mongoose from 'mongoose';

const metricsSchema = new mongoose.Schema(
  {
    userId: {
      type: String,  // Store as string since we convert _id.toString() when emitting events
      required: true,
      index: true,
      unique: true,
    },
    totalDecisions: {
      type: Number,
      default: 0,
    },
    categoryBreakdown: {
      career: { type: Number, default: 0 },
      finance: { type: Number, default: 0 },
      health: { type: Number, default: 0 },
      personal: { type: Number, default: 0 },
      education: { type: Number, default: 0 },
      relationships: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    avgConfidence: {
      type: Number,
      default: 0,
    },
    totalConfidenceSum: {
      type: Number,
      default: 0,
    },
    decisionsResolved: {
      type: Number,
      default: 0,
    },
    successRate: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Pre-save middleware to calculate avgConfidence
metricsSchema.pre('save', function (next) {
  if (this.totalDecisions > 0) {
    this.avgConfidence = Math.round((this.totalConfidenceSum / this.totalDecisions) * 100) / 100;
  }
  if (this.decisionsResolved > 0) {
    this.successRate = Math.round((this.decisionsResolved / this.totalDecisions) * 100);
  }
  this.lastUpdated = Date.now();
  next();
});

export default mongoose.model('Metrics', metricsSchema);
