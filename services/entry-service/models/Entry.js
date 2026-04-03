import mongoose from 'mongoose';

const entrySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      maxLength: 150,
      trim: true,
    },
    type: {
      type: String,
      enum: ['architecture', 'debugging', 'feature', 'best-practice', 'incident', 'other'],
      required: true,
    },
    orgId: {
      type: String,
      required: true,
      index: true,
    },
    authorId: {
      type: String,
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    what: {
      type: String,
      required: true,
    },
    why: {
      type: String,
      required: true,
    },
    dos: [
      {
        type: String,
      },
    ],
    donts: [
      {
        type: String,
      },
    ],
    context: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    tags: [
      {
        type: String,
        lowercase: true,
      },
    ],
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
    upvotes: [
      {
        type: String,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Text index for search
entrySchema.index({ title: 'text', what: 'text', why: 'text', tags: 'text' });

// Compound index for org + status queries
entrySchema.index({ orgId: 1, status: 1, createdAt: -1 });

export default mongoose.model('Entry', entrySchema);
